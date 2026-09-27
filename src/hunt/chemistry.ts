import type { HuntCard } from './cards';
import type { HuntEra } from './eras';

/*
 * Chemistry in League Hunt: players who belong together play better together. Bonuses are overall points added
 * to each card involved, for the game being played:
 *  - Teammates: two or more cards from the same real team-season (Jordan + Pippen '96): +2 each, +3 for three or more.
 *  - Franchise: cards from the same franchise in different seasons: +1 each.
 *  - Home era: three or more cards from the era of the stop being played: +1 each.
 *  - Frenemies: famous rivals on the same side: +2 each (they push each other).
 *  - Balance: a real center and a real point guard among the starters: +1 for the starters; no center at all: −2 for the frontcourt.
 * The best of each kind counts; bonuses from different kinds add up.
 */

export interface ChemistryBond { kind: 'teammates' | 'franchise' | 'era' | 'rivals' | 'balance'; label: string; cards: string[]; bonus: number }

/** Famous rivals, by display name. */
const RIVALS: [string, string][] = [
  ['Larry Bird', 'Magic Johnson'], ['Bill Russell', 'Wilt Chamberlain'], ['Michael Jordan', 'Isiah Thomas'],
  ['Shaquille O\'Neal', 'Kobe Bryant'], ['LeBron James', 'Stephen Curry'], ['Tim Duncan', 'Kevin Garnett'],
  ['Reggie Miller', 'Patrick Ewing'], ['Hakeem Olajuwon', 'David Robinson'], ['Kareem Abdul-Jabbar', 'Wilt Chamberlain'],
  ['Kobe Bryant', 'Paul Pierce'], ['Kevin Durant', 'LeBron James'], ['Jerry West', 'Bill Russell'],
];

/** Every bond in a squad for a game in `era` (starters = the five best). */
export function chemistry(cards: HuntCard[], era?: HuntEra): ChemistryBond[] {
  const bonds: ChemistryBond[] = [];
  const group = (key: (c: HuntCard) => string) => {
    const m = new Map<string, HuntCard[]>();
    for (const c of cards) { const k = key(c); (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return [...m.entries()].filter(([, v]) => v.length >= 2);
  };
  for (const [, list] of group(c => `${c.team}@${c.end}`)) {
    bonds.push({ kind: 'teammates', label: `${list[0].end - 1}-${String(list[0].end).slice(2)} ${list[0].teamName} teammates`, cards: list.map(c => c.id), bonus: list.length >= 3 ? 3 : 2 });
  }
  const inTeammates = new Set(bonds.flatMap(b => b.cards));
  for (const [, list] of group(c => c.franchise)) {
    const fresh = list.filter(c => !inTeammates.has(c.id) || list.some(o => o.end !== c.end));
    if (new Set(fresh.map(c => c.end)).size < 2) continue;
    bonds.push({ kind: 'franchise', label: `${list[list.length - 1].teamName} franchise`, cards: fresh.map(c => c.id), bonus: 1 });
  }
  if (era) {
    const home = cards.filter(c => c.end >= era.from && c.end <= era.to);
    if (home.length >= 3) bonds.push({ kind: 'era', label: `Home era: ${era.label}`, cards: home.map(c => c.id), bonus: 1 });
  }
  for (const [a, b] of RIVALS) {
    const x = cards.find(c => c.name === a), y = cards.find(c => c.name === b);
    if (x && y) bonds.push({ kind: 'rivals', label: `Frenemies: ${a} & ${b}`, cards: [x.id, y.id], bonus: 2 });
  }
  const starters = [...cards].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  const hasC = cards.some(c => c.pos === 'C'), startC = starters.some(c => c.pos === 'C'), startPG = starters.some(c => c.pos === 'PG' || c.pos === 'G');
  if (startC && startPG) bonds.push({ kind: 'balance', label: 'Balanced lineup: a center and a point guard start', cards: starters.map(c => c.id), bonus: 1 });
  if (!hasC) bonds.push({ kind: 'balance', label: 'No center: the frontcourt gets pushed around', cards: cards.filter(c => c.pos === 'PF' || c.pos === 'F').map(c => c.id), bonus: -2 });
  return bonds;
}

/** Total chemistry bonus per card id (bonds of the same kind don't stack on one card; different kinds do). */
export function chemistryBonus(bonds: ChemistryBond[]): Map<string, number> {
  const best = new Map<string, Map<string, number>>();
  for (const b of bonds) for (const id of b.cards) {
    const m = best.get(id) ?? best.set(id, new Map()).get(id)!;
    m.set(b.kind, Math.abs(b.bonus) > Math.abs(m.get(b.kind) ?? 0) ? b.bonus : (m.get(b.kind) ?? 0));
  }
  return new Map([...best].map(([id, m]) => [id, [...m.values()].reduce((a, v) => a + v, 0)]));
}
