import { useMemo, useState } from 'react';
import { UnanimousTag } from './UnanimousTag';
import type { League } from '../simulation/league';
import { hasConferenceStructure } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { awardOptions, computeSeasonAwards, type AwardWinner } from '../simulation/awards';
import { almanacSeason, almanacSeasons, voteRows, isUnanimous, CEREMONY_ORDER, type LeaderBoard } from '../simulation/almanac';
import { finalsMVPLine } from '../simulation/awards';
import { PixelTrophy } from './PixelTrophy';
import { ChampionshipCelebration, type CelebrationInfo } from './ChampionshipCelebration';
import type { TrophyKey } from '../simulation/trophies';
import { formatSeasonYear } from '../simulation/calendar';
import type { AwardSettings } from './LeagueSettingsPage';
import { PlayoffBracketView } from './PlayoffBracketView';
import { AwardsNight } from './AwardsNight';
import { PlayerNameTag } from './PlayerAvatar';
import { TeamLink } from './TeamLink';
import { TeamLogo } from './TeamLogo';
import { fx } from './statFormat';

const fmt = (v: number, f: LeaderBoard['format']) => f === 'int' ? Math.round(v).toString() : f === 'dec3' ? v.toFixed(3) : v.toFixed(1);
const FINISH_SHORT: Record<string, string> = { Champion: 'Champion', Finals: 'Finals', 'Conference Finals': 'Conf. Finals', 'Second Round': '2nd Round', 'First Round': '1st Round', 'Play-In': 'Play-In', Playoffs: 'Playoffs', 'Missed Playoffs': '—' };

/** One page per season: champion, awards with vote shares, playoff bracket, standings and stat leaders. */
export function AlmanacPage({ league, extras, awardSettings, onSelectPlayer }: { league: League; extras?: GMLeagueExtras; awardSettings: AwardSettings; onSelectPlayer: (id: string) => void }) {
  const seasons = useMemo(() => almanacSeasons(league), [league]);
  const [season, setSeason] = useState<string | null>(null);
  const active = season && seasons.includes(season) ? season : seasons[0] ?? null;
  const entry = useMemo(() => active ? almanacSeason(league, extras, active, () => computeSeasonAwards(league, awardOptions(awardSettings))) : null, [league, extras, active, awardSettings]);
  const [selected, setSelected] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [celebrate, setCelebrate] = useState<CelebrationInfo | null>(null);
  const team = (id: string | null | undefined) => league.teams.find(t => t.teamId === id);
  const conferences = hasConferenceStructure(league);
  const archived = !!entry?.standings.some(r => r.finish);
  const imported = !!entry && !!league.franchiseHistory?.find(r => r.season === entry.season)?.imported;

  if (!seasons.length || !entry) return <div className="almanac-page"><span className="pixel-eyebrow">LEAGUE ALMANAC</span><h2>Almanac</h2><p className="empty-state">Play some games and each season gets its own almanac page.</p></div>;
  const champ = team(entry.championTeamId);
  const record = league.franchiseHistory?.find(r => r.season === entry.season);
  // The live Finals (this season) have series stats; archived seasons keep the Finals MVP's name.
  const liveFinals = !record && league.playoffBracket?.championTeamId ? finalsMVPLine(league.playoffBracket.rounds.at(-1)?.[0], league) : null;
  const fmvpId = entry.fmvpPlayerId ?? liveFinals?.winner.playerId ?? null;
  const fmvpTeam = entry.championTeamId;
  const fmvpInfo = fmvpId ? { playerId: fmvpId, teamId: fmvpTeam, teamName: champ?.name ?? '',
    line: liveFinals ? `Finals: ${liveFinals.ppg.toFixed(1)} points, ${liveFinals.rpg.toFixed(1)} rebounds and ${liveFinals.apg.toFixed(1)} assists a game over ${liveFinals.games} games` : undefined } : null;
  const canCelebrate = !!champ && !imported && (!record || !!record.championPlayerIds?.length);
  const award = (key: string): AwardWinner | null => (entry.awards as unknown as Record<string, AwardWinner | null> | null)?.[key] ?? null;
  const groups = conferences
    ? (['east', 'west'] as const).map(c => ({ label: c === 'east' ? 'Eastern Conference' : 'Western Conference', rows: entry.standings.filter(r => team(r.teamId)?.conferenceId === c) })).filter(g => g.rows.length)
    : [{ label: 'League', rows: entry.standings }];

  return <div className="almanac-page">
    <div className="almanac-head">
      <div><span className="pixel-eyebrow">LEAGUE ALMANAC{imported && <span className="origin-tag real">Real NBA · imported</span>}</span><h2>{formatSeasonYear(entry.season)} Season{entry.inProgress && <small className="hint-text"> · in progress</small>}</h2></div>
      <label className="almanac-season-select">Season <select value={active ?? ''} onChange={e => { setSeason(e.target.value); setSelected(null); }}>
        {seasons.map(s => <option key={s} value={s}>{formatSeasonYear(s)}</option>)}</select></label>
    </div>

    <section className="almanac-banner">
      {champ ? <div className="almanac-champ"><TeamLogo team={champ} size={56} /><div><small>CHAMPIONS</small><b><TeamLink teamId={champ.teamId} name={champ.name} /></b>
        {entry.fmvpPlayerId && <span className="hint-text">Finals MVP: <button className="link-button" onClick={() => onSelectPlayer(entry.fmvpPlayerId!)}>{entry.fmvpPlayerId}</button></span>}</div></div>
        : <div className="almanac-champ"><div><small>CHAMPIONS</small><b>{entry.inProgress ? 'To be decided' : '—'}</b></div></div>}
      <div className="almanac-banner-actions">
        {canCelebrate && <button onClick={() => setCelebrate({ teamId: champ!.teamId, season: entry.season, fmvpId, playerIds: record?.championPlayerIds })}>Replay celebration</button>}
        {entry.awards && <button className="primary" onClick={() => setNight(true)}>{entry.inProgress ? 'Preview Awards Night' : 'Replay Awards Night'}</button>}
      </div>
    </section>

    {entry.awards && <section className="almanac-section"><h4>Awards{entry.inProgress && <small className="hint-text"> · current race</small>}</h4>
      <div className="almanac-awards">{CEREMONY_ORDER.slice().reverse().map(a => {
        const w = award(a.key); if (!w) return null;
        const vote = voteRows(entry.awards!, a.key, entry.season)[0];
        return <div key={a.key} className="almanac-award"><small><PixelTrophy award={a.key as TrophyKey} size={16} /> {a.label}</small>
          <button className="prospect-name" onClick={() => onSelectPlayer(w.playerId)}><PlayerNameTag playerId={w.playerId} teamId={w.teamId} size={26} /></button>
          {vote?.unanimous && vote.playerId === w.playerId && <UnanimousTag compact />}
          {vote && vote.playerId === w.playerId && <span className="hint-text">{(vote.share * 100).toFixed(1)}% share · {vote.first} first-place{vote.real ? ' (real voting)' : vote.estimated ? ' (estimated)' : ''}</span>}
          {(entry.awards!.coWinners?.[a.key as keyof NonNullable<typeof entry.awards.coWinners>] ?? []).map(c => <span key={c.playerId} className="hint-text">Shared with <button className="link-button" onClick={() => onSelectPlayer(c.playerId)}>{c.playerId}</button></span>)}</div>;
      })}
      {entry.awards.coy && <div className="almanac-award"><small><PixelTrophy award="coy" size={16} /> Coach of the Year</small><b>{entry.awards.coy.coachName ?? entry.awards.coy.teamName}</b>{isUnanimous(entry.awards, 'coy', entry.season) && <UnanimousTag compact />}<span className="hint-text">{entry.awards.coy.teamName}</span></div>}
      {entry.awards.eoy && <div className="almanac-award"><small><PixelTrophy award="eoy" size={16} /> Executive of the Year</small><b>{entry.awards.eoy.userTeam ? 'Your front office' : `${entry.awards.eoy.teamName}`}</b>{isUnanimous(entry.awards, 'eoy', entry.season) && <UnanimousTag compact />}<span className="hint-text">{entry.awards.eoy.detail ? `${entry.awards.eoy.detail.wins}–${entry.awards.eoy.detail.losses}` : ''}</span></div>}
      </div>
      {([['All-League', entry.awards.allNBA], ['All-Defensive', entry.awards.allDefense], ['All-Rookie', entry.awards.allRookie]] as const).map(([label, teams]) => teams?.some(t => t.length) ? <div key={label} className="almanac-teams">
        <b>{label}</b>{teams.map((t, i) => <p key={i}><small>{['1st', '2nd', '3rd'][i]}</small>{t.map(w => <button key={w.playerId} className="link-button" onClick={() => onSelectPlayer(w.playerId)}>{w.playerId}</button>)}</p>)}
      </div> : null)}
    </section>}

    {entry.bracket && <section className="almanac-section"><h4>Playoffs</h4>
      <PlayoffBracketView league={league} bracket={entry.bracket} seeds={entry.seeds} season={entry.season} selectedId={selected} onSelect={setSelected} />
    </section>}

    <section className="almanac-section"><h4>Final standings{entry.inProgress && ' (so far)'}</h4>
      <div className="almanac-standings">{groups.map(g => <div key={g.label} className="finances-table-wrap"><table className="db-table">
        <thead><tr><th colSpan={2}>{g.label}</th><th>W</th><th>L</th><th>PCT</th>{archived && <><th>ORtg</th><th>DRtg</th><th>Finish</th></>}</tr></thead>
        <tbody>{g.rows.map((r, i) => <tr key={r.teamId} className={r.teamId === entry.championTeamId ? 'almanac-champ-row' : ''}>
          <td>{i + 1}</td><td><TeamLink teamId={r.teamId} name={r.teamName} /></td><td>{r.wins}</td><td>{r.losses}</td>
          <td>{(r.wins / Math.max(1, r.wins + r.losses)).toFixed(3).replace(/^0/, '')}</td>
          {archived && <><td>{fx(r.ortg)}</td><td>{fx(r.drtg)}</td><td>{r.finish ? FINISH_SHORT[r.finish] ?? r.finish : '—'}</td></>}
        </tr>)}</tbody></table></div>)}</div>
    </section>

    {imported ? <section className="almanac-section"><h4>Stat leaders</h4><p className="hint-text">This is a real NBA season from before the league started. Its complete player statistics — including players who retired before the start — are in NBA History. Standings use today's conference alignment.</p></section>
    : <section className="almanac-section"><h4>Stat leaders</h4>
      <div className="almanac-leaders">{entry.leaders.map(b => <div key={b.key} className="almanac-leader"><b>{b.label}</b>
        <ol>{b.rows.map(r => <li key={r.playerId}><button className="link-button" onClick={() => onSelectPlayer(r.playerId)}>{r.playerId}</button><span>{fmt(r.value, b.format)}</span></li>)}</ol>
        {!b.rows.length && <p className="hint-text">No qualifiers.</p>}</div>)}</div>
    </section>}

    {celebrate && <ChampionshipCelebration league={league} info={celebrate} onClose={() => setCelebrate(null)} onSelectPlayer={id => { setCelebrate(null); onSelectPlayer(id); }} />}
    {night && entry.awards && <AwardsNight league={league} extras={extras} awards={entry.awards} season={entry.season} fmvp={fmvpInfo} onSelectPlayer={id => { setNight(false); onSelectPlayer(id); }} onClose={() => setNight(false)} />}
  </div>;
}
