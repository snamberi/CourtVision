import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { categories, type CategoryInfo } from '../perfect/categories';
import type { HuntRun } from './run';

/** The Category Draft deck: the category this round of spins draws from (seeded by the run and the round, so a reload shows the same). */
export function huntRoundCategory(h: NbaHistory, run: Pick<HuntRun, 'seed' | 'deck'>, round: number): CategoryInfo | null {
  if (run.deck !== 'category') return null;
  const list = categories(h).filter(c => c.group !== 'Names' && c.size >= 30);
  return list[new RNG(run.seed * 17 + round * 104729 + 11).nextInt(list.length)] ?? null;
}
