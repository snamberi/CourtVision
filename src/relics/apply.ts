import { localRead, type Read } from '../lib/kv';
import { loadRelics, totalLuck, type SecretId } from './relics';
import { activePet, type PetId } from '../profile/pets';
import { totalXp, levelFor, xpParts } from '../profile/profile';

/*
 * What your relics bring to a new run, read once when it starts (so a run stays the same however your collection
 * changes later). Shared-seed runs (Dailies, Weeklies, duels) are started without these.
 */
export interface RelicRunOpts {
  luck: number;
  secondWind: boolean; goldenTouch: boolean; ironWill: boolean; extraPick: boolean; clutchGene: boolean; eternalSpin: boolean; lastLook: boolean; ownersFavorite: boolean;
  luckyCharm: boolean; sixthSense: boolean; filmRoom: boolean; phoneTree: boolean; ultraCheat: boolean;
  /** The pet you brought along (profile/pets.ts), whose ability the mode applies. */
  pet: PetId | null;
}
/** The Bunny's Lucky Foot: this much more luck. */
export const BUNNY_LUCK = 0.02;
export function relicRunOpts(read: Read = localRead): RelicRunOpts {
  const s = loadRelics(read);
  const has = (id: SecretId) => s.secrets.includes(id);
  let pet: PetId | null = null;
  try { pet = activePet(levelFor(totalXp(xpParts(read))).level, read); } catch { /* no profile yet */ }
  return {
    pet,
    luck: totalLuck(s) / 100 + (pet === 'bunny' ? BUNNY_LUCK : 0),
    secondWind: has('secondWind'), goldenTouch: has('goldenTouch'), ironWill: has('ironWill'), extraPick: has('extraPick'),
    clutchGene: has('clutchGene'), eternalSpin: has('eternalSpin'), lastLook: has('lastLook'), ownersFavorite: has('ownersFavorite'),
    luckyCharm: has('luckyCharm'), sixthSense: has('sixthSense'), filmRoom: has('filmRoom'), phoneTree: has('phoneTree'), ultraCheat: has('ultraCheat'),
  };
}
