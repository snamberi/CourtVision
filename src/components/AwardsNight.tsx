import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fx } from './statFormat';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardBallotKey, AwardWinner, SeasonAwards, StatSnapshot, TeamAwardWinner, VotedAwardKey } from '../simulation/awards';
import { voteRows, type VoteRow } from '../simulation/almanac';
import { formatSeasonYear } from '../simulation/calendar';
import { TROPHIES, type TrophyKey } from '../simulation/trophies';
import { PlayerAvatar, PlayerNameTag } from './PlayerAvatar';
import { PixelTrophy } from './PixelTrophy';
import { TeamLogo } from './TeamLogo';

/* Awards Night: a stage show. Each award gets its nominees, an envelope, the trophy rising and the
 * winner in the spotlight, then a "why he won" card and the panel's vote. Minor awards and stat titles
 * come first, team selections in between, Finals MVP and MVP close the show. */

interface Nominee { id: string; teamId: string | null; teamName: string }
type Step =
  | { kind: 'intro' }
  | { kind: 'award'; id: string; trophy: TrophyKey; label: string; team: boolean; voteKey?: VotedAwardKey | AwardBallotKey;
      winners: Nominee[]; nominees: Nominee[]; coach?: string | null; blurb?: string }
  | { kind: 'medals'; id: string; label: string; items: { trophy: TrophyKey; label: string; winner: AwardWinner; value?: string }[] }
  | { kind: 'teams'; id: string; label: string; trophies: TrophyKey[]; teams: AwardWinner[][]; voteKey: VotedAwardKey }
  | { kind: 'outro' };

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const place = (i: number) => ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`;

function playerSeasonLine(league: League, extras: GMLeagueExtras | undefined, playerId: string, season: string): StatSnapshot | null {
  const p = league.teams.flatMap(t => t.seasons).find(s => s.playerId === playerId) ?? extras?.freeAgents.find(s => s.playerId === playerId)
    ?? league.retiredPlayers?.find(r => r.playerId === playerId)?.finalSeasonData;
  if (!p) return null;
  const archived = p.careerHistory?.find(h => h.season === season);
  const st = archived?.stats ?? (season === league.season ? p.seasonStats : undefined);
  if (!st || st.gamesPlayed === 0) return null;
  const g = st.gamesPlayed, r = (v: number) => Math.round(v / g * 10) / 10;
  return { gp: g, pts: r(st.points), reb: archived?.missing?.includes('dreb') ? NaN : r(st.oreb + st.dreb), ast: r(st.ast), stl: r(st.stl), blk: r(st.blk),
    ...(archived?.advanced ? { ws: archived.advanced.ws, dws: archived.advanced.dws } : {}), w: NaN, l: NaN };
}

function nomineeFromWinner(w: AwardWinner): Nominee { return { id: w.playerId, teamId: w.teamId, teamName: w.teamName }; }

function buildSteps(awards: SeasonAwards, fmvp: AwardsNightProps['fmvp']): Step[] {
  const out: Step[] = [{ kind: 'intro' }];
  const rowsOf = (key: AwardBallotKey) => awards.ballots?.[key] ?? [];
  const player = (key: AwardBallotKey & VotedAwardKey, trophy: TrophyKey) => {
    const winner = (awards as unknown as Record<string, AwardWinner | null | undefined>)[key];
    if (!winner) return;
    const co = awards.coWinners?.[key] ?? [];
    const ballot = rowsOf(key);
    out.push({ kind: 'award', id: key, trophy, label: TROPHIES[trophy].label, team: false, voteKey: key,
      winners: [winner, ...co].map(nomineeFromWinner), nominees: (ballot.length ? ballot : [winner]).slice(0, 3).map(nomineeFromWinner) });
  };
  const team = (key: 'coy' | 'eoy', trophy: TrophyKey, w: TeamAwardWinner | null | undefined) => {
    if (!w) return;
    const lines = awards.votes?.[key]?.lines ?? [];
    const nominees = lines.length ? lines.slice(0, 3).map(l => ({ id: l.id, teamId: l.teamId, teamName: l.teamName })) : [{ id: w.teamId, teamId: w.teamId, teamName: w.teamName }];
    out.push({ kind: 'award', id: key, trophy, label: TROPHIES[trophy].label, team: true, voteKey: key, winners: [{ id: w.teamId, teamId: w.teamId, teamName: w.teamName }],
      nominees, coach: key === 'coy' ? w.coachName ?? null : w.userTeam ? 'Your front office' : `${w.teamName} front office` });
  };

  const titles = ([['scoringChamp', 'PPG'], ['reboundingChamp', 'RPG'], ['assistsChamp', 'APG'], ['stealsChamp', 'SPG'], ['blocksChamp', 'BPG']] as const)
    .map(([k, unit]) => { const w = awards[k]; return w ? { trophy: k as TrophyKey, label: TROPHIES[k].label, winner: w, value: `${w.score.toFixed(1)} ${unit}` } : null; })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (titles.length) out.push({ kind: 'medals', id: 'titles', label: 'Statistical Champions', items: titles });
  const minor = (['hustle', 'teammate', 'sharpshooter', 'floorGeneral', 'paintScorer', 'ironMan', 'rookieDefender'] as const)
    .map(k => { const w = awards[k]; return w ? { trophy: k as TrophyKey, label: TROPHIES[k].label, winner: w } : null; })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (minor.length) out.push({ kind: 'medals', id: 'minor', label: 'The Specialists', items: minor });
  if (awards.allRookie?.some(t => t.length)) out.push({ kind: 'teams', id: 'allRookie', label: 'All-Rookie Teams', trophies: ['allRookie1', 'allRookie2'], teams: awards.allRookie, voteKey: 'allRookie' });
  if (awards.allDefense?.some(t => t.length)) out.push({ kind: 'teams', id: 'allDefense', label: 'All-Defensive Teams', trophies: ['allDefense1', 'allDefense2'], teams: awards.allDefense, voteKey: 'allDefense' });
  player('mip', 'mip');
  player('smoy', 'smoy');
  player('roy', 'roy');
  player('cpoy', 'cpoy');
  player('dpoy', 'dpoy');
  team('coy', 'coy', awards.coy);
  team('eoy', 'eoy', awards.eoy);
  if (awards.allNBA?.some(t => t.length)) out.push({ kind: 'teams', id: 'allNBA', label: 'All-League Teams', trophies: ['allLeague1', 'allLeague2', 'allLeague3'], teams: awards.allNBA, voteKey: 'allNBA' });
  if (fmvp) out.push({ kind: 'award', id: 'fmvp', trophy: 'fmvp', label: 'Finals MVP', team: false, winners: [{ id: fmvp.playerId, teamId: fmvp.teamId, teamName: fmvp.teamName }],
    nominees: [{ id: fmvp.playerId, teamId: fmvp.teamId, teamName: fmvp.teamName }], blurb: fmvp.line });
  player('mvp', 'mvp');
  out.push({ kind: 'outro' });
  return out;
}

export interface AwardsNightProps {
  league: League; extras?: GMLeagueExtras; awards: SeasonAwards; season: string;
  /** Finals MVP, when the season's Finals are over. */
  fmvp?: { playerId: string; teamId: string | null; teamName: string; line?: string } | null;
  onSelectPlayer: (id: string) => void; onClose: () => void;
}

export function AwardsNight({ league, extras, awards, season, fmvp, onSelectPlayer, onClose }: AwardsNightProps) {
  const steps = useMemo(() => buildSteps(awards, fmvp), [awards, fmvp]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [auto, setAuto] = useState(false);
  const step = steps[Math.min(index, steps.length - 1)];
  const dialog = useRef<HTMLDivElement>(null);
  const teamById = (id: string | null) => league.teams.find(t => t.teamId === id);

  // The envelope beat before each reveal (none for reduced motion).
  useEffect(() => {
    if (step.kind !== 'award') return;
    const t = setTimeout(() => setRevealed(true), reducedMotion() ? 0 : 2200);
    return () => clearTimeout(t);
  }, [index, step.kind]);
  useEffect(() => {
    if (!auto || (step.kind === 'award' && !revealed) || index >= steps.length - 1) return;
    const t = setTimeout(() => { setRevealed(false); setIndex(i => i + 1); }, step.kind === 'award' ? 6500 : 5500);
    return () => clearTimeout(t);
  }, [auto, index, revealed, step.kind, steps.length]);
  useEffect(() => { dialog.current?.focus(); }, []);
  // Escape closes the show even when focus has left the dialog (a button that just became disabled drops focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const go = (to: number) => { setRevealed(false); setIndex(Math.max(0, Math.min(steps.length - 1, to))); };
  const rows: VoteRow[] = useMemo(() => step.kind === 'award' && step.voteKey ? voteRows(awards, step.voteKey, season) : [], [step, awards, season]);
  const saved = step.kind === 'award' && step.voteKey ? awards.votes?.[step.voteKey as VotedAwardKey] : undefined;
  const program = steps.map((s, i) => ({ i, label: s.kind === 'intro' ? 'Curtain up' : s.kind === 'outro' ? 'Curtain call' : s.label }));

  const nameOf = (n: Nominee, team: boolean) => team ? n.teamName : n.id;
  const face = (n: Nominee, team: boolean, size: number, mode: 'full' | 'portrait' = 'portrait') => team
    ? (teamById(n.teamId) ? <TeamLogo team={teamById(n.teamId)!} size={size} /> : <span className="an-team-fallback">{n.teamName.slice(0, 3)}</span>)
    : <PlayerAvatar playerId={n.id} teamId={n.teamId} mode={mode} size={size} />;

  let body: ReactNode = null;
  if (step.kind === 'intro') {
    const awardsCount = steps.filter(s => s.kind === 'award').length + steps.filter(s => s.kind === 'medals').reduce((n, s) => n + (s.kind === 'medals' ? s.items.length : 0), 0);
    body = <div className="an-stage an-intro">
      <div className="an-curtain an-curtain-left" aria-hidden="true" /><div className="an-curtain an-curtain-right" aria-hidden="true" />
      <div className="an-beams" aria-hidden="true"><i /><i /></div>
      <div className="an-intro-trophies" aria-hidden="true">{(['roy', 'dpoy', 'mvp', 'fmvp', 'coy'] as const).map((k, i) => <PixelTrophy key={k} award={k} size={k === 'mvp' ? 64 : 40} className={`an-float an-float-${i}`} />)}</div>
      <span className="pixel-eyebrow">LIVE FROM THE LEAGUE BALLROOM</span>
      <h2>The {formatSeasonYear(season)} Awards</h2>
      <p className="hint-text">{awardsCount} trophies and {steps.filter(s => s.kind === 'teams').length} team selections. The major awards were decided by a 100-member media panel{awards.votes ? '' : ' (vote shares for this season are estimated)'}; Executive of the Year by the league's front offices.</p>
      <button className="primary" onClick={() => go(1)}>Raise the curtain</button>
    </div>;
  } else if (step.kind === 'award') {
    const winner = step.winners[0];
    const shared = step.winners.length > 1;
    const top = rows.find(r => r.playerId === winner.id);
    const line = saved?.lines.find(l => l.id === winner.id)?.stats ?? (!step.team ? playerSeasonLine(league, extras, winner.id, season) : null);
    const notes = saved?.notes?.length ? saved.notes : step.blurb ? [step.blurb] : [];
    const teamAward = step.team ? (step.id === 'coy' ? awards.coy : awards.eoy) : null;
    body = <div className="an-stage an-award" key={step.id}>
      <div className="an-beams" aria-hidden="true"><i /><i /></div>
      <h3 className="an-award-title">{step.label}</h3>
      {!revealed ? <div className="an-nominees" aria-live="polite">
        <div className="an-pedestal"><PixelTrophy award={step.trophy} size={72} className="an-trophy-wait" /></div>
        <p className="an-goes-to">{step.nominees.length > 1 ? 'The finalists…' : 'And the award goes to…'}</p>
        <ul className="an-finalist-row">{step.nominees.map((n, i) => <li key={n.id} style={{ animationDelay: `${i * 180}ms` }}>
          <span className="an-finalist-face">{face(n, step.team, 44)}</span><b>{nameOf(n, step.team)}</b>{!step.team && <small>{n.teamName}</small>}</li>)}</ul>
        <div className="an-envelope-art" aria-hidden="true"><span /></div>
      </div> : <div className="an-reveal" aria-live="polite">
        <div className="an-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 90}ms` }} />)}</div>
        <div className="an-winner">
          <div className="an-podium">
            <PixelTrophy award={step.trophy} size={64} className="an-trophy-rise" />
            <div className="an-winner-art">{step.winners.map(w => <span key={w.id} className="an-winner-figure">{face(w, step.team, step.team ? 88 : 96, 'full')}</span>)}</div>
          </div>
          <div className="an-winner-card">
            <span className="pixel-eyebrow">{shared ? 'CO-WINNERS' : 'WINNER'}</span>
            {step.winners.map(w => step.team
              ? <p key={w.id} className="an-winner-name as-text">{step.coach ?? w.teamName}</p>
              : <button key={w.id} className="an-winner-name" onClick={() => onSelectPlayer(w.id)}>{w.id}</button>)}
            <p className="an-winner-team">{step.team ? teamAward?.teamName : step.winners.map(w => w.teamName).join(' · ')}</p>
            {line && <dl className="an-statline">
              <div><dt>PTS</dt><dd>{fx(line.pts)}</dd></div><div><dt>REB</dt><dd>{Number.isFinite(line.reb) ? fx(line.reb) : '—'}</dd></div><div><dt>AST</dt><dd>{fx(line.ast)}</dd></div>
              {step.id === 'dpoy' ? <><div><dt>STL</dt><dd>{fx(line.stl)}</dd></div><div><dt>BLK</dt><dd>{fx(line.blk)}</dd></div></> : null}
              {line.ws != null && <div><dt>WS</dt><dd>{fx(line.ws)}</dd></div>}
              {Number.isFinite(line.w) && <div><dt>TEAM</dt><dd>{line.w}–{line.l}</dd></div>}
              <div><dt>GP</dt><dd>{line.gp}</dd></div>
            </dl>}
            {teamAward?.detail && <dl className="an-statline">
              <div><dt>RECORD</dt><dd>{teamAward.detail.wins}–{teamAward.detail.losses}</dd></div>
              {teamAward.detail.prevWins != null && <div><dt>LAST YEAR</dt><dd>{teamAward.detail.prevWins}–{teamAward.detail.prevLosses}</dd></div>}
              {teamAward.detail.expectedWins != null && <div><dt>PROJECTED</dt><dd>{teamAward.detail.expectedWins} W</dd></div>}
            </dl>}
            {top && <p className="an-winner-votes">{top.first === (saved?.voters ?? 100) && !shared ? 'Unanimous · ' : ''}{top.first} first-place vote{top.first === 1 ? '' : 's'} · {(top.share * 100).toFixed(1)}% share{top.real ? ' · real voting' : top.estimated ? ' · estimated' : ''}</p>}
          </div>
        </div>
        {notes.length > 0 && <div className="an-why"><h4>Why {step.team ? 'they' : 'he'} won</h4><ul>{notes.map((n, i) => <li key={i} style={{ animationDelay: `${300 + i * 140}ms` }}>{n}</li>)}</ul></div>}
        {rows.length > 1 && <table className="db-table an-votes"><thead><tr><th>#</th><th>{step.team ? 'Team' : 'Player'}</th><th>1st</th><th>Pts</th><th>Share</th></tr></thead>
          <tbody>{rows.slice(0, 5).map((v, i) => <tr key={v.playerId} style={{ animationDelay: `${i * 120}ms` }} className={step.winners.some(w => w.id === v.playerId) ? 'an-vote-winner' : undefined}>
            <td>{i + 1}</td>
            <td>{step.team ? <span className="an-vote-team">{teamById(v.teamId) && <TeamLogo team={teamById(v.teamId)!} size={20} />}{v.teamName}</span>
              : <button className="prospect-name" onClick={() => onSelectPlayer(v.playerId)}><PlayerNameTag playerId={v.playerId} teamId={v.teamId ?? undefined} size={20} /></button>}</td>
            <td>{v.first}</td><td>{v.points}</td>
            <td className="an-share"><span className="an-share-bar"><span style={{ width: `${(v.share * 100).toFixed(1)}%`, animationDelay: `${200 + i * 120}ms` }} /></span>{(v.share * 100).toFixed(1)}%</td>
          </tr>)}</tbody></table>}
        {rows.some(r => r.estimated) && <p className="hint-text an-center">This season was played before full ballots were saved: vote shares are estimated from the final ranking.</p>}
      </div>}
    </div>;
  } else if (step.kind === 'medals') {
    body = <div className="an-stage" key={step.id}>
      <div className="an-beams" aria-hidden="true"><i /><i /></div>
      <h3 className="an-award-title">{step.label}</h3>
      <div className="an-medals">{step.items.map((m, i) => <button key={m.trophy} className="an-medal-card" style={{ animationDelay: `${i * 160}ms` }} onClick={() => onSelectPlayer(m.winner.playerId)}>
        <PixelTrophy award={m.trophy} size={44} />
        <small>{m.label}</small>
        <PlayerAvatar playerId={m.winner.playerId} teamId={m.winner.teamId} mode="portrait" size={34} />
        <b>{m.winner.playerId}</b>
        <span>{m.value ?? m.winner.teamName}</span>
        {(awards.coWinners?.[m.trophy as AwardBallotKey] ?? []).map(c => <em key={c.playerId}>shared with {c.playerId}</em>)}
      </button>)}</div>
    </div>;
  } else if (step.kind === 'teams') {
    const lines = new Map((awards.votes?.[step.voteKey]?.lines ?? []).map(l => [l.id, l]));
    body = <div className="an-stage" key={step.id}>
      <h3 className="an-award-title">{step.label}</h3>
      {step.teams.map((team, t) => <div key={t} className="an-team-row">
        <span className="an-team-label"><PixelTrophy award={step.trophies[t] ?? step.trophies.at(-1)!} size={26} />{place(t)} team</span>
        <div className="an-team-players">{team.map((w, i) => { const l = lines.get(w.playerId); return <button key={w.playerId} className="an-team-card" style={{ animationDelay: `${(t * 5 + i) * 110}ms` }} onClick={() => onSelectPlayer(w.playerId)}>
          {w.position && <span className="an-pos">{w.position}</span>}
          <PlayerAvatar playerId={w.playerId} teamId={w.teamId} mode="portrait" size={40} /><b>{w.playerId}</b><small>{w.teamName}</small>
          {l && <small className="an-team-votes">{l.points} pts · {l.firstVotes} 1st-team</small>}</button>; })}</div>
      </div>)}
      {step.voteKey !== 'allRookie' && step.teams.some(t => t.some(w => w.position)) && <p className="hint-text an-center">Each team is two guards, two forwards and a center. 1st-team votes are worth the most.</p>}
    </div>;
  } else {
    const shelf = steps.filter((s): s is Extract<Step, { kind: 'award' }> => s.kind === 'award');
    body = <div className="an-stage an-intro an-outro">
      <div className="an-beams" aria-hidden="true"><i /><i /></div>
      <h2>Class of {formatSeasonYear(season)}</h2>
      <div className="an-class">{shelf.map(s => <button key={s.id} className="an-class-item" onClick={() => !s.team && onSelectPlayer(s.winners[0].id)}>
        <PixelTrophy award={s.trophy} size={40} /><small>{TROPHIES[s.trophy].short}</small><b>{s.team ? (s.coach ?? s.winners[0].teamName) : s.winners.map(w => w.id).join(' & ')}</b></button>)}</div>
      <p className="hint-text">Every result is saved in the League Almanac with full vote tallies, and each winner's trophy is on his player page.</p>
      <button className="primary" onClick={onClose}>Close</button>
    </div>;
  }

  return <div className="awards-night-backdrop" role="presentation" onKeyDown={e => { if (e.key === 'ArrowRight') go(index + 1); if (e.key === 'ArrowLeft') go(index - 1); }}>
    <div className="awards-night" role="dialog" aria-modal="true" aria-label={`${formatSeasonYear(season)} awards night`} tabIndex={-1} ref={dialog}>
      <header className="awards-night-head">
        <span className="pixel-eyebrow">{formatSeasonYear(season)} AWARDS NIGHT</span>
        <span className="awards-night-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>{steps.map((_, i) => <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />)}</span>
        <label className="an-program">Program <select value={index} onChange={e => go(Number(e.target.value))}>{program.map(p => <option key={p.i} value={p.i}>{p.label}</option>)}</select></label>
        <button onClick={onClose} aria-label="Close awards night">✕</button>
      </header>
      {body}
      <footer className="awards-night-controls">
        <button onClick={() => go(index - 1)} disabled={index === 0}>◀ Back</button>
        {step.kind === 'award' && !revealed && <button onClick={() => setRevealed(true)}>Open envelope</button>}
        <label className="an-auto"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Auto-advance</label>
        <button onClick={() => go(steps.length - 2)} disabled={index >= steps.length - 2}>{(() => { const last = steps[steps.length - 2]; return last?.kind === 'award' && last.id === 'mvp' ? 'Skip to MVP' : 'Skip ahead'; })()}</button>
        <button className="primary" onClick={() => go(index + 1)} disabled={index >= steps.length - 1}>Next ▶</button>
      </footer>
    </div>
  </div>;
}
