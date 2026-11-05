import { loadRelics, saveRelics } from '../relics/relics';
import { activeRun, loadHoliday, saveHoliday, spendEventCoins } from './holiday';
import { EVENT_PIECE_BY_KEY } from './holidayShop';

export type BuyResult = 'ok' | 'closed' | 'owned' | 'coins';
/** Buys an event piece with event coins: only while its event is on, once. It goes into the relic save's cosmetics. */
export function buyEventPiece(key: string, now = new Date()): BuyResult {
  const piece = EVENT_PIECE_BY_KEY.get(key), run = piece ? activeRun(piece.holiday, now) : null;
  if (!piece || !run || run.holiday.id !== piece.holiday) return 'closed';
  const relics = loadRelics();
  if ((relics.cosmetics ?? []).includes(key)) return 'owned';
  const paid = spendEventCoins(loadHoliday(), piece.price, now, piece.holiday);
  if (!paid) return 'coins';
  saveHoliday(paid);
  saveRelics({ ...relics, cosmetics: [...(relics.cosmetics ?? []), key] });
  return 'ok';
}

export function buyEventKey(event: import('./holiday').HolidayId, now = new Date()): BuyResult {
  const run = activeRun(event, now);
  if (!run) return 'closed';
  const paid = spendEventCoins(loadHoliday(), 10, now, event);
  if (!paid) return 'coins';
  const relics = loadRelics();
  saveHoliday(paid);
  saveRelics({ ...relics, eventKeys: { ...relics.eventKeys, [run.key]: (relics.eventKeys?.[run.key] ?? 0) + 1 } });
  return 'ok';
}
