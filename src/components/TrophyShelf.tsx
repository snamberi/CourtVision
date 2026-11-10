import { useContext } from 'react';
import { LeagueAwardContext } from './AwardStudio';
import { awardDefinition } from '../simulation/awardStudio';
import { formatSeasonYear } from '../simulation/calendar';
import { TROPHY_ORDER } from '../simulation/trophies';
import { PixelTrophy } from './PixelTrophy';

export interface ShelfEntry { key: string; season: string; who?: string }

/** A wooden shelf of pixel trophies: one per award, with a count and the seasons (and winners) on hover. */
export function TrophyShelf({ entries, empty, size = 40 }: { entries: ShelfEntry[]; empty?: string; size?: number }) {
  const league = useContext(LeagueAwardContext);
  const order = [...new Set<string>([...TROPHY_ORDER, ...entries.map(e => e.key)])];
  const groups = order.map(key => ({ key, items: entries.filter(e => e.key === key) })).filter(g => g.items.length > 0);
  if (!groups.length) return <p className="hint-text">{empty ?? 'No trophies yet.'}</p>;
  return <div className="trophy-shelf" role="list">
    {groups.map(g => {
      const definition = awardDefinition(league, g.key);
      const detail = g.items.map(e => `${formatSeasonYear(e.season)}${e.who ? ` — ${e.who}` : ''}`).join('\n');
      return <div key={g.key} className={`trophy-slot${definition.prestige >= 8 ? ' trophy-slot--major' : ''}`} role="listitem" title={`${definition.name}\n${detail}`} tabIndex={0} aria-label={`${definition.name}: ${g.items.length}. ${detail.replace(/\n/g, ', ')}`}>
        <PixelTrophy award={g.key} size={size} />
        {g.items.length > 1 && <span className="trophy-count">×{g.items.length}</span>}
        <small>{definition.short}</small>
      </div>;
    })}
  </div>;
}
