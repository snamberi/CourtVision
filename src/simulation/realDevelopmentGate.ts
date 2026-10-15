import type { League } from './league';
import type { PlayerSeason } from './types';

/** Real Player Development (historical leagues): when on, a real player's base ratings follow his reference
 * trajectory at rollover only; training, coaching, facilities and minutes cannot change them permanently. */
export const realDevelopmentOn = (league: Pick<League, 'historical'> | null | undefined) => !!league?.historical?.realDevelopment;
/** A player set to his own development, or with locked ratings (Edit Player), never follows the real trajectory. */
export const followsRealDevelopment = (p: PlayerSeason, league: Pick<League, 'historical'> | null | undefined) => realDevelopmentOn(league) && !!p.real && !p.ownDevelopment && !p.lockRatings;
/** Nothing changes his ratings this summer: real development or locked ratings. */
export const ratingsHeld = (p: PlayerSeason, league: Pick<League, 'historical'> | null | undefined) => followsRealDevelopment(p, league) || !!p.lockRatings;
/** A player with locked ratings keeps playing at any age while his Overall is at least this. */
export const LOCKED_KEEPS_PLAYING = 60;
