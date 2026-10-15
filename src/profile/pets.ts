import { localRead, type Read } from '../lib/kv';

/*
 * Pets: a companion for your character. Each pet has one ability somewhere in the game; you can bring one pet at a
 * time. Pets open with your profile level, and each one can be renamed, recoloured and dressed up. Like secret
 * relics, pet abilities stay out of Dailies, Weeklies and duels (shared-seed runs), so those boards stay fair.
 */

export type PetId = 'cat' | 'dog' | 'parrot' | 'goldfish' | 'hamster' | 'fox' | 'owl' | 'bunny' | 'turtle' | 'dragon';
export type PetAccessory = 'none' | 'collar' | 'bandana' | 'bow' | 'partyHat' | 'crown' | 'shades';
export interface Pet { id: PetId; name: string; ability: string; mode: string; level: number; color: string; blurb: string }

export const PETS: Pet[] = [
  { id: 'cat', name: 'Cat', ability: 'Nine Lives: start every League Hunt with one extra life.', mode: 'League Hunt', level: 1, color: '#f4a259', blurb: 'Lands on its feet. Usually on your keyboard.' },
  { id: 'dog', name: 'Dog', ability: 'Guard Dog: start every Survival run with one extra Shield.', mode: 'Survival', level: 1, color: '#8a5a3b', blurb: 'Fetches rebounds. Brings them back slobbery.' },
  { id: 'parrot', name: 'Parrot', ability: 'Copycat: one extra guess on Endless grids.', mode: 'Daily Grid', level: 10, color: '#55c878', blurb: 'Repeats every player name it hears.' },
  { id: 'goldfish', name: 'Goldfish', ability: 'Shiny Scales: start every League Hunt with 25 extra coins.', mode: 'League Hunt', level: 15, color: '#f47b20', blurb: 'Forgets every loss in three seconds.' },
  { id: 'hamster', name: 'Hamster', ability: 'Wheel Runner: one extra reroll in every 82-0 run.', mode: '82-0 Challenge', level: 20, color: '#f2dfb4', blurb: 'Has run more miles than any point guard.' },
  { id: 'fox', name: 'Fox', ability: 'Sly Spin: one extra respin on the Career wheel.', mode: 'Career Mode', level: 30, color: '#e8743b', blurb: 'Always knows where the wheel will stop. Almost.' },
  { id: 'owl', name: 'Owl', ability: 'Night Vision: Guess the Team shows both clues for every starter from the start.', mode: 'Guess the Team', level: 40, color: '#94a0b2', blurb: 'Watches every game. Twice.' },
  { id: 'bunny', name: 'Bunny', ability: 'Lucky Foot: +2% luck in every mode that uses relic luck.', mode: 'Every spin', level: 60, color: '#f4f0e6', blurb: 'Hops in on every lucky bounce.' },
  { id: 'turtle', name: 'Turtle', ability: 'Steady Shell: your Story Mode player starts with +2 grit.', mode: 'Story Mode', level: 80, color: '#4f9a5a', blurb: 'Slow on the break. Never quits.' },
  { id: 'dragon', name: 'Dragon', ability: 'Treasure Hoard: +50% coins from every finished run.', mode: 'Every mode', level: 120, color: '#c18cff', blurb: 'Sleeps on a pile of game balls.' },
];
export const PET_BY_ID = new Map(PETS.map(p => [p.id, p]));
export const PET_COLORS: { id: string; name: string; css: string }[] = [
  { id: 'orange', name: 'Orange', css: '#f4a259' }, { id: 'brown', name: 'Brown', css: '#8a5a3b' }, { id: 'gray', name: 'Gray', css: '#94a0b2' },
  { id: 'black', name: 'Black', css: '#3a3f4b' }, { id: 'cream', name: 'Cream', css: '#f2dfb4' }, { id: 'white', name: 'White', css: '#f4f0e6' },
  { id: 'green', name: 'Green', css: '#55c878' }, { id: 'blue', name: 'Blue', css: '#4da3ff' }, { id: 'purple', name: 'Purple', css: '#c18cff' },
  { id: 'pink', name: 'Pink', css: '#ff9fb0' }, { id: 'gold', name: 'Gold', css: '#ffd166' }, { id: 'red', name: 'Red', css: '#e85d5d' },
];
export const PET_ACCESSORIES: { id: PetAccessory; name: string }[] = [
  { id: 'none', name: 'Nothing' }, { id: 'collar', name: 'Collar' }, { id: 'bandana', name: 'Bandana' }, { id: 'bow', name: 'Bow' },
  { id: 'partyHat', name: 'Party hat' }, { id: 'crown', name: 'Crown' }, { id: 'shades', name: 'Shades' },
];

export interface PetLook { name: string; color: string; accessory: PetAccessory; accent: string }
/** `second`: pets whose second ability you've unlocked (with coins). */
export interface PetState { v: 1; equipped: PetId | null; looks: Partial<Record<PetId, PetLook>>; second?: PetId[] }

/*
 * Second abilities: every pet has a second one, unlocked for SECOND_PRICE coins. It cuts the price of Relic Spins,
 * Lucky Spins and relic upgrades while that pet is with you: a few percent for the early pets, up to 10% for the Dragon.
 */
export const SECOND_PRICE = 15_000;
export const PET_SECOND: Record<PetId, { name: string; discount: number }> = {
  cat: { name: 'Bargain Paws', discount: 0.04 }, dog: { name: 'Fetch a Deal', discount: 0.04 }, parrot: { name: 'Haggler', discount: 0.05 },
  goldfish: { name: 'Small Change', discount: 0.05 }, hamster: { name: 'Coupon Cheeks', discount: 0.06 }, fox: { name: 'Sly Bargain', discount: 0.07 },
  owl: { name: 'Wise Spender', discount: 0.08 }, bunny: { name: 'Lucky Price', discount: 0.08 }, turtle: { name: 'Slow Saver', discount: 0.09 },
  dragon: { name: 'Hoard Keeper', discount: 0.1 },
};
export const secondOpen = (s: PetState, id: PetId) => (s.second ?? []).includes(id);
export const secondBlurb = (id: PetId) => `${PET_SECOND[id].name}: Relic Spins, Lucky Spins and relic upgrades cost ${Math.round(PET_SECOND[id].discount * 100)}% less while it's with you.`;
/** Marks a pet's second ability unlocked (the caller pays the coins). */
export const withSecond = (s: PetState, id: PetId): PetState => (secondOpen(s, id) ? s : { ...s, second: [...(s.second ?? []), id] });
export const PETS_KEY = 'cv-pets';
export const PETS_EVENT = 'cv-pets-changed';

export const petOpen = (id: PetId, level: number) => level >= (PET_BY_ID.get(id)?.level ?? Infinity);
export const defaultLook = (id: PetId): PetLook => ({ name: PET_BY_ID.get(id)!.name, color: PET_BY_ID.get(id)!.color, accessory: 'none', accent: '#e85d5d' });
export const lookOf = (s: PetState, id: PetId): PetLook => ({ ...defaultLook(id), ...(s.looks[id] ?? {}) });

const HEX = /^#[0-9a-f]{6}$/i;
/** Keeps a stored pet state legal (known pets, valid colours, short names). */
export function cleanPets(raw: unknown): PetState {
  const x = raw as Partial<PetState> | null;
  const out: PetState = { v: 1, equipped: null, looks: {} };
  if (!x || typeof x !== 'object') return out;
  if (typeof x.equipped === 'string' && PET_BY_ID.has(x.equipped as PetId)) out.equipped = x.equipped as PetId;
  const second = Array.isArray(x.second) ? [...new Set(x.second.filter(id => PET_BY_ID.has(id)))] : [];
  if (second.length) out.second = second;
  for (const [id, l] of Object.entries(x.looks ?? {})) {
    if (!PET_BY_ID.has(id as PetId) || !l || typeof l !== 'object') continue;
    const d = defaultLook(id as PetId);
    out.looks[id as PetId] = {
      name: typeof l.name === 'string' && l.name.trim() ? l.name.trim().slice(0, 16) : d.name,
      color: typeof l.color === 'string' && HEX.test(l.color) ? l.color : d.color,
      accessory: PET_ACCESSORIES.some(a => a.id === l.accessory) ? l.accessory : 'none',
      accent: typeof l.accent === 'string' && HEX.test(l.accent) ? l.accent : d.accent,
    };
  }
  return out;
}
export function loadPets(read: Read = localRead): PetState {
  try { return cleanPets(JSON.parse(read(PETS_KEY) ?? 'null')); } catch { return cleanPets(null); }
}
export function savePets(s: PetState): void {
  try { localStorage.setItem(PETS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(PETS_EVENT)); } catch { /* no window (tests) */ }
}
/** Brings a pet along (one at a time); null leaves them all at home. Locked pets can't be equipped. */
export const equipPet = (s: PetState, id: PetId | null, level: number): PetState => (id && !petOpen(id, level) ? s : { ...s, equipped: id });
export const setLook = (s: PetState, id: PetId, patch: Partial<PetLook>): PetState => ({ ...s, looks: { ...s.looks, [id]: { ...lookOf(s, id), ...patch } } });

/** The relic-price discount from the pet you bring along (0 unless its second ability is unlocked). */
export function petDiscount(level: number, read: Read = localRead): number {
  const s = loadPets(read), id = s.equipped && petOpen(s.equipped, level) ? s.equipped : null;
  return id && secondOpen(s, id) ? PET_SECOND[id].discount : 0;
}

/** The pet you bring along, if its level is reached (read once when a run starts). */
export function activePet(level: number, read: Read = localRead): PetId | null {
  const s = loadPets(read);
  return s.equipped && petOpen(s.equipped, level) ? s.equipped : null;
}

// ---------------------------------------------------------------- pixel art (14 x 14)

/*
 * o outline · b body (the colour you pick) · d body shade · l light patch · e eye · w eye shine · n nose, beak or fin
 * p inner ear / cheek · s shell or wing (a darker body tone)
 */
export const PET_ART: Record<PetId, string[]> = {
  cat: [
    '..o.......o...', '.obo.....obo..', '.opbooooobpbo.', '.obbbbbbbbbbo.', 'obbewbbbbewbbo', 'obbeebbbbeebbo', 'obbbbbnnbbbbbo',
    '.obbbllllbbbo.', '..oobbbbbboo..', '..obbbbbbbbo..', '.obbbllllbbbo.', '.obbbllllbbbob', '..obboooobboob', '..oo......oo..',
  ],
  dog: [
    '...oooooooo...', '..obbbbbbbbo..', '.odobbbbbbodo.', 'oddobbbbbboddo', 'oddbewbbewbddo', 'oddbeebbeebddo', '.odbbbbbbbbdo.',
    '..obbllllbbo..', '..obllnnllbo..', '...obllllbo...', '..obbbbbbbbo..', '.obbbllllbbbo.', '.obboooooobbo.', '.ooo......ooo.',
  ],
  parrot: [
    '....oooooo....', '...obbbbbbo...', '..obbbbbbbbo..', '..obewbbbbbo..', '.onnebbbbbbo..', 'onnnobbbbbbo..', '.onoobbbbbbbo.',
    '...osbbbbbbbo.', '...ossbbbbbbo.', '...osssbbbbbo.', '....ossbbbbo..', '.....oobbboo..', '......onono...', '.....oo...oo..',
  ],
  goldfish: [
    '..............', '..............', '....ooooo.....', '...obbbbbo..oo', '..obewbbbbo.on', '.obbeebbbbbonn', 'obbbbbbbbbbonn',
    'obbbllbbbbbonn', '.obbllllbbbonn', '..obbbbbbbo.on', '...obnnbbo..oo', '....ooooo.....', '..............', '..............',
  ],
  hamster: [
    '..............', '..oo......oo..', '.opbo....obpo.', '.obbooooooobbo', '.obbbbbbbbbbo.', 'obbewbbbbewbbo', 'obpeebbbbeebpo',
    'obbbbbnnbbbbbo', 'obbllllllllbbo', '.obllllllllbo.', '.obbllllllbbo.', '..obbbbbbbbo..', '..oboo..oobo..', '..oo......oo..',
  ],
  fox: [
    '.o..........o.', 'obo........obo', 'obpo......opbo', 'obbpooooooobbo', '.obbbbbbbbbbo.', 'obbewbbbbewbbo', 'obbeebbbbeebbo',
    '.olllbbbbllo..', '..ollllllnno..', '...olllllo....', '..obbbbbbbo.oo', '.obbllllbbbobl', '.obboooobbbool', '.oo.....oooo..',
  ],
  owl: [
    '..o........o..', '.obo......obo.', '.obbooooooobbo', '.obwwwobwwwbo.', 'obwweewbweewbo', 'obwweewbweewbo', 'obbwwwonnwwwbo',
    '.osbbbonbbbso.', '.ossbllllbsso.', '.ossllbbllsso.', '.ossbllllbsso.', '..osbbbbbbso..', '...onnoonno...', '...oo....oo...',
  ],
  bunny: [
    '...oo....oo...', '..obpo..opbo..', '..obpo..opbo..', '..obpo..opbo..', '..obbooooobbo.', '.obbbbbbbbbbo.', 'obbewbbbbewbbo',
    'obbeebbbbeebbo', 'obpbbbnnbbbpbo', '.obbbllllbbbo.', '..obbllllbbo..', '.obbbllllbbbo.', '.obboooooobbo.', '.ooo......ooo.',
  ],
  turtle: [
    '..............', '....oooooo....', '...ossssssso..', '..osdsssssdso.', '.osssdsssdssso', '.ossssddsssso.', 'oosssssssssso.',
    'obbooooooooobo', 'obewbbbbbbbbbo', 'obeebo.obbo.o.', '.obbo..obbo...', '..oo....oo....', '..............', '..............',
  ],
  dragon: [
    '..o.......o...', '.ono.....ono..', '.obbooooobbo..', '.obbbbbbbbbo.o', 'obbewbbbbewbos', 'obbeebbbbeebos', 'obbbbbnnbbbbos',
    '.obbbllllbbbos', '..obbbbbbbboso', '.osobllllbosso', 'ossobllllbosso', '.oobbbbbbbbo..', '..obboooobbo.o', '..oo......oooo',
  ],
};
/** Where each pet's head top, eyes and neck sit (column, row), for accessories. */
export const PET_ANCHORS: Record<PetId, { head: [number, number]; eyes: [number, number, number]; neck: [number, number, number] }> = {
  cat: { head: [6, 1], eyes: [3, 4, 8], neck: [3, 8, 8] },
  dog: { head: [6, 0], eyes: [4, 4, 6], neck: [3, 9, 8] },
  parrot: { head: [6, 0], eyes: [2, 3, 5], neck: [4, 7, 6] },
  goldfish: { head: [5, 2], eyes: [2, 4, 4], neck: [6, 2, 3] },
  hamster: { head: [6, 2], eyes: [3, 5, 8], neck: [3, 10, 8] },
  fox: { head: [6, 2], eyes: [3, 5, 8], neck: [3, 10, 7] },
  owl: { head: [6, 1], eyes: [3, 4, 8], neck: [3, 7, 8] },
  bunny: { head: [6, 3], eyes: [3, 6, 8], neck: [3, 10, 8] },
  turtle: { head: [2, 7], eyes: [1, 8, 3], neck: [1, 10, 3] },
  dragon: { head: [5, 1], eyes: [3, 4, 8], neck: [3, 8, 8] },
};
