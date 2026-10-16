import { describe, expect, it } from 'vitest';
import { MODE_CATALOG, subModesOf, modesIn } from '../menu/modeCatalog';
import { pixelIconPath } from '../components/pixelIconData';
import { goldUnlocked, GOLD_UNLOCK_SECONDS } from '../lib/menuStyle';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe('mode catalog', () => {
  it('gives every mode and sub-mode a unique id, a real pixel icon, art colours and no emoji', () => {
    const ids = MODE_CATALOG.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const fallback = pixelIconPath('__none__').d;
    for (const m of MODE_CATALOG) {
      expect(pixelIconPath(m.icon).d, m.icon).not.toBe(m.icon === 'court' ? '' : fallback);
      expect(m.art.every(c => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
      expect(EMOJI.test(m.title + m.desc)).toBe(false);
      expect(m.desc.length).toBeLessThan(80);
    }
  });
  it('covers the franchise sub-modes, every quick game and the GM Tournament', () => {
    expect(subModesOf('franchise').map(m => m.id)).toEqual(['decade', 'dynasty', 'rebuild', 'draft', 'timeMachine', 'worldgames']);
    expect(modesIn('quick', 'compete').filter(m => m.action.kind === 'arcade').map(m => m.action.kind === 'arcade' && m.action.tab).sort())
      .toEqual(['bracket', 'categorize', 'dailyDraft', 'grid', 'guess', 'guessTeam', 'hilo', 'legends', 'oneOnOne', 'quiz', 'street', 'tour']);
  });
  it('unlocks Gold Arcade at 24 hours played', () => {
    expect(goldUnlocked(GOLD_UNLOCK_SECONDS - 1)).toBe(false);
    expect(goldUnlocked(GOLD_UNLOCK_SECONDS)).toBe(true);
  });
});
