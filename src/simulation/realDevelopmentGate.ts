import type { League } from './league';
import type { PlayerSeason } from './types';

/** Real Player Development (historical leagues): when on, a real player's base ratings follow his reference
 * trajectory at rollover only; training, coaching, facilities and minutes cannot change them permanently. */
export const realDevelopmentOn = (league: Pick<League, 'historical'> | null | undefined) => !!league?.historical?.realDevelopment;
export const followsRealDevelopment = (p: PlayerSeason, league: Pick<League, 'historical'> | null | undefined) => realDevelopmentOn(league) && !!p.real;
