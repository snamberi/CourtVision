/* The Ctrl+K quick jump's search and the keyboard shortcut list (src/components/QuickJump.tsx draws them). */

export interface JumpItem { label: string; tab: string; group: string; sub?: 'awards' | 'rules'; /** Players and teams are found by name once you type. */ kind?: 'player' | 'team'; id?: string }

/** Search words: a page matches when every word starts a word of its name or group ("fr ag" finds Free Agents). */
export function matchJump(items: JumpItem[], query: string): JumpItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items.filter(i => !i.kind);
  if (query.trim().length < 2) items = items.filter(i => !i.kind);
  const scored = items.map(item => {
    const name = item.label.toLowerCase(), hay = `${name} ${item.group.toLowerCase()}`.split(/[\s'/-]+/);
    if (!words.every(w => hay.some(h => h.startsWith(w)) || name.includes(w))) return null;
    return { item, score: (name.startsWith(words[0]) ? 0 : hay.some(h => h.startsWith(words[0])) ? 1 : 2) + (item.kind === 'player' ? 0.5 : item.kind === 'team' ? 0.25 : 0) };
  }).filter((x): x is { item: JumpItem; score: number } => !!x);
  return scored.sort((a, b) => a.score - b.score).map(x => x.item);
}

export const SHORTCUTS: [string, string][] = [
  ['Ctrl + K  or  /', 'Find any page, player or team'],
  ['N', 'Sim the next game day'],
  ['D', 'Dashboard'],
  ['R', 'Roster'],
  ['T', 'Trade'],
  ['S', 'Standings'],
  ['F', 'Free agents'],
  ['P', 'Player stats'],
  ['W', 'Sim the next 7 game days'],
  ['L', 'Lineup Lab'],
  ['I', 'Inbox'],
  ['Alt + ←', 'Back'],
  ['Ctrl + S', 'Export your universe'],
  ['?', 'This list'],
  ['Esc', 'Close a pop-up'],
];

/** True when a key press is meant for a text box, not for a shortcut. */
export function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
