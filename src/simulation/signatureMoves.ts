import type { ShotType } from './engine/shot';
import type { AnimKind } from '../visuals/actionSprites';
import { likenessKey } from '../visuals/likeness';

/*
 * Signature moves: the stars' own shots. When one of them makes his shot of that kind, the court plays his animation
 * and calls it by name (Curry's deep three, Dirk's one-leg fadeaway, Shaq's drop step, Kareem's skyhook…).
 * Only how a play is shown changes; the result comes from the game as always.
 */

export interface SignatureMove { name: string; call: string; shots: ShotType[]; anim: AnimKind }
const THREES: ShotType[] = ['aboveBreak3', 'pullUp3', 'catchAndShoot3', 'corner3'];
const RIM: ShotType[] = ['dunk', 'rim', 'layup'];

export const SIGNATURE_MOVES: Record<string, SignatureMove> = {
  'stephen curry': { name: 'Logo three', call: 'FROM THE LOGO!', shots: ['aboveBreak3', 'pullUp3'], anim: 'jumper' },
  'dirk nowitzki': { name: 'One-leg fadeaway', call: 'ONE-LEGGER!', shots: ['fadeaway', 'midrange', 'longMidrange', 'postShot'], anim: 'fadeaway' },
  "shaquille o'neal": { name: 'Drop-step slam', call: 'SHAQ ATTACK!', shots: RIM, anim: 'dunk' },
  'kareem abdul-jabbar': { name: 'Skyhook', call: 'SKYHOOK!', shots: ['hook', 'postShot', 'close'], anim: 'floater' },
  'michael jordan': { name: 'Fadeaway', call: 'MJ FADEAWAY!', shots: ['fadeaway', 'midrange', 'longMidrange'], anim: 'fadeaway' },
  'kobe bryant': { name: 'Turnaround', call: 'MAMBA!', shots: ['fadeaway', 'midrange', 'longMidrange'], anim: 'fadeaway' },
  'james harden': { name: 'Step-back three', call: 'COOKED!', shots: ['stepback', 'pullUp3'], anim: 'stepback' },
  'luka doncic': { name: 'Step-back three', call: 'LUKA MAGIC!', shots: ['stepback', 'pullUp3'], anim: 'stepback' },
  'lebron james': { name: 'Chase-down slam', call: 'KING JAMES!', shots: ['dunk'], anim: 'dunk' },
  'giannis antetokounmpo': { name: 'Euro-step slam', call: 'GREEK FREAK!', shots: ['dunk', 'layup'], anim: 'dunk' },
  'hakeem olajuwon': { name: 'Dream Shake', call: 'DREAM SHAKE!', shots: ['postShot', 'hook', 'close', 'fadeaway'], anim: 'fadeaway' },
  'kevin durant': { name: 'Pull-up', call: 'EASY MONEY!', shots: ['midrange', 'longMidrange', 'pullUp3'], anim: 'jumper' },
  'nikola jokic': { name: 'Sombor shuffle', call: 'SOMBOR SHUFFLE!', shots: ['fadeaway', 'postShot', 'midrange'], anim: 'fadeaway' },
  'vince carter': { name: 'Windmill', call: 'HALF-MAN HALF-AMAZING!', shots: ['dunk'], anim: 'dunk' },
  'allen iverson': { name: 'Crossover', call: 'THE ANSWER!', shots: ['midrange', 'pullUp3', 'layup'], anim: 'jumper' },
  'ray allen': { name: 'Corner three', call: 'BANG!', shots: ['corner3', 'catchAndShoot3'], anim: 'jumper' },
  'klay thompson': { name: 'Catch-and-shoot', call: 'SPLASH!', shots: ['catchAndShoot3', 'corner3'], anim: 'jumper' },
  'damian lillard': { name: 'Logo three', call: 'DAME TIME!', shots: ['aboveBreak3', 'pullUp3'], anim: 'jumper' },
  'tim duncan': { name: 'Bank shot', call: 'OFF THE GLASS!', shots: ['midrange', 'close', 'postShot'], anim: 'jumper' },
  'dwyane wade': { name: 'Euro step', call: 'FLASH!', shots: ['layup', 'rim'], anim: 'layup' },
  'kyrie irving': { name: 'Wrong-hand finish', call: 'UNCLE DREW!', shots: ['layup', 'close'], anim: 'floater' },
  'shai gilgeous-alexander': { name: 'Mid-range pull-up', call: 'SHAI!', shots: ['midrange', 'longMidrange'], anim: 'jumper' },
  'ja morant': { name: 'Poster', call: 'JA!', shots: ['dunk'], anim: 'dunk' },
  'anthony edwards': { name: 'Poster', call: 'ANT-MAN!', shots: ['dunk'], anim: 'dunk' },
  'julius erving': { name: 'Rock the baby', call: 'DR. J!', shots: ['dunk', 'layup'], anim: 'dunk' },
  'reggie miller': { name: 'Clutch three', call: 'MILLER TIME!', shots: THREES, anim: 'jumper' },
  'larry bird': { name: 'Fadeaway three', call: 'LARRY LEGEND!', shots: THREES, anim: 'fadeaway' },
  'magic johnson': { name: 'Junior skyhook', call: 'SHOWTIME!', shots: ['hook', 'close'], anim: 'floater' },
  'victor wembanyama': { name: 'Unreachable', call: 'WEMBY!', shots: ['dunk', 'hook', 'stepback'], anim: 'dunk' },
};

/** A player's signature move, if he has one. */
export const signatureOf = (playerId: string | undefined) => (playerId ? SIGNATURE_MOVES[likenessKey(playerId)] : undefined);
/** His signature move, if this shot is it. */
export function signatureShot(playerId: string | undefined, shotType: string | undefined): SignatureMove | undefined {
  const s = signatureOf(playerId);
  return s && shotType && s.shots.includes(shotType as ShotType) ? s : undefined;
}
