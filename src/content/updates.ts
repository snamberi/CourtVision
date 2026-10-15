import { RELEASES, type Release } from './whatsNew';

/*
 * The Updates hub: every release with its own theme, a short headline for each thing it added ("Clans", "Career
 * Mode"), and the full description one tap away. Themes come from the release (`theme`) or from its title.
 */

export interface UpdateTheme { id: string; name: string; accent: string; bg: string; icon: string }
export const UPDATE_THEMES: Record<string, UpdateTheme> = {
  fire: { id: 'fire', name: 'Inferno', accent: '#ff7a3d', bg: '#3a140a', icon: 'flame' },
  ice: { id: 'ice', name: 'Frozen', accent: '#8fd8ff', bg: '#0e2a3d', icon: 'ice' },
  glitch: { id: 'glitch', name: 'Glitch', accent: '#c18cff', bg: '#24133d', icon: 'grid' },
  spooky: { id: 'spooky', name: 'Spooky', accent: '#ff9d3d', bg: '#25122e', icon: 'star' },
  relic: { id: 'relic', name: 'Relics', accent: '#ffd166', bg: '#2e2410', icon: 'crown' },
  career: { id: 'career', name: 'Career', accent: '#55c878', bg: '#10291b', icon: 'jersey' },
  social: { id: 'social', name: 'Together', accent: '#4da3ff', bg: '#0f2240', icon: 'team' },
  story: { id: 'story', name: 'Story', accent: '#e0a7ff', bg: '#26163a', icon: 'book' },
  world: { id: 'world', name: 'World', accent: '#55c8c8', bg: '#0d2a2d', icon: 'globe' },
  arcade: { id: 'arcade', name: 'Arcade', accent: '#ff6fa8', bg: '#33122a', icon: 'cards' },
  balance: { id: 'balance', name: 'Balance', accent: '#94a0b2', bg: '#1a2230', icon: 'chart' },
  court: { id: 'court', name: 'Court', accent: '#f47b20', bg: '#2b1a0c', icon: 'court' },
};
/** Title words that pick a theme (first match wins). */
const THEME_WORDS: [RegExp, string][] = [
  [/inferno|fire/i, 'fire'], [/frozen|winter|christmas/i, 'ice'], [/glitch/i, 'glitch'], [/halloween|spooky/i, 'spooky'],
  [/relic|secret|shop|cosmetic|season pass/i, 'relic'], [/career|player|myplayer/i, 'career'],
  [/clan|club|friend|online|gift|profile|leaderboard/i, 'social'], [/story|survival/i, 'story'], [/world/i, 'world'],
  [/quick game|grid|guess|quiz|categor|1v1|arcade/i, 'arcade'], [/balance|ratings|stat|fix/i, 'balance'],
];
export function themeOf(r: Release): UpdateTheme {
  if (r.theme && UPDATE_THEMES[r.theme]) return UPDATE_THEMES[r.theme];
  for (const [re, id] of THEME_WORDS) if (re.test(r.title)) return UPDATE_THEMES[id];
  return UPDATE_THEMES.court;
}

/** One thing a release added: its headline (the bold lead-in, or the first words) and the full text. */
export interface UpdateItem { head: string; text: string }
export function itemsOf(r: Release): UpdateItem[] {
  return r.items.map(text => {
    const bold = text.match(/^\*\*([^*]+?)[:.]?\*\*/);
    if (bold) return { head: bold[1].trim().replace(/[:.]$/, ''), text };
    const plain = text.replace(/\*\*/g, '');
    const first = plain.split(/[.:;]\s/)[0];
    return { head: first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first, text };
  });
}

/** Release number (the first one is Update 1). */
export const updateNumber = (r: Release) => RELEASES.length - RELEASES.indexOf(r);

/** Releases matching a search (title or any item), newest first. */
export function searchUpdates(q: string, list: Release[] = RELEASES): Release[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list.filter(r => r.title.toLowerCase().includes(t) || r.items.some(i => i.toLowerCase().includes(t)));
}
