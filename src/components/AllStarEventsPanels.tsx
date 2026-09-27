import { useState } from 'react';
import type { League, AllStarWeekendRecord } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { draftPool, onTheClock, draftAllStar, autoDraft, captainTeamName, runThreePointShow, threePointSummary, startDunkShow, nextDunker, playNextDunk, finishDunkShow, dunkSummary, dunkTotal, DUNK_RISK, type DunkRisk, type ThreeRound } from '../simulation/allStarEvents';
import { PlayerNameTag } from './PlayerAvatar';

interface Base { league: League; record: AllStarWeekendRecord; onChange: (league: League) => void; onSelectPlayer: (id: string) => void }
const teamOf = (league: League, id: string) => league.teams.find(t => t.seasons.some(s => s.playerId === id));

/** Captains draft: you pick for one captain, the other answers. */
export function CaptainsDraftPanel({ league, record, onChange, onSelectPlayer }: Base) {
  const d = record.draft;
  if (!d) return null;
  const pool = draftPool(record, d);
  const yourTurn = !d.done && onTheClock(d) === d.userSide;
  const yours = d.userSide === 'A' ? d.captainA : d.captainB;
  const column = (side: 'A' | 'B') => {
    const captain = side === 'A' ? d.captainA : d.captainB, list = side === 'A' ? d.teamA : d.teamB;
    return <div className={`captains-team ${d.userSide === side ? 'yours' : ''}`}>
      <h4>{captainTeamName(captain)}{d.userSide === side && <small> · you pick</small>}</h4>
      <ol>{list.map((id, i) => <li key={id}><button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button><small>{i === 0 ? 'CAPTAIN' : `PICK ${d.picks.indexOf(id) + 1}`}</small></li>)}</ol>
    </div>;
  };
  return <section className="captains-draft" aria-label="Captains draft">
    <h3>Captains draft</h3>
    <p className="hint-text">{d.done ? 'The teams are set.' : yourTurn ? `You're on the clock for ${yours}. Starters go first, then the reserves.` : 'The other captain is picking…'}</p>
    <div className="captains-grid">{column('A')}{column('B')}</div>
    {!d.done && <>
      <div className="captains-pool">{pool.map(s => <button key={s.playerId} disabled={!yourTurn} onClick={() => onChange(draftAllStar(league, s.playerId))}>
        <PlayerNameTag playerId={s.playerId} teamId={s.teamId ?? undefined} size={28} /><small>{s.starter ? 'Starter' : 'Reserve'} · {s.teamName}</small></button>)}</div>
      <button onClick={() => onChange(autoDraft(league))}>Finish the draft for me</button>
    </>}
  </section>;
}

function Rack({ round, shown }: { round: ThreeRound; shown: number }) {
  return <div className="three-racks" aria-label={`${round.shooter}: ${shown >= 25 ? round.score : '…'} points`}>
    {[0, 1, 2, 3, 4].map(rack => <span key={rack} className={`three-rack ${rack === round.moneyRack ? 'money' : ''}`}>
      {[0, 1, 2, 3, 4].map(ball => { const i = rack * 5 + ball; return <i key={ball} className={i >= shown ? 'pending' : round.balls[i] ? 'made' : 'miss'} title={rack === round.moneyRack || ball === 4 ? 'Money ball (2)' : undefined} />; })}
    </span>)}
  </div>;
}

/** Three-Point Contest: pick your shooters' money racks, then watch it rack by rack. */
export function ThreePointPanel({ league, record, onSelectPlayer, entrants, seed, userTeamId, update }: Omit<Base, 'onChange'> & { entrants: PlayerSeason[]; seed: number; userTeamId: string | null; update: (patch: Partial<AllStarWeekendRecord>) => void }) {
  const show = record.threePointShow;
  const [racks, setRacks] = useState<Record<string, number>>({});
  const [step, setStep] = useState(() => (show ? Infinity : 0)); // rounds revealed
  const mine = entrants.filter(p => teamOf(league, p.playerId)?.teamId === userTeamId);
  if (!show) {
    if (record.threePoint) return <p>Champion: <strong>{record.threePoint.winner}</strong></p>;
    return <>
      <ol className="contest-field">{entrants.map(p => <li key={p.playerId}><button className="link-button" onClick={() => onSelectPlayer(p.playerId)}>{p.playerId}</button><small>3PT {p.attributes.offense.threePoint}</small></li>)}</ol>
      {mine.map(p => <label key={p.playerId} className="contest-choice">{p.playerId}'s money-ball rack
        <select value={racks[p.playerId] ?? 0} onChange={e => setRacks(r => ({ ...r, [p.playerId]: Number(e.target.value) }))}>
          {['Left corner', 'Left wing', 'Top of the key', 'Right wing', 'Right corner'].map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>)}
      <button disabled={record.completed || entrants.length < 3} onClick={() => { const s = runThreePointShow(entrants, seed, racks); setStep(0); update({ threePointShow: s, threePoint: threePointSummary(s), threePointChampionId: s.winner }); }}>Start the contest</button>
    </>;
  }
  const rounds = [...show.first.map(r => ({ r, final: false })), ...show.final.map(r => ({ r, final: true }))];
  const revealed = Math.min(step, rounds.length);
  const over = revealed >= rounds.length;
  return <>
    {rounds.slice(0, Math.max(1, revealed + (over ? 0 : 1))).map(({ r, final }, i) => <div key={`${final}${r.shooter}`} className="contest-row">
      <span>{final && <small className="contest-tag">FINAL</small>}<button className="link-button" onClick={() => onSelectPlayer(r.shooter)}>{r.shooter}</button></span>
      <Rack round={r} shown={i < revealed ? 25 : 0} /><strong>{i < revealed ? r.score : '—'}</strong>
    </div>)}
    {over ? <p>Champion: <strong>{show.winner}</strong></p>
      : <div className="contest-actions"><button className="primary" onClick={() => setStep(revealed + 1)}>{revealed === show.first.length ? 'Start the final' : 'Next shooter'}</button><button onClick={() => setStep(Infinity)}>Show results</button></div>}
  </>;
}

/** Slam Dunk Contest: your dunkers choose how big to go; everyone else decides for himself. */
export function DunkPanel({ league, record, onSelectPlayer, entrants, seed, userTeamId, update }: Omit<Base, 'onChange'> & { entrants: PlayerSeason[]; seed: number; userTeamId: string | null; update: (patch: Partial<AllStarWeekendRecord>) => void }) {
  const show = record.dunkShow;
  const mine = new Set(entrants.filter(p => teamOf(league, p.playerId)?.teamId === userTeamId).map(p => p.playerId));
  const save = (s: NonNullable<AllStarWeekendRecord['dunkShow']>) => update({ dunkShow: s, ...(s.stage === 'done' ? { dunk: dunkSummary(s), dunkChampionId: s.winner ?? undefined } : {}) });
  if (!show) {
    if (record.dunk) return <p>Champion: <strong>{record.dunk.winner}</strong></p>;
    return <>
      <ol className="contest-field">{entrants.map(p => <li key={p.playerId}><button className="link-button" onClick={() => onSelectPlayer(p.playerId)}>{p.playerId}</button><small>VERT {p.attributes.physical.vertical}</small></li>)}</ol>
      <button disabled={record.completed || entrants.length < 2} onClick={() => save(startDunkShow(entrants))}>Start the contest</button>
    </>;
  }
  const next = nextDunker(show);
  const line = (list: typeof show.first, label: string, field: string[]) => list.length > 0 && <div className="dunk-round"><small className="contest-tag">{label}</small>
    <ol>{list.map((d, i) => <li key={i} className={d.made ? 'made' : 'miss'}><span><b>{d.dunker}</b> · {d.name}</span><span>{d.made ? d.score : `${d.score} (missed)`}</span></li>)}</ol>
    <p className="hint-text">{field.map(id => `${id} ${dunkTotal(list, id)}`).join(' · ')}</p></div>;
  return <>
    {line(show.first, 'FIRST ROUND', show.entrants)}
    {line(show.final, 'FINAL', show.finalists)}
    {show.stage === 'done' ? <p>Champion: <strong>{show.winner}</strong></p>
      : next && <div className="contest-actions">
        <p>Up next: <b>{next}</b>{mine.has(next) ? ' (yours)' : ''}</p>
        {mine.has(next)
          ? (Object.keys(DUNK_RISK) as DunkRisk[]).map(r => <button key={r} title={DUNK_RISK[r].detail} onClick={() => save(playNextDunk(league, show, seed, r, mine))}>{DUNK_RISK[r].label}<small> {DUNK_RISK[r].detail}</small></button>)
          : <button className="primary" onClick={() => save(playNextDunk(league, show, seed, undefined, mine))}>Next dunk</button>}
        {!mine.size && <button onClick={() => save(finishDunkShow(league, show, seed))}>Finish the contest</button>}
      </div>}
  </>;
}
