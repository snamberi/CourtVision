import type { NbaHistory, HistSeasonRow, HistTeamSeason } from '../history/nbaHistoryData';
import { realJerseyNumber } from '../history/jerseyNumbers';
import { heightLabel } from './facts';
import { RNG } from '../simulation/engine/rng';

/*
 * Guess the Team: a real starting five on the court, names hidden, and one clue under each (that season's averages,
 * his totals, an award, his jersey, his age, his career...). The season is shown. Name the team in a few tries; a
 * wrong guess turns over a second clue for everyone.
 */

export type GuessTeamLevel = 'easy' | 'normal' | 'hard';
export const GUESS_TEAM_ERAS = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
export const GUESS_TEAM_TRIES: Record<GuessTeamLevel, number> = { easy: 4, normal: 3, hard: 2 };

export type ClueKind = 'seasonAvg' | 'seasonTotal' | 'award' | 'peak' | 'careerAvg' | 'jersey' | 'age' | 'careerLength' | 'teams' | 'draft' | 'college' | 'height';
export interface Clue { kind: ClueKind; label: string; text: string }
export interface MysteryStarter { playerId: string; name: string; pos: string; clues: Clue[] }
export interface GuessTeamPuzzle {
  seed: number; level: GuessTeamLevel;
  /** END year of the season (2016 = 2015-16), shown as the season. */
  season: number; abbr: string; franchise: string; teamName: string; record: string;
  starters: MysteryStarter[];
  /** Every team that played that season, for the answer list. */
  choices: { abbr: string; name: string }[];
}

const NBA = new Set(['NBA', 'BAA']);
/** Nicknames by the season's team code, so two teams from one city (the Lakers and the Clippers) never look alike. */
const NICK: Record<string, string> = {
  AND: 'Packers', ATL: 'Hawks', BAL: 'Bullets', BLB: 'Bullets', BOS: 'Celtics', BRK: 'Nets', BUF: 'Braves', CAP: 'Bullets', CHA: 'Bobcats', CHH: 'Hornets',
  CHI: 'Bulls', CHO: 'Hornets', CHP: 'Packers', CHS: 'Stags', CHZ: 'Zephyrs', CIN: 'Royals', CLE: 'Cavaliers', CLR: 'Rebels', DAL: 'Mavericks', DEN: 'Nuggets',
  DET: 'Pistons', DNN: 'Nuggets', DTF: 'Falcons', FTW: 'Pistons', GSW: 'Warriors', HOU: 'Rockets', IND: 'Pacers', INJ: 'Jets', INO: 'Olympians', KCK: 'Kings',
  KCO: 'Kings', LAC: 'Clippers', LAL: 'Lakers', MEM: 'Grizzlies', MIA: 'Heat', MIL: 'Bucks', MIN: 'Timberwolves', MLH: 'Hawks', MNL: 'Lakers', NJN: 'Nets',
  NOH: 'Hornets', NOJ: 'Jazz', NOK: 'Hornets', NOP: 'Pelicans', NYK: 'Knicks', NYN: 'Nets', OKC: 'Thunder', ORL: 'Magic', PHI: '76ers', PHO: 'Suns',
  PHW: 'Warriors', PIT: 'Ironmen', POR: 'Trail Blazers', PRO: 'Steamrollers', ROC: 'Royals', SAC: 'Kings', SAS: 'Spurs', SDC: 'Clippers', SDR: 'Rockets',
  SEA: 'SuperSonics', SFW: 'Warriors', SHE: 'Red Skins', STB: 'Bombers', STL: 'Hawks', SYR: 'Nationals', TOR: 'Raptors', TRH: 'Huskies', TRI: 'Blackhawks',
  UTA: 'Jazz', VAN: 'Grizzlies', WAS: 'Wizards', WAT: 'Hawks', WSB: 'Bullets', WSC: 'Capitols',
};
/** "Los Angeles Lakers", "Seattle SuperSonics": the city as the data has it plus that season's nickname. */
export const fullTeamName = (t: Pick<HistTeamSeason, 'abbr' | 'name'>) => { const city = t.name.replace(/ \(.*\)$/, ''); return NICK[t.abbr] ? `${city} ${NICK[t.abbr]}` : city; };
const seasonLabel = (end: number) => `${end - 1}-${String(end).slice(2)}`;
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Clues each level leans on: easy ones read like a box score, hard ones are trivia. */
const KINDS: Record<GuessTeamLevel, ClueKind[]> = {
  easy: ['seasonAvg', 'award', 'peak', 'careerAvg', 'seasonTotal', 'draft'],
  normal: ['seasonAvg', 'seasonTotal', 'award', 'peak', 'careerAvg', 'draft', 'careerLength', 'teams', 'jersey', 'college'],
  hard: ['jersey', 'age', 'careerLength', 'teams', 'college', 'height', 'draft', 'seasonTotal', 'peak'],
};

function teamSeasonsFor(h: NbaHistory, eras: number[], level: GuessTeamLevel): HistTeamSeason[] {
  const inEra = (end: number) => eras.some(d => end - 1 >= d && end - 1 < d + 10);
  return h.teams.filter(t => NBA.has(t.league) && inEra(t.season) && t.w != null && t.l != null && (
    level === 'easy' ? t.playoffs && t.w! / Math.max(1, t.w! + t.l!) >= 0.55
      : level === 'normal' ? t.w! / Math.max(1, t.w! + t.l!) >= 0.4
        : true));
}

/** The five who started most (then played most) for a team that season. */
function startersOf(h: NbaHistory, t: HistTeamSeason): HistSeasonRow[] {
  return h.seasons.filter(r => r.season === t.season && r.team === t.abbr && !r.isAggregate && (r.stats.g ?? 0) >= 15)
    .sort((a, b) => (b.stats.gs ?? 0) - (a.stats.gs ?? 0) || (b.stats.mp ?? 0) - (a.stats.mp ?? 0)).slice(0, 5);
}

/** Every clue we can write for one starter (kinds without data are left out). */
export function cluesFor(h: NbaHistory, r: HistSeasonRow, t: HistTeamSeason): Clue[] {
  const p = h.players[r.player] ?? h.players.find(x => x.idx === r.player);
  if (!p) return [];
  const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(x => NBA.has(x.league));
  const whole = rows.filter(x => x.isAggregate || !rows.some(y => y.season === x.season && y.isAggregate));
  const s = r.stats, g = Math.max(1, s.g ?? 1), season = seasonLabel(t.season);
  const out: Clue[] = [];
  if (s.pts != null) out.push({ kind: 'seasonAvg', label: `${season} averages`, text: `${one(s.pts / g)} PPG${s.trb != null ? ` · ${one(s.trb / g)} RPG` : ''}${s.ast != null ? ` · ${one(s.ast / g)} APG` : ''}` });
  if (s.pts != null) out.push({ kind: 'seasonTotal', label: `${season} totals`, text: `${s.pts.toLocaleString()} points in ${s.g} games` });
  const honors = [
    ...h.awards.filter(a => a.player === p.idx && a.season === t.season && a.winner).map(a => a.award.toUpperCase()),
    ...h.teamAwards.filter(a => a.player === p.idx && a.season === t.season && a.award === 'allLeague').map(a => `All-NBA ${a.rank ?? ''}${a.rank === 1 ? 'st' : a.rank === 2 ? 'nd' : a.rank === 3 ? 'rd' : ''} Team`.replace('  ', ' ')),
    ...(h.allStars.some(a => a.player === p.idx && a.season === t.season) ? ['All-Star'] : []),
  ];
  if (honors.length) out.push({ kind: 'award', label: `${season} honors`, text: honors.join(', ') });
  const ppg = (x: HistSeasonRow) => (x.stats.pts ?? 0) / Math.max(1, x.stats.g ?? 1);
  const peak = [...whole].filter(x => (x.stats.g ?? 0) >= 20 && x.stats.pts != null).sort((a, b) => ppg(b) - ppg(a))[0];
  if (peak) out.push({ kind: 'peak', label: 'Career-best season', text: `${one(ppg(peak))} PPG in ${seasonLabel(peak.season)}` });
  const gTot = whole.reduce((n, x) => n + (x.stats.g ?? 0), 0), ptsTot = whole.reduce((n, x) => n + (x.stats.pts ?? 0), 0);
  const trbTot = whole.reduce((n, x) => n + (x.stats.trb ?? 0), 0);
  if (gTot) out.push({ kind: 'careerAvg', label: 'Career averages', text: `${one(ptsTot / gTot)} PPG · ${one(trbTot / gTot)} RPG over ${gTot.toLocaleString()} games` });
  const jersey = realJerseyNumber(p.id, t.abbr, t.season);
  if (jersey != null) out.push({ kind: 'jersey', label: `Jersey in ${season}`, text: `#${jersey}` });
  if (r.age != null) out.push({ kind: 'age', label: `Age in ${season}`, text: `${r.age} years old` });
  const seasonsPlayed = new Set(rows.map(x => x.season)).size;
  if (seasonsPlayed) out.push({ kind: 'careerLength', label: 'Career length', text: `${seasonsPlayed} NBA season${seasonsPlayed === 1 ? '' : 's'}${p.firstSeason ? ` (${p.firstSeason - 1}–${String(p.lastSeason ?? p.firstSeason).slice(2)})` : ''}` });
  const teams = new Set(rows.filter(x => !x.isAggregate).map(x => x.team)).size;
  if (teams) out.push({ kind: 'teams', label: 'Teams in his career', text: `${teams} team${teams === 1 ? '' : 's'}` });
  out.push({ kind: 'draft', label: 'Draft', text: p.draft ? (p.draft.pick ? `No. ${p.draft.pick} pick in ${p.draft.year}` : `Drafted in ${p.draft.year}`) : 'Undrafted' });
  if (p.college) out.push({ kind: 'college', label: 'College', text: p.college });
  if (p.heightIn) out.push({ kind: 'height', label: 'Size', text: `${heightLabel(p.heightIn)}${p.pos ? ` · ${p.pos}` : ''}` });
  return out;
}

/** A puzzle from a seed. `eras` are decades by their first season's start (1990 = 1990-91 to 1999-00). */
export function guessTeamPuzzle(h: NbaHistory, seed: number, level: GuessTeamLevel = 'normal', eras: number[] = [...GUESS_TEAM_ERAS]): GuessTeamPuzzle {
  const rng = new RNG(seed);
  const pool = teamSeasonsFor(h, eras.length ? eras : [...GUESS_TEAM_ERAS], level);
  if (!pool.length) throw new Error('No seasons in those eras');
  for (let attempt = 0; attempt < 60; attempt++) {
    const t = pool[Math.floor(rng.next() * pool.length)];
    const rows = startersOf(h, t);
    if (rows.length < 5) continue;
    const order = [...KINDS[level]].sort(() => rng.next() - 0.5);
    const used = new Set<ClueKind>();
    const starters: MysteryStarter[] = [];
    for (const r of rows) {
      const all = cluesFor(h, r, t);
      // One clue per player, a different kind for each of the five where possible; a second one kept for the hint.
      const first = order.map(k => all.find(c => c.kind === k)).find(c => c && !used.has(c.kind)) ?? all.find(c => KINDS[level].includes(c.kind)) ?? all[0];
      if (!first) break;
      used.add(first.kind);
      const second = all.find(c => c.kind !== first.kind && KINDS[level].includes(c.kind)) ?? all.find(c => c.kind !== first.kind);
      const p = h.players[r.player] ?? h.players.find(x => x.idx === r.player)!;
      starters.push({ playerId: p.id, name: p.displayName, pos: r.pos ?? p.pos ?? '', clues: second ? [first, second] : [first] });
    }
    if (starters.length < 5) continue;
    const choices = h.teams.filter(x => x.season === t.season && NBA.has(x.league)).map(x => ({ abbr: x.abbr, name: fullTeamName(x) })).sort((a, b) => a.name.localeCompare(b.name));
    return { seed, level, season: t.season, abbr: t.abbr, franchise: t.franchise ?? t.abbr, teamName: fullTeamName(t), record: `${t.w}-${t.l}`, starters, choices };
  }
  throw new Error('Could not build a Guess the Team puzzle');
}

export const seasonText = (end: number) => seasonLabel(end);
