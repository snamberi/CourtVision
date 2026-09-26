#!/usr/bin/env python3
"""
Court Vision — NBA history asset builder (reproducible, build-time only).

Inputs
  1. Basketball-Reference compilation by Sumitro Datta:
       git clone https://github.com/sumitrodatta/bball-reference-datasets.git
       (built against commit 76a70b41ad1c13948f25c62c921ed822e5db7f0e, 2026-04-13)
     Pass its Data/ directory as --bbref.
  2. Curated lists in ./sources (champions, Finals MVP, All-Star Game MVP, Coach of the Year) transcribed from
     nba.com history pages.
  3. sources/cv_overall_distribution.json: Court Vision's own Overall distribution, measured from generated leagues by
     cvDistribution.measure.ts (npx vitest run -c scripts/nba-history/vitest.measure.config.ts).

Output
  public/data/nba-history.v2.bin       (gzipped JSON; lazy-loaded by the app only when a historical league is created or browsed)
  scripts/nba-history/COVERAGE.md       (coverage report, validation results, known gaps)

Conventions
  * Seasons are stored by END year like the source (2016 = 2015-16). The app converts to START years for the UI
    ("start 2016" = opening of 2016-17).
  * Missing / unrecorded statistics stay null (source "NA"); they are never turned into zeroes.
  * Traded players: the source's aggregate row (2TM/3TM/…) is kept as the season total and flagged; team stints are kept
    separately and are never added to the aggregate.
  * Ratings are Court Vision's own, computed from statistics only (see build_ratings). No outside ratings are used.
  * Teams are shipped with city/region names only ("Golden State", "Seattle"); official team names are not included.

Usage
  python3 scripts/nba-history/build_nba_history.py --bbref /path/to/bball-reference-datasets/Data
"""
import argparse, csv, gzip, json, math, os, re, sys, unicodedata, datetime
from collections import defaultdict, Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DATASET_VERSION = 'nba-history.v2'
BBREF_COMMIT = '76a70b41ad1c13948f25c62c921ed822e5db7f0e'

# ---------------------------------------------------------------- franchise lineage (NBA official convention)
# Each abbreviation used in the source → the franchise it belongs to today (or its own id if defunct).
FRANCHISE = {
    'ATL': 'ATL', 'STL': 'ATL', 'MLH': 'ATL', 'TRI': 'ATL',
    'BOS': 'BOS',
    'BRK': 'BRK', 'NJN': 'BRK', 'NYN': 'BRK',
    'CHO': 'CHO', 'CHA': 'CHO', 'CHH': 'CHO',
    'CHI': 'CHI', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN',
    'DET': 'DET', 'FTW': 'DET',
    'GSW': 'GSW', 'SFW': 'GSW', 'PHW': 'GSW',
    'HOU': 'HOU', 'SDR': 'HOU',
    'IND': 'IND',
    'LAC': 'LAC', 'SDC': 'LAC', 'BUF': 'LAC',
    'LAL': 'LAL', 'MNL': 'LAL',
    'MEM': 'MEM', 'VAN': 'MEM',
    'MIA': 'MIA', 'MIL': 'MIL', 'MIN': 'MIN',
    'NOP': 'NOP', 'NOH': 'NOP', 'NOK': 'NOP',
    'NYK': 'NYK',
    'OKC': 'OKC', 'SEA': 'OKC',
    'ORL': 'ORL',
    'PHI': 'PHI', 'SYR': 'PHI',
    'PHO': 'PHO', 'POR': 'POR',
    'SAC': 'SAC', 'KCK': 'SAC', 'KCO': 'SAC', 'CIN': 'SAC', 'ROC': 'SAC',
    'SAS': 'SAS', 'TOR': 'TOR',
    'UTA': 'UTA', 'NOJ': 'UTA',
    'WAS': 'WAS', 'WSB': 'WAS', 'CAP': 'WAS', 'BAL': 'WAS', 'CHZ': 'WAS', 'CHP': 'WAS',
    # defunct franchises keep their own id
    'AND': 'AND', 'CHS': 'CHS', 'DNN': 'DNN', 'SHE': 'SHE', 'STB': 'STB', 'WAT': 'WAT', 'INJ': 'INJ', 'PRO': 'PRO',
    'CLR': 'CLR', 'DTF': 'DTF', 'PIT': 'PIT', 'TRH': 'TRH', 'BLB': 'BLB', 'INO': 'INO', 'WSC': 'WSC',
}
# Modern conference/division alignment. Exact for 2004-05 onward; applied to earlier seasons as a documented
# simplification (historical alignments changed many times).
ALIGNMENT = {
    'BOS': ('east', 'Atlantic'), 'BRK': ('east', 'Atlantic'), 'NYK': ('east', 'Atlantic'), 'PHI': ('east', 'Atlantic'), 'TOR': ('east', 'Atlantic'),
    'CHI': ('east', 'Central'), 'CLE': ('east', 'Central'), 'DET': ('east', 'Central'), 'IND': ('east', 'Central'), 'MIL': ('east', 'Central'),
    'ATL': ('east', 'Southeast'), 'CHO': ('east', 'Southeast'), 'MIA': ('east', 'Southeast'), 'ORL': ('east', 'Southeast'), 'WAS': ('east', 'Southeast'),
    'DEN': ('west', 'Northwest'), 'MIN': ('west', 'Northwest'), 'OKC': ('west', 'Northwest'), 'POR': ('west', 'Northwest'), 'UTA': ('west', 'Northwest'),
    'GSW': ('west', 'Pacific'), 'LAC': ('west', 'Pacific'), 'LAL': ('west', 'Pacific'), 'PHO': ('west', 'Pacific'), 'SAC': ('west', 'Pacific'),
    'DAL': ('west', 'Southwest'), 'HOU': ('west', 'Southwest'), 'MEM': ('west', 'Southwest'), 'NOP': ('west', 'Southwest'), 'SAS': ('west', 'Southwest'),
    # defunct (geography)
    'AND': ('east', 'Central'), 'CHS': ('east', 'Central'), 'DNN': ('west', 'Northwest'), 'SHE': ('east', 'Central'), 'STB': ('west', 'Southwest'),
    'WAT': ('west', 'Northwest'), 'INJ': ('east', 'Central'), 'PRO': ('east', 'Atlantic'), 'CLR': ('east', 'Central'), 'DTF': ('east', 'Central'),
    'PIT': ('east', 'Atlantic'), 'TRH': ('east', 'Atlantic'), 'BLB': ('east', 'Southeast'), 'INO': ('east', 'Central'), 'WSC': ('east', 'Southeast'),
}
NBA_LINEAGE = ('BAA', 'NBA')

STAT_FIELDS = ['g', 'gs', 'mp', 'fg', 'fga', 'x3p', 'x3pa', 'ft', 'fta', 'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts', 'trp_dbl']
ADV_FIELDS = ['per', 'ts_percent', 'x3p_ar', 'f_tr', 'orb_percent', 'drb_percent', 'trb_percent', 'ast_percent', 'stl_percent', 'blk_percent',
              'tov_percent', 'usg_percent', 'ows', 'dws', 'ws', 'ws_48', 'obpm', 'dbpm', 'bpm', 'vorp']
AWARD_KEYS = {'nba mvp': 'mvp', 'nba dpoy': 'dpoy', 'nba roy': 'roy', 'nba smoy': 'smoy', 'nba mip': 'mip', 'nba clutch_poy': 'clutch',
              'baa roy': 'roy', 'aba mvp': 'aba-mvp', 'aba roy': 'aba-roy'}


def num(v):
    if v is None or v == '' or v == 'NA':
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return int(f) if f.is_integer() and '.' not in v else round(f, 4)


def fold(name):
    """Accent/punctuation-insensitive key for matching names across sources."""
    n = unicodedata.normalize('NFKD', name.replace('ı', 'i').replace('İ', 'I')).encode('ascii', 'ignore').decode()
    n = re.sub(r"[^a-z0-9 ]", '', n.lower().replace('-', ' '))
    n = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', n)
    return re.sub(r'\s+', ' ', n).strip()


def read(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def season_label(end_year):
    return f"{end_year - 1}-{str(end_year)[2:]}"


def parse_pipe_file(path):
    rows, meta = [], []
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        if line.startswith('#'):
            meta.append(line[1:].strip())
            continue
        rows.append([c.strip() for c in line.split('|')])
    return rows, meta


def season_end_from_label(label):
    # '1946-47' -> 1947 ; '1999-00' -> 2000
    return int(label[:4]) + 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bbref', default='/tmp/claude-0/bbref/Data')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'data', f'{DATASET_VERSION}.bin'))
    args = ap.parse_args()
    D = lambda n: os.path.join(args.bbref, n)
    report = []  # validation / coverage lines
    gaps = []

    # ------------------------------------------------------------ players
    career = read(D('Player Career Info.csv'))
    totals = read(D('Player Totals.csv'))
    adv = read(D('Advanced.csv'))
    season_info = read(D('Player Season Info.csv'))

    players = {}
    for r in career:
        pid = r['player_id']
        players[pid] = {
            'id': pid, 'name': r['player'], 'pos': None if r['pos'] == 'NA' else r['pos'],
            'ht': num(r['ht_in_in']), 'wt': num(r['wt']), 'birth': None if r['birth_date'] == 'NA' else r['birth_date'],
            'college': None if r['colleges'] == 'NA' else r['colleges'], 'from': num(r['from']), 'to': num(r['to']),
            'debut': None if r['debut'] == 'NA' else r['debut'][:10], 'hof': r['hof'] == 'TRUE', 'aliases': set(),
        }
    # Renamed players whose earlier name other sources still use.
    MANUAL_ALIASES = {'kanteen01': ['Enes Kanter']}
    for pid, names in MANUAL_ALIASES.items():
        if pid in players:
            players[pid]['aliases'].update(names)
    for r in totals:
        p = players.get(r['player_id'])
        if p is None:
            players[r['player_id']] = p = {'id': r['player_id'], 'name': r['player'], 'pos': None, 'ht': None, 'wt': None, 'birth': None,
                                          'college': None, 'from': None, 'to': None, 'debut': None, 'hof': False, 'aliases': set()}
            gaps.append(f"player {r['player_id']} ({r['player']}) has season rows but no career-info row")
        if r['player'] != p['name']:
            p['aliases'].add(r['player'])

    # ------------------------------------------------------------ player seasons (stints + aggregate), NBA/BAA and ABA kept apart
    adv_by = {(r['player_id'], r['season'], r['lg'], r['team']): r for r in adv}
    exp_by = {(r['player_id'], r['season'], r['lg'], r['team']): r for r in season_info}
    seasons = []  # list of dicts, one per (player, season, league, team-or-aggregate)
    seen_keys = Counter()
    for r in totals:
        key = (r['player_id'], r['season'], r['lg'], r['team'])
        seen_keys[key] += 1
        agg = bool(re.fullmatch(r'\dTM', r['team'])) or r['team'] == 'TOT'
        a = adv_by.get(key)
        row = {
            'p': r['player_id'], 's': int(r['season']), 'lg': r['lg'], 'tm': 'TOT' if agg else r['team'], 'agg': agg,
            'age': num(r['age']), 'pos': None if r['pos'] == 'NA' else r['pos'],
            'st': [num(r[f]) for f in STAT_FIELDS],
            'adv': [num(a[f]) for f in ADV_FIELDS] if a else None,
        }
        e = exp_by.get(key)
        if e is not None:
            row['exp'] = num(e['experience'])
        seasons.append(row)
    dup = [k for k, c in seen_keys.items() if c > 1]
    report.append(f"Player-season rows: {len(seasons)} ({sum(1 for s in seasons if s['agg'])} multi-team aggregate rows); duplicate keys: {len(dup)}")

    # Order stints: the source lists the aggregate first, then teams in the order played. Keep an explicit index.
    order = defaultdict(int)
    for row in seasons:
        k = (row['p'], row['s'], row['lg'])
        if not row['agg']:
            row['i'] = order[k]
            order[k] += 1

    # Validation: stints sum to the aggregate for counting stats (never double count)
    by_psl = defaultdict(list)
    for row in seasons:
        by_psl[(row['p'], row['s'], row['lg'])].append(row)
    mismatches = 0
    checked = 0
    for k, rows in by_psl.items():
        aggs = [r for r in rows if r['agg']]
        stints = [r for r in rows if not r['agg']]
        if len(aggs) > 1:
            gaps.append(f'{k}: more than one aggregate row')
        if aggs:
            checked += 1
            for fi, f in enumerate(STAT_FIELDS):
                if f in ('trp_dbl',):
                    continue
                av = aggs[0]['st'][fi]
                sv = [s['st'][fi] for s in stints]
                if av is None or any(v is None for v in sv):
                    continue
                if abs(av - sum(sv)) > 0.6:
                    mismatches += 1
                    break
    report.append(f'Multi-team seasons checked: {checked}; aggregate ≠ sum of stints on a counting stat: {mismatches}')

    # ------------------------------------------------------------ teams
    team_abbrev = read(D('Team Abbrev.csv'))
    team_sum = {(r['season'], r['abbreviation']): r for r in read(D('Team Summaries.csv')) if r['abbreviation'] != 'NA'}
    teams = []
    unmapped = set()
    for r in team_abbrev:
        if r['lg'] not in NBA_LINEAGE and r['lg'] != 'ABA':
            continue
        ab = r['abbreviation']
        s = team_sum.get((r['season'], ab))
        fr = FRANCHISE.get(ab) if r['lg'] in NBA_LINEAGE else None
        if r['lg'] in NBA_LINEAGE and fr is None:
            unmapped.add(ab)
        conf, div = ALIGNMENT.get(fr, (None, None)) if fr else (None, None)
        teams.append({
            's': int(r['season']), 'lg': r['lg'], 'ab': ab, 'name': r['team'], 'fr': fr, 'conf': conf, 'div': div,
            'po': r['playoffs'] == 'TRUE',
            'w': num(s['w']) if s else None, 'l': num(s['l']) if s else None,
            'ortg': num(s['o_rtg']) if s else None, 'drtg': num(s['d_rtg']) if s else None, 'pace': num(s['pace']) if s else None,
            'srs': num(s['srs']) if s else None, 'arena': (s['arena'] if s and s['arena'] != 'NA' else None),
        })
    if unmapped:
        gaps.append(f'Unmapped franchise abbreviations: {sorted(unmapped)}')
    team_names_by_season = defaultdict(dict)
    for t in teams:
        team_names_by_season[t['s']][t['name'].lower()] = t
    report.append(f"Team seasons: {len(teams)} ({sum(1 for t in teams if t['lg'] in NBA_LINEAGE)} BAA/NBA, {sum(1 for t in teams if t['lg']=='ABA')} ABA)")

    # ------------------------------------------------------------ unique display names (the game keys players by name)
    display = {}
    by_fold = defaultdict(list)
    for pid, p in players.items():
        by_fold[fold(p['name'])].append(pid)
    collisions = 0
    for key, ids in by_fold.items():
        ids.sort(key=lambda i: (players[i]['from'] or 9999, i))
        for n, pid in enumerate(ids):
            p = players[pid]
            if n == 0:
                display[pid] = p['name']
            else:
                collisions += 1
                display[pid] = f"{p['name']} ({p['from'] or pid})"
    report.append(f'Players: {len(players)}; same-name players disambiguated with debut year: {collisions}')

    def match_player(name, season_end, lg_filter=None, team_hint=None):
        """Find the canonical id for a person named in a curated list, constrained to players who played that season."""
        target = fold(name)
        cands = [pid for pid in by_fold.get(target, [])]
        played = {row['p'] for row in seasons if row['s'] == season_end and (lg_filter is None or row['lg'] in lg_filter)}
        cands = [c for c in cands if c in played] or cands
        if len(cands) == 1:
            return cands[0]
        if team_hint and len(cands) > 1:
            hinted = [c for c in cands if any(r['p'] == c and r['s'] == season_end and r['tm'] == team_hint for r in seasons)]
            if len(hinted) == 1:
                return hinted[0]
        return None

    # ------------------------------------------------------------ awards from the statistics source
    shares = read(D('Player Award Shares.csv'))
    awards = []
    for r in shares:
        k = AWARD_KEYS.get(r['award'])
        if not k:
            continue
        awards.append({'s': int(r['season']), 'a': k, 'p': r['player_id'], 'first': num(r['first']), 'won': num(r['pts_won']),
                       'max': num(r['pts_max']), 'share': num(r['share']), 'win': r['winner'] == 'TRUE'})
    eos = read(D('End of Season Teams.csv'))
    team_awards = []
    type_key = {'All-NBA': 'allLeague', 'All-BAA': 'allLeague', 'All-Defense': 'allDefense', 'All-Rookie': 'allRookie',
                'All-ABA': 'aba-allLeague'}
    for r in eos:
        t = type_key.get(r['type'])
        if not t or r['player_id'] == 'NA':
            continue
        rank = {'1st': 1, '2nd': 2, '3rd': 3}.get(r['number_tm'], None)
        team_awards.append({'s': int(r['season']), 'lg': r['lg'], 'a': t, 'rank': rank, 'p': r['player_id'], 'pos': r['position']})
    allstars = [{'s': int(r['season']), 'lg': r['lg'], 'p': r['player_id'], 'tm': r['team'], 'rep': r['replaced'] == 'TRUE'}
                for r in read(D('All-Star Selections.csv')) if r['player_id'] != 'NA']
    report.append(f'Award ballots: {len(awards)} rows ({sum(1 for a in awards if a["win"])} winners); All-League/Defense/Rookie selections: {len(team_awards)}; All-Star selections: {len(allstars)}')

    # ------------------------------------------------------------ curated lists (nba.com) with cross-checks
    abbr_by_name = defaultdict(dict)
    for t in teams:
        abbr_by_name[t['s']][fold(t['name'])] = t['ab']
    def team_abbr(season_end, name):
        n = fold(name.replace('Ft.', 'Fort'))
        return abbr_by_name[season_end].get(n)

    champ_rows, champ_meta = parse_pipe_file(os.path.join(HERE, 'sources', 'champions.txt'))
    champions = []
    for label, champ, runner, result in champ_rows:
        s = season_end_from_label(label)
        ca, ra = team_abbr(s, champ), team_abbr(s, runner)
        ok_po = any(t['s'] == s and t['ab'] == ca and t['po'] for t in teams)
        if not ca or not ra:
            gaps.append(f'champions {label}: could not map "{champ}"/"{runner}" to a team that season')
        elif not ok_po:
            gaps.append(f'champions {label}: {ca} not flagged as a playoff team in the statistics source')
        champions.append({'s': s, 'ch': ca, 'ru': ra, 'res': result, 'chName': champ, 'ruName': runner, 'fmvp': None})
    fmvp_rows, fmvp_meta = parse_pipe_file(os.path.join(HERE, 'sources', 'finals_mvp.txt'))
    for label, name, team in fmvp_rows:
        s = season_end_from_label(label)
        ch = next((c for c in champions if c['s'] == s), None)
        pid = match_player(name, s, NBA_LINEAGE, ch['ch'] if ch else None)
        if not pid:
            gaps.append(f'Finals MVP {label} "{name}" not matched to a player')
            continue
        on_team = lambda ab: any(r['p'] == pid and r['s'] == s and FRANCHISE.get(r['tm']) == FRANCHISE.get(ab) for r in seasons if not r['agg'])
        if ch and not on_team(ch['ch']):
            if on_team(ch['ru']):
                report.append(f'Finals MVP {label} {name} played for the runner-up ({ch["ru"]}) — the only losing-team Finals MVP; kept as listed by nba.com')
            else:
                gaps.append(f'Finals MVP {label} {name}: no regular-season stint with either finalist found')
        if ch:
            ch['fmvp'] = pid
    asg_rows, asg_meta = parse_pipe_file(os.path.join(HERE, 'sources', 'allstar_mvp.txt'))
    asg_mvp = []
    for year, names in asg_rows:
        s = int(year)
        for name in names.split(' & '):
            pid = match_player(name, s, NBA_LINEAGE)
            if not pid:
                gaps.append(f'All-Star MVP {year} "{name}" not matched')
                continue
            if not any(a['p'] == pid and a['s'] == s for a in allstars):
                gaps.append(f'All-Star MVP {year} {name}: not in the All-Star selections for that season')
            asg_mvp.append({'s': s, 'p': pid})
    coy_rows, coy_meta = parse_pipe_file(os.path.join(HERE, 'sources', 'coach_of_year.txt'))
    coaches = [{'s': season_end_from_label(lbl), 'coach': coach, 'team': team_abbr(season_end_from_label(lbl), team) or team} for lbl, coach, team in coy_rows]
    report.append(f'Champions: {len(champions)} seasons; Finals MVPs matched: {sum(1 for c in champions if c["fmvp"])}/{len(fmvp_rows)}; '
                  f'All-Star MVPs matched: {len(asg_mvp)}; Coach of the Year: {len(coaches)}')

    # Championship roster credit: players whose LAST regular-season stint that season was with the champion
    # (traded-away players are excluded). Playoff participation is not in the source, so this is labelled inferred.
    last_stint = {}
    for row in seasons:
        if row['agg'] or row['lg'] not in NBA_LINEAGE:
            continue
        k = (row['p'], row['s'])
        if k not in last_stint or row['i'] > last_stint[k]['i']:
            last_stint[k] = row
    for c in champions:
        c['roster'] = sorted([p for (p, s), row in last_stint.items() if s == c['s'] and row['tm'] == c['ch']])

    # ------------------------------------------------------------ drafts
    drafts = []
    for r in read(D('Draft Pick History.csv')):
        drafts.append({'y': int(r['season']), 'lg': r['lg'], 'pick': num(r['overall_pick']), 'rd': num(r['round']), 'tm': r['tm'],
                       'p': None if r['player_id'] == 'NA' else r['player_id'], 'name': r['player'],
                       'college': None if r['college'] == 'NA' else r['college']})
    draft_by_player = {}
    for d in drafts:
        if d['p'] and d['lg'] in NBA_LINEAGE:
            prev = draft_by_player.get(d['p'])
            if prev is None or d['y'] > prev['y']:  # re-drafted players: keep the draft that stuck (latest)
                draft_by_player[d['p']] = d
    report.append(f'Draft picks: {len(drafts)} ({sum(1 for d in drafts if not d["p"])} never reached the NBA and have no player id)')

    # ------------------------------------------------------------ ratings
    ratings = build_ratings(players, seasons, teams, awards, team_awards, report, gaps)
    clashes = region_names(teams)
    same_city = sorted({c.split(': ', 1)[1] for c in clashes})
    report.append(f'Team names: city/region names only (official team names are not shipped); same-city pairs told apart: ' + '; '.join(same_city))

    # ------------------------------------------------------------ assemble compact output
    pid_index = {pid: i for i, pid in enumerate(sorted(players))}
    P = lambda pid: pid_index.get(pid)
    out_players = []
    for pid in sorted(players):
        p = players[pid]
        d = draft_by_player.get(pid)
        out_players.append([pid, display[pid], p['name'], sorted(p['aliases']), p['pos'], p['ht'], p['wt'], p['birth'], p['college'],
                            p['from'], p['to'], p['debut'], 1 if p['hof'] else 0,
                            [d['y'], d['rd'], d['pick'], d['tm']] if d else None])
    out_seasons = [[P(r['p']), r['s'], r['lg'], r['tm'], 1 if r['agg'] else 0, r.get('i', -1), r['age'], r['pos'], r['st'], r['adv'], r.get('exp')] for r in seasons]
    out = {
        'manifest': {
            'schema': 1, 'dataset': DATASET_VERSION, 'builtAt': datetime.date.today().isoformat(),
            'seasonConvention': 'season = END year of the season (2016 = 2015-16)',
            'statFields': STAT_FIELDS, 'advFields': ADV_FIELDS,
            'playerFields': ['id', 'displayName', 'name', 'aliases', 'pos', 'heightIn', 'weightLb', 'birthDate', 'college', 'firstSeason',
                             'lastSeason', 'debutDate', 'hallOfFame', 'draft[year,round,pick,team]'],
            'seasonFields': ['player', 'season', 'league', 'team', 'isAggregate', 'stintIndex', 'age', 'pos', 'stats', 'advanced', 'experience'],
            'sources': [
                {'name': 'Basketball-Reference historical datasets (Sumitro Datta)', 'url': 'https://github.com/sumitrodatta/bball-reference-datasets',
                 'commit': BBREF_COMMIT, 'license': 'No license file in the repository; data originates from Basketball-Reference.com (Sports Reference). Redistribution terms must be confirmed by the owner before public release.',
                 'retrieved': '2026-09-25'},
                {'name': 'NBA.com history pages (champions, Finals MVP, All-Star Game MVP, Coach of the Year)', 'url': 'https://www.nba.com/news/history-all-time-awards',
                 'license': 'Facts transcribed from nba.com; see sources/*.txt headers', 'retrieved': '2026-09-25'},
            ],
            'coverage': {
                'seasons': [min(r['s'] for r in seasons), max(r['s'] for r in seasons)],
                'supportedStartYears': [1946, 2025],
                'notes': [],
            },
            'ratingMethod': ratings['method'],
            'report': report, 'gaps': gaps, 'limitations': KNOWN_GAPS,
        },
        'players': out_players,
        'seasons': out_seasons,
        'teams': [[t['s'], t['lg'], t['ab'], t['region'], t['fr'], t['conf'], t['div'], 1 if t['po'] else 0, t['w'], t['l'], t['ortg'], t['drtg'], t['pace'], t['srs'], t['arena']] for t in teams],
        'awards': [[a['s'], a['a'], P(a['p']), a['first'], a['won'], a['max'], a['share'], 1 if a['win'] else 0] for a in awards if P(a['p']) is not None],
        'teamAwards': [[a['s'], a['lg'], a['a'], a['rank'], P(a['p']), a['pos']] for a in team_awards if P(a['p']) is not None],
        'allStars': [[a['s'], a['lg'], P(a['p']), a['tm'], 1 if a['rep'] else 0] for a in allstars if P(a['p']) is not None],
        'allStarMvp': [[a['s'], P(a['p'])] for a in asg_mvp],
        'champions': [[c['s'], c['ch'], c['ru'], c['res'], P(c['fmvp']) if c['fmvp'] else None, [P(p) for p in c['roster']]] for c in champions],
        'coachOfYear': [[c['s'], c['coach'], c['team']] for c in coaches],
        'drafts': [[d['y'], d['lg'], d['pick'], d['rd'], d['tm'], P(d['p']) if d['p'] else None, d['name'], d['college']] for d in drafts],
        'ratings': [[P(r['p']), r['s'], r['ovr'], r['src']] for r in ratings['rows']],
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    raw = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    # mtime=0 keeps the gzip bytes identical between builds of the same inputs.
    with open(args.out, 'wb') as fh, gzip.GzipFile(fileobj=fh, mode='wb', compresslevel=9, mtime=0) as f:
        f.write(raw)
    size = os.path.getsize(args.out)
    report.append(f'Asset: {os.path.relpath(args.out, ROOT)} — {len(raw)/1e6:.1f} MB JSON, {size/1e6:.2f} MB gzipped')
    write_coverage(out, report, gaps, ratings)
    print('\n'.join(report))
    print(f'{len(gaps)} gaps/warnings (see COVERAGE.md)')


# ======================================================================================= ratings
def build_ratings(players, seasons, teams, awards, team_awards, report, gaps):
    """Start-of-season Court Vision Overall for every player-season, computed from statistics only.

    1. A production score for every season (per game, so an injury-shortened season is not a worse one):
         * 1973-74 on:  (Box Plus/Minus + 2) x minutes per game / 48 — value over replacement per game.
         * 1951-52 to 1972-73 (no BPM): the same, with BPM estimated from PER and WS/48. The estimate is fitted on
           1973-74+ seasons, where all three are known.
         * 1946-47 to 1950-51 (no minutes): the per-game score estimated from win shares, points and assists per game,
           again fitted on 1973-74+ seasons.
       Small samples are pulled toward replacement level.
    2. The rating a player carries INTO season S comes from season S-1 (an injury-shortened S-1 is blended with S-2);
       a debut or a return after a missed season uses season S itself.
    3. Players of each season are ranked by that score. The Nth best, scaled to a 30-team league, receives the Nth
       best Overall of a typical generated Court Vision league (sources/cv_overall_distribution.json).
    No outside ratings are used anywhere."""
    NBA = ('BAA', 'NBA')
    agg = {}
    for r in seasons:
        if r['lg'] not in NBA:
            continue
        agg.setdefault((r['p'], r['s']), []).append(r)
    season_row = {}
    for k, rows in agg.items():
        a = [r for r in rows if r['agg']]
        season_row[k] = a[0] if a else rows[0]
    team_games = defaultdict(int)
    teams_in = defaultdict(int)
    for t in teams:
        if t['lg'] in NBA:
            teams_in[t['s']] += 1
            if t['w'] is not None:
                team_games[t['s']] = max(team_games[t['s']], (t['w'] or 0) + (t['l'] or 0))

    SF = {f: i for i, f in enumerate(STAT_FIELDS)}
    AF = {f: i for i, f in enumerate(ADV_FIELDS)}
    def st(r, f): return r['st'][SF[f]]
    def ad(r, f): return r['adv'][AF[f]] if r['adv'] else None

    REPL, SHRINK_MIN, SHRINK_G = -2.0, 400.0, 10.0
    def shrink(v, n, k, prior): return (v * n + prior * k) / (n + k)

    # ---- era A: value over replacement per game
    def value_a(r):
        g, mp, bpm = st(r, 'g') or 0, st(r, 'mp'), ad(r, 'bpm')
        if not g or mp is None or bpm is None:
            return None
        return (shrink(bpm, mp, SHRINK_MIN, REPL) - REPL) * (mp / g) / 48

    # ---- internal fits on 1973-74+ seasons (all quantities known there)
    fit_rows = [r for r in season_row.values() if value_a(r) is not None and (st(r, 'mp') or 0) >= 200 and ad(r, 'per') is not None and ad(r, 'ws_48') is not None]
    Xb = np.array([[1, ad(r, 'per'), ad(r, 'ws_48')] for r in fit_rows], dtype=float)
    yb = np.array([ad(r, 'bpm') for r in fit_rows], dtype=float)
    coef_b, *_ = np.linalg.lstsq(Xb, yb, rcond=None)
    corr_b = float(np.corrcoef(Xb @ coef_b, yb)[0, 1])
    def value_b(r):
        g, mp, per, ws48 = st(r, 'g') or 0, st(r, 'mp'), ad(r, 'per'), ad(r, 'ws_48')
        if not g or mp is None or per is None or ws48 is None:
            return None
        bpm = float(coef_b @ [1, per, ws48])
        return (shrink(bpm, mp, SHRINK_MIN, REPL) - REPL) * (mp / g) / 48

    def c_features(r):
        g = st(r, 'g') or 0
        if not g or st(r, 'pts') is None:
            return None
        ws = ad(r, 'ws')
        return [1, (ws if ws is not None else 0) / g * 82, st(r, 'pts') / g, (st(r, 'ast') or 0) / g]
    fit_c = [r for r in fit_rows if c_features(r) is not None and ad(r, 'ws') is not None]
    Xc = np.array([c_features(r) for r in fit_c], dtype=float)
    yc = np.array([value_a(r) for r in fit_c], dtype=float)
    coef_c, *_ = np.linalg.lstsq(Xc, yc, rcond=None)
    corr_c = float(np.corrcoef(Xc @ coef_c, yc)[0, 1])
    def value_c(r):
        f = c_features(r)
        if f is None:
            return None
        g = st(r, 'g') or 0
        return shrink(float(coef_c @ f), g, SHRINK_G, 0.0)

    def value(r):
        for era, fn in (('A', value_a), ('B', value_b), ('C', value_c)):
            v = fn(r)
            if v is not None:
                return v, era
        return None, None

    def games_share(r):
        return min(1.0, (st(r, 'g') or 0) / max(1, team_games.get(r['s'], 82)))

    def earlier_value(pid, s, first_back):
        """Most recent season value from s-first_back back to s-3 (a returning or injured player's last real form)."""
        for back in range(first_back, 4):
            r = season_row.get((pid, s - back))
            if r is not None:
                v, _ = value(r)
                if v is not None:
                    return v
        return None

    def blend(v, w, older):
        # A short season (under half the games) leans on the player's earlier form, never below the short season itself.
        return v if older is None or w >= 0.5 else w * 2 * v + (1 - w * 2) * max(v, older)

    def carried(pid, s):
        """Score a player carries into season s, and where it came from."""
        prev = season_row.get((pid, s - 1))
        if prev is not None:
            v, era = value(prev)
            if v is not None:
                return blend(v, games_share(prev), earlier_value(pid, s, 2)), 'stats', era
        cur = season_row[(pid, s)]
        v, era = value(cur)
        if v is None:
            return None, None, None
        return blend(v, games_share(cur), earlier_value(pid, s, 2)), 'stats-same', era

    with open(os.path.join(HERE, 'sources', 'cv_overall_distribution.json'), encoding='utf-8') as f:
        dist = json.load(f)
    target = dist['ranks']
    def overall_at(pos):
        """Overall of the pos-th best player (0-based, fractional) in a 30-team generated league."""
        if pos <= 0:
            return target[0]
        if pos >= len(target) - 1:
            return max(20.0, target[-1] - (pos - (len(target) - 1)) * 0.05)
        i = int(pos)
        return target[i] + (target[i + 1] - target[i]) * (pos - i)

    by_season = defaultdict(list)
    for (pid, s) in season_row:
        v, src, era = carried(pid, s)
        if v is not None:
            by_season[s].append((v, pid, src, era))
    rows, counts, rank_of = [], Counter(), {}
    for s, lst in by_season.items():
        lst.sort(key=lambda x: -x[0])
        scale = 30 / max(1, teams_in.get(s, 30))
        for r_i, (v, pid, src, era) in enumerate(lst):
            ovr = int(round(overall_at(r_i * scale)))
            rows.append({'p': pid, 's': s, 'ovr': ovr, 'src': src})
            rank_of[(pid, s)] = r_i + 1
            counts[f'{src} ({era})'] += 1

    # ---- sanity checks against real honours (facts): where did award winners of season S-1 rank going into S?
    def median(xs): return float(np.median(xs)) if xs else float('nan')
    mvp_ranks = [rank_of[(a['p'], a['s'] + 1)] for a in awards if a['a'] == 'mvp' and a['win'] and (a['p'], a['s'] + 1) in rank_of]
    first_team = [rank_of[(a['p'], a['s'] + 1)] for a in team_awards if a['a'] == 'allLeague' and a['rank'] == 1 and a['lg'] in NBA and (a['p'], a['s'] + 1) in rank_of]
    method = {
        'description': 'Court Vision Overall from statistics only: each season, players are ranked by value over replacement per game '
                       '(Box Plus/Minus from 1973-74; estimated from PER and WS/48 for 1951-52 to 1972-73, and from win shares, points and '
                       'assists for 1946-47 to 1950-51), and the Nth best receives the Nth best Overall of a generated 30-team Court Vision league. '
                       'The rating for a season comes from the season before (debuts use their own season).',
        'bpmFromPerWs48': {'coef': [round(float(c), 4) for c in coef_b], 'n': len(yb), 'correlation': round(corr_b, 3)},
        'valueFromWsPtsAst': {'coef': [round(float(c), 4) for c in coef_c], 'n': len(yc), 'correlation': round(corr_c, 3)},
        'validation': {'mvpMedianRankNextSeason': median(mvp_ranks), 'allNbaFirstTeamMedianRankNextSeason': median(first_team),
                       'mvpTop5Share': round(sum(1 for r in mvp_ranks if r <= 5) / max(1, len(mvp_ranks)), 3)},
        'distribution': dist['generator'],
    }
    report.append(f"Ratings: {len(rows)} player-seasons from statistics only ({', '.join(f'{k} {v}' for k, v in sorted(counts.items()))})")
    report.append(f"Rating check: MVPs rank #{median(mvp_ranks):.0f} (median) going into the next season, {method['validation']['mvpTop5Share']*100:.0f}% in the top 5; "
                  f"All-NBA First Team players rank #{median(first_team):.0f} (median)")
    report.append(f"BPM estimated from PER and WS/48 (1951-52 to 1972-73): r = {corr_b:.2f} on {len(yb)} later seasons; "
                  f"early-era value from WS, points and assists (1946-47 to 1950-51): r = {corr_c:.2f} on {len(yc)} later seasons")
    return {'rows': rows, 'method': method, 'counts': dict(counts)}


def region_names(teams):
    """City/region names instead of official team names ("Golden State", "Seattle", "LA"), unique within each season."""
    TWO_WORD = ('Trail Blazers', 'Red Skins')
    SPECIAL = {'Spirits of St. Louis': 'St. Louis', 'The Floridians': 'Florida'}
    def region(name):
        if name in SPECIAL:
            return SPECIAL[name]
        for nick in TWO_WORD:
            if name.endswith(' ' + nick):
                return name[: -len(nick) - 1]
        return name.rsplit(' ', 1)[0] if ' ' in name else name
    by_season = defaultdict(list)
    first_year = {}
    for t in teams:
        first_year[t['ab']] = min(first_year.get(t['ab'], t['s']), t['s'])
    for t in teams:
        t['region'] = region(t['name'])
        by_season[(t['s'], t['lg'] in ('BAA', 'NBA'))].append(t)
    clashes = []
    for (s, _), ts in by_season.items():
        seen = defaultdict(list)
        for t in ts:
            seen[t['region']].append(t)
        for reg, same in seen.items():
            if len(same) < 2:
                continue
            if any(t['ab'] == 'LAC' for t in same):
                for t in same:
                    if t['ab'] == 'LAC':
                        t['region'] = 'LA'  # the Clippers' own short form; the older franchise keeps "Los Angeles"
            else:
                same.sort(key=lambda t: first_year[t['ab']])  # the longest-standing team keeps the plain city name
                for t in same[1:]:
                    t['region'] = f"{reg} ({t['ab']})"
            clashes.append(f"{s}: " + ' / '.join(t['region'] for t in same))
    return clashes


# Structural limits of the data, shipped in the manifest (shown in the game's NBA History → Coverage) and COVERAGE.md.
KNOWN_GAPS = [
    'Player playoff statistics: not in the source. Imported seasons show no playoff lines.',
    'Early-era stats: steals and blocks are recorded from 1973-74, turnovers from 1977-78, 3-pointers from 1979-80, minutes from 1951-52, '
    'offensive/defensive rebounds from 1973-74 (total rebounds from 1950-51). Unrecorded values show as "—", never as 0.',
    'Opening-night rosters: not available. Starting rosters are reconstructed from each player\'s first team of the chosen season.',
    'Game highs, double-double counts and shot locations for imported seasons: not imported (triple-doubles only where the source counts them).',
    'Conference Finals MVP, sportsmanship, teammate, hustle and citizenship awards, weekly/monthly awards, contest winners and stat titles: not imported.',
    'Ratings: every Overall is Court Vision\'s own estimate from statistics (no video-game or publisher ratings are used). They measure box-score production, so defence-first players and seasons before box plus/minus (1973-74) are less certain.',
    'Skill attributes (shooting, passing, defense, athleticism) for every real player are estimated from statistics; only height, weight and age are real.',
    'Team names: only city/region names are included (e.g. "Golden State", "Seattle"); players can type their own team names in the game.',
    'Contracts, coaches, budgets, schedules and game rules in a historical league are generated by Court Vision, not historical.',
    'Championship roster credit is inferred: players whose last regular-season team won the title (traded-away players are excluded).',
    'Conference/division alignment uses today\'s NBA alignment (exact from 2004-05 on).',
]


def write_coverage(out, report, gaps, ratings):
    m = out['manifest']
    lines = ['# NBA history dataset — coverage report', '', f"Dataset `{m['dataset']}`, built {m['builtAt']}. Seasons are END years in the data "
             '(2016 = 2015-16); the game shows start years ("start 2016" = opening of 2016-17).', '',
             '## Sources', '']
    for s in m['sources']:
        lines.append(f"- **{s['name']}** — {s['url']}" + (f" (commit {s['commit']})" if s.get('commit') else '') + f". License/terms: {s['license']}")
    lines += ['', '## Validation', ''] + [f'- {r}' for r in report]
    lines += ['', '## What is covered', '',
              '- Regular-season player totals 1946-47 → 2025-26 (BAA/NBA; ABA seasons kept separately and labelled), with per-team stints and one aggregate row for traded players.',
              '- Advanced (PER, TS%, rebound/assist/steal/block/turnover/usage rates, win shares, BPM, VORP) where the source computes them.',
              '- Biographies (birth date, height, weight, position, college), first/last season, debut date, Hall of Fame flag, draft year/round/pick/team.',
              '- Team seasons (under city/region names) with records, ratings, pace, SRS and playoff qualification; franchise lineage (e.g. SEA→OKC, NJN→BRK, CHH/CHA→CHO).',
              '- Awards with voting shares: MVP, DPOY, ROY, 6MOY, MIP, Clutch POY; All-NBA/BAA, All-Defensive and All-Rookie teams with rank; All-Star selections.',
              '- Champions, runners-up and series results; Finals MVP (1968-69+); All-Star Game MVP (1951+); Coach of the Year (1962-63+), from nba.com.',
              '', '## Known gaps (not included — never fabricated)', ''] + [f'- {g}' for g in KNOWN_GAPS] + [
              '', '## Ratings (Court Vision\'s own, from statistics only)', '']
    meth = ratings['method']
    lines.append(f"- {meth['description']}")
    lines.append(f"- BPM from PER and WS/48 (1951-52 to 1972-73): coefficients {meth['bpmFromPerWs48']['coef']}, fitted on {meth['bpmFromPerWs48']['n']} seasons from 1973-74 on, r = {meth['bpmFromPerWs48']['correlation']}.")
    lines.append(f"- Early-era value from win shares, points and assists (1946-47 to 1950-51): coefficients {meth['valueFromWsPtsAst']['coef']}, fitted on {meth['valueFromWsPtsAst']['n']} later seasons, r = {meth['valueFromWsPtsAst']['correlation']}.")
    v = meth['validation']
    lines.append(f"- Check against real honours: MVPs rank #{v['mvpMedianRankNextSeason']:.0f} (median) in the next season's ratings ({v['mvpTop5Share']*100:.0f}% in the top 5); All-NBA First Team players #{v['allNbaFirstTeamMedianRankNextSeason']:.0f}.")
    lines.append(f"- Target distribution: {meth['distribution']} (sources/cv_overall_distribution.json).")
    lines += ['', '## Warnings from the build', ''] + ([f'- {g}' for g in gaps] or ['- none'])
    with open(os.path.join(HERE, 'COVERAGE.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
