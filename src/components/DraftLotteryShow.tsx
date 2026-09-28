import { useEffect, useState } from 'react';
import type { League } from '../simulation/league';
import type { LotteryResult } from '../simulation/draftNight';
import { TeamLogo } from './TeamLogo';

/** The lottery, live: envelopes open from the last lottery pick up to No. 1. */
export function DraftLotteryShow({ league, lottery, controlledTeamId, onDone }: { league: League; lottery: LotteryResult; controlledTeamId: string | null; onDone: () => void }) {
  const byPick = [...lottery.entries].sort((a, b) => b.after - a.after);
  const [shown, setShown] = useState(0);
  const [auto, setAuto] = useState(false);
  const done = shown >= byPick.length;
  useEffect(() => {
    if (!auto || done) return;
    const t = setTimeout(() => setShown(s => s + 1), shown >= byPick.length - 4 ? 2200 : 900);
    return () => clearTimeout(t);
  }, [auto, shown, done, byPick.length]);
  const team = (id: string) => league.teams.find(t => t.teamId === id);
  const mine = lottery.entries.find(e => e.teamId === controlledTeamId);

  return <section className="lottery-show" aria-label="Draft lottery">
    <header><span className="pixel-eyebrow">DRAFT LOTTERY</span><h3>Who gets No. 1?</h3>
      {mine && <p className="hint-text">You came in at No. {mine.before} with a {mine.oddsTop}% chance at the top pick.</p>}</header>
    <ol className="lottery-envelopes">{byPick.map((e, i) => {
      const open = i < shown, t = team(e.teamId), moved = e.before - e.after;
      return <li key={e.teamId} className={`${open ? 'open' : 'sealed'}${e.teamId === controlledTeamId ? ' mine' : ''}${open && moved > 0 ? ' jumped' : ''}`}>
        <span className="lottery-pick">No. {e.after}</span>
        {open && t ? <><TeamLogo team={t} size={28} /><b>{t.name}</b>
          <small>{moved > 0 ? `▲ up ${moved} from No. ${e.before}` : moved < 0 ? `▼ down ${-moved} from No. ${e.before}` : `held No. ${e.before}`} · {e.oddsTop}% odds</small></>
          : <span className="lottery-sealed">✉ sealed</span>}
      </li>;
    })}</ol>
    <div className="lottery-actions">
      {!done && <button className="primary" onClick={() => setShown(s => s + 1)}>Open next envelope</button>}
      {!done && <button onClick={() => setAuto(a => !a)}>{auto ? 'Pause' : 'Play the reveal'}</button>}
      {!done && <button onClick={() => setShown(byPick.length)}>Show all</button>}
      {done && <button className="primary" onClick={onDone}>On to the draft ▶</button>}
    </div>
  </section>;
}
