import { useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { todayUtc } from '../../hunt/storage';
import { track } from '../../analytics/track';
import { dailyDraft, runDraft, scoreDraft, readDailyDraft, saveDailyDraft, draftStreak, PICKS } from '../../arcade/dailyDraft';
import '../../improvements.css';

async function share(text: string) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled: copy instead */ }
  try { await navigator.clipboard.writeText(text); } catch { /* nothing to do */ }
}

/** Daily Draft: the same real draft class for everyone today, five picks, scored by real career Win Shares. */
export function DailyDraftGame({ h }: { h: NbaHistory }) {
  const day = todayUtc();
  const d = useMemo(() => dailyDraft(h, day), [h, day]);
  const [records, setRecords] = useState(readDailyDraft);
  const done = records[day];
  const [mine, setMine] = useState<number[]>(() => done?.picks ?? []);
  const state = useMemo(() => runDraft(d, mine), [d, mine]);
  const finished = mine.length >= d.slots.length;
  const result = finished ? scoreDraft(d, mine) : null;
  const [shared, setShared] = useState(false);

  const pick = (realPick: number) => {
    if (finished || done) return;
    const next = [...mine, realPick];
    setMine(next);
    if (next.length >= d.slots.length) {
      const s = scoreDraft(d, next);
      saveDailyDraft(day, { picks: next, score: s.score, realScore: s.realScore, grade: s.grade });
      setRecords(readDailyDraft());
      track('mode_finish', { mode: 'dailyDraft', variant: s.grade });
    }
  };
  const takenBy = (p: number) => state.taken.get(p);
  const streak = draftStreak(records, day);
  const shareText = result ? `Court Vision Daily Draft ${day}: the ${d.year} draft. Grade ${result.grade}, ${result.score} Win Shares (the real picks: ${result.realScore}). https://courtvisiongame.com` : '';

  return (
    <div className="daily-draft">
      <div className="rvy-score">
        <div className={`grade-badge ${result ? '' : 'wide'}`} aria-hidden>{result ? result.grade : `${mine.length}/${d.slots.length}`}</div>
        <div><b>The {d.year} NBA Draft</b>
          <span>Your picks: {d.slots.map(s => `#${s}`).join(', ')}{streak ? ` · ${streak}-day streak` : ''}</span>
          <small>{finished ? 'Draft complete. Careers revealed below.' : state.onClock ? `You're on the clock at #${state.onClock}. Everyone else drafts in real order.` : ''} A new class every day at midnight UTC.</small></div>
      </div>

      {result && <section className="reset-preview">
        <h4>Your draft vs the real one</h4>
        <div className="stat-table-scroll"><table className="db-table">
          <thead><tr><th className="num">Pick</th><th className="col-name">You took</th><th className="num">Win Shares</th><th className="col-name">Really taken</th><th className="num">Win Shares</th></tr></thead>
          <tbody>{d.slots.map((slot, i) => { const you = result.yours[i], real = d.prospects.find(p => p.pick === slot); return <tr key={slot}>
            <td className="num">#{slot}</td><td className="col-name">{you?.name ?? '—'}</td><td className="num">{you?.ws ?? 0}</td>
            <td className="col-name">{real?.name ?? '—'}</td><td className="num">{real?.ws ?? 0}</td></tr>; })}</tbody>
          <tfoot><tr><td /><td className="col-name"><b>Total</b></td><td className="num"><b>{result.score}</b></td><td className="col-name">Real GMs</td><td className="num">{result.realScore}</td></tr></tfoot>
        </table></div>
        <p className="hint-text">{result.score > result.realScore ? 'You out-drafted the real front offices.' : result.score === result.realScore ? 'Dead even with the real draft.' : 'The real GMs did better this time.'} The best possible five in this class: {result.best} Win Shares.</p>
        <button onClick={() => { void share(shareText); setShared(true); }}>{shared ? 'Copied!' : 'Share result'}</button>
      </section>}

      <div className="stat-table-scroll"><table className="db-table draft-board">
        <thead><tr><th className="num">Real pick</th><th className="col-name">Player</th><th>Pos</th><th className="col-name">College</th><th>{finished ? 'Career' : ''}</th><th /></tr></thead>
        <tbody>{d.prospects.map(p => {
          const slot = takenBy(p.pick), yours = mine.includes(p.pick);
          return <tr key={p.pick} className={yours ? 'hof-yes' : slot ? 'muted' : ''}>
            <td className="num">{p.pick}</td><td className="col-name">{p.name}</td><td>{p.pos ?? '—'}</td><td className="col-name">{p.college ?? '—'}</td>
            <td>{finished ? `${p.ws} WS · ${p.games} G` : ''}</td>
            <td>{yours ? <span className="cv-chip gold">Yours (#{slot})</span> : slot ? <small>gone at #{slot}</small>
              : !finished && state.onClock ? <button onClick={() => pick(p.pick)}>Draft</button> : null}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <p className="hint-text">You hold {PICKS} picks. Before each of them, the other teams take players in the order they were really drafted. Your score is the real career Win Shares of the players you take.</p>
    </div>
  );
}
