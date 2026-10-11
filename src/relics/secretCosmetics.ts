/*
 * Secret cosmetics: eight pieces that only a spin can drop (any spin, with a small chance; a Lucky Spin doubles it).
 * They are kept with the shop cosmetics you own (RelicState.cosmetics), under these keys, and each piece carries a
 * { shop: key } rule in its own list. No imports here, so the vault and the cosmetic lists can both use it.
 */
export const SECRET_COSMETIC_KEYS = [
  'secret-skin-nebula', 'secret-hairColor-phantom', 'secret-shoes-stardust', 'secret-outfit-shadowTux',
  'secret-crown-void', 'secret-goat-cosmic', 'secret-prism', 'secret-tc-eclipse',
] as const;
/** The chance a spin also drops a secret cosmetic you don't have yet (doubled on a Lucky Spin). */
export const SECRET_COSMETIC_CHANCE = 0.003;
export const isSecretCosmetic = (key: string) => key.startsWith('secret-');
export const SECRET_HOW = 'Secret · drops from Relic Vault spins';
