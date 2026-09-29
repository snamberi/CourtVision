import { useMemo } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { answerPress, aroundTheLeague, fanMoodLabel, pressState, type PressEffects } from '../simulation/press';
import { TeamText } from './TeamLink';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League) => void;
}

const hints = (e: PressEffects) => [
  e.team ? `Locker room ${e.team > 0 ? '▲' : '▼'}` : '', e.player ? `Player ${e.player > 0 ? '▲' : '▼'}` : '',
  e.owner ? `Owner ${e.owner > 0 ? '▲' : '▼'}` : '', e.fans ? `Fans ${e.fans > 0 ? '▲' : '▼'}` : '',
  e.hype ? `Hype +${e.hype}${e.hype >= 15 ? ' (bigger swing: win or lose)' : ''}` : '',
].filter(Boolean).join(' · ');

/** Press conferences waiting for you, the fans' mood, and this week's Around the League. */
export function PressRoomPage({ league, extras, controlledTeamId, onChange }: Props) {
  const state = pressState(league);
  const stories = useMemo(() => aroundTheLeague(league, extras, controlledTeamId), [league, extras, controlledTeamId]);
  const mood = fanMoodLabel(state.fans);
  return <div className="press-room">
    <header className="press-head">
      <div><span className="pixel-eyebrow">MEDIA</span><h2><PixelIcon name="list" size={24} /> Press Room</h2></div>
      {controlledTeamId && <div className="press-fans" aria-label={`Fan mood ${state.fans} of 100, ${mood}`}>
        <small>Fan mood</small><b>{mood}</b><span className="press-meter"><i style={{ width: `${state.fans}%` }} /></span></div>}
    </header>

    {!controlledTeamId ? <p className="empty-state">Press conferences follow the team you run.</p> : <section>
      <h3>Podium</h3>
      {state.pending.length === 0 && <p className="hint-text">No reporters waiting. Big wins, bad losses, streaks, huge nights, trade requests and playoff series bring them out.</p>}
      {state.pending.map(c => <article key={c.id} className={`press-card${c.kind === 'rivalry' ? ' press-card-rivalry' : ''}`}>
        {c.kind === 'rivalry' && <span className="pixel-eyebrow"><PixelIcon name="flame" size={12} /> RIVALRY WEEK</span>}
        <p className="press-question">🎤 “<TeamText text={c.question} />”</p>
        <div className="press-answers">{c.answers.map(a => <button key={a.id} onClick={() => onChange(answerPress(league, c.id, a.id, controlledTeamId))}>
          <b>{a.tone}</b><span>“{a.text}”</span><small>{hints(a.effects)}</small></button>)}</div>
      </article>)}
      {state.log.length > 0 && <details className="press-log"><summary>What you've said ({state.log.length})</summary><ol>{[...state.log].reverse().map(r => <li key={r.id}><small>{r.tone}</small> “{r.answer}”</li>)}</ol></details>}
    </section>}

    <section className="press-around">
      <h3>Around the League</h3>
      {stories.length === 0 ? <p className="hint-text">A quiet week. Check back after a few games.</p>
        : <ul>{stories.map((s, i) => <li key={i} className={`tone-${s.tone}`}><b>{s.title}</b><span><TeamText text={s.text} /></span></li>)}</ul>}
    </section>
  </div>;
}
