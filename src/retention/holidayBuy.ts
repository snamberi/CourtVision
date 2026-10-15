import { loadRelics, saveRelics } from '../relics/relics';
import { activeHoliday, loadHoliday, saveHoliday, spendEventCoins } from './holiday';
import { EVENT_PIECE_BY_KEY } from './holidayShop';

export type BuyResult = 'ok' | 'closed' | 'owned' | 'coins';
/** Buys an event piece with event coins: only while its event is on, once. It goes into the relic save's cosmetics. */
export function buyEventPiece(key: string, now = new Date()): BuyResult {
  const piece = EVENT_PIECE_BY_KEY.get(key), run = activeHoliday(now);
  if (!piece || !run || run.holiday.id !== piece.holiday) return 'closed';
  const relics = loadRelics();
  if ((relics.cosmetics ?? []).includes(key)) return 'owned';
  const paid = spendEventCoins(loadHoliday(), piece.price, now);
  if (!paid) return 'coins';
  saveHoliday(paid);
  saveRelics({ ...relics, cosmetics: [...(relics.cosmetics ?? []), key] });
  return 'ok';
}
