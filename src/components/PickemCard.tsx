import { useEffect } from 'react';
import type { League } from '../simulation/league';
import type { PlayoffBracket } from '../simulation/playoffs';
import { openSeries, scorePicks, claimPickemWins, PICKEM_XP } from '../profile/pickem';
import '../improvements.css';

/** Pick'em: call each series before it tips off; right calls pay XP. */
export function PickemCard({ league, bracket, saveId, onChange, onToast }: {
  league: League; bracket: PlayoffBracket | null; saveId: string | null; onChange: (update: (l: League) => League) => void; onToast: (msg: string) => void;
}) {
  const season = league.season ?? '';
  const pickem = league.pickem?.season === season ? league.pickem : undefined;
  const open = openSeries(bracket);
  const score = scorePicks(bracket, pickem);
  const name = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? id ?? '—';
  const rightKey = score.right.join(',');
  useEffect(() => {
    if (!rightKey || !saveId) return;
    const fresh = claimPickemWins(rightKey.split(',').map(id => `${saveId}:${season}:${id}`));
    if (fresh.length) { onToast(`Pick'em: ${fresh.length} right call${fresh.length === 1 ? '' : 's'} (+${fresh.length * PICKEM_XP} XP).`); window.dispatchEvent(new Event('courtvision:profile')); }
  }, [rightKey, saveId, season]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!bracket) return null;
  const choose = (seriesId: string, teamId: string) => onChange(l => ({ ...l, pickem: { season, picks: { ...(l.pickem?.season === season ? l.pickem.picks : {}), [seriesId]: teamId } } }));
  return (
    <section className="reset-preview" aria-label="Playoff pick'em">
      <h4>Pick'em</h4>
      <p className="hint-text">Call each series before it starts: {PICKEM_XP} XP for every right call. {score.right.length + score.wrong.length > 0 ? `So far: ${score.right.length} right, ${score.wrong.length} wrong.` : ''}</p>
      {open.length > 0 ? <div className="pickem-list">{open.map(s => (
        <div key={s.id} className="pickem-row">
          {[s.teamAId!, s.teamBId!].map(t => <button key={t} className={pickem?.picks[s.id] === t ? 'primary' : ''} aria-pressed={pickem?.picks[s.id] === t} onClick={() => choose(s.id, t)}>{name(t)}</button>)}
        </div>))}</div>
        : <p className="hint-text">No series waiting to start. New matchups open as rounds finish.</p>}
      {score.right.length + score.wrong.length > 0 && <div className="cv-chip-row">
        {[...score.right.map(id => ({ id, ok: true })), ...score.wrong.map(id => ({ id, ok: false }))].map(({ id, ok }) =>
          <span key={id} className={`cv-chip ${ok ? 'good' : 'bad'}`}>{ok ? '✓' : '✗'} {name(pickem!.picks[id])}</span>)}
      </div>}
    </section>
  );
}
