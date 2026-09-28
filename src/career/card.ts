/** A career card's finish: by overall (bronze, silver, gold, holo), foil once he is in the Hall of Fame. */
export type CardTier = 'bronze' | 'silver' | 'gold' | 'holo' | 'foil';
export function cardTier(ovr: number, hallOfFame = false): CardTier {
  if (hallOfFame) return 'foil';
  return ovr >= 90 ? 'holo' : ovr >= 80 ? 'gold' : ovr >= 70 ? 'silver' : 'bronze';
}
