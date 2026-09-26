import { formatSeasonYear } from '../simulation/calendar';
import { TROPHIES, TROPHY_ORDER, type TrophyKey } from '../simulation/trophies';
import { PixelTrophy } from './PixelTrophy';

export interface ShelfEntry { key: TrophyKey; season: string; who?: string }

/** A wooden shelf of pixel trophies: one per award, with a count and the seasons (and winners) on hover. */
export function TrophyShelf({ entries, empty, size = 40 }: { entries: ShelfEntry[]; empty?: string; size?: number }) {
  const groups = TROPHY_ORDER.map(key => ({ key, items: entries.filter(e => e.key === key) })).filter(g => g.items.length > 0);
  if (!groups.length) return <p className="hint-text">{empty ?? 'No trophies yet.'}</p>;
  return <div className="trophy-shelf" role="list">
    {groups.map(g => {
      const detail = g.items.map(e => `${formatSeasonYear(e.season)}${e.who ? ` — ${e.who}` : ''}`).join('\n');
      return <div key={g.key} className={`trophy-slot${TROPHIES[g.key].prestige >= 8 ? ' trophy-slot--major' : ''}`} role="listitem" title={`${TROPHIES[g.key].label}\n${detail}`} tabIndex={0} aria-label={`${TROPHIES[g.key].label}: ${g.items.length}. ${detail.replace(/\n/g, ', ')}`}>
        <PixelTrophy award={g.key} size={size} />
        {g.items.length > 1 && <span className="trophy-count">×{g.items.length}</span>}
        <small>{TROPHIES[g.key].short}</small>
      </div>;
    })}
  </div>;
}
