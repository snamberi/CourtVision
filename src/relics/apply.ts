import { localRead, type Read } from '../lib/kv';
import { loadRelics, luckPercent, type SecretId } from './relics';

/*
 * What your relics bring to a new run, read once when it starts (so a run stays the same however your collection
 * changes later). Shared-seed runs (Dailies, Weeklies, duels) are started without these.
 */
export interface RelicRunOpts {
  luck: number;
  secondWind: boolean; goldenTouch: boolean; ironWill: boolean; extraPick: boolean; clutchGene: boolean; eternalSpin: boolean; lastLook: boolean; ownersFavorite: boolean;
}
export function relicRunOpts(read: Read = localRead): RelicRunOpts {
  const s = loadRelics(read);
  const has = (id: SecretId) => s.secrets.includes(id);
  return {
    luck: luckPercent(s) / 100,
    secondWind: has('secondWind'), goldenTouch: has('goldenTouch'), ironWill: has('ironWill'), extraPick: has('extraPick'),
    clutchGene: has('clutchGene'), eternalSpin: has('eternalSpin'), lastLook: has('lastLook'), ownersFavorite: has('ownersFavorite'),
  };
}
