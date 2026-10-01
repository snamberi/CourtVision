// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { OWNER_ACCESS_KEY, OWNER_TITLE, hasOwnerAccess, noteOwnerAccess } from '../profile/ownerAccess';
import { ICONS, NAME_COLORS, unlockContext, isOpen, earnedExtraTitles } from '../profile/cosmetics';
import { AVATAR_CATEGORIES } from '../profile/avatar';
import { AVATAR_FRAMES, avatarFrameOpen } from '../profile/avatarFrames';
import { TITLE_COLORS, titleColorOpen } from '../profile/trophyRoad';
import { FRAMES, FLOORS, unlockOpen, equip, equipped, rankTitles } from '../profile/profile';
import { THEMES, themeOpen } from '../theme/themes';

beforeEach(() => { localStorage.clear(); });

describe('game-owner access', () => {
  it('is off unless the account says so, and signing out forgets it', () => {
    expect(hasOwnerAccess()).toBe(false);
    expect(unlockContext(1).staff).toBeUndefined();
    noteOwnerAccess(true);
    expect(localStorage.getItem(OWNER_ACCESS_KEY)).toBe('1');
    noteOwnerAccess(false);
    expect(hasOwnerAccess()).toBe(false);
  });

  it('opens every cosmetic at level 1', () => {
    expect(ICONS.every(i => isOpen(i.rule, unlockContext(1)))).toBe(false);
    noteOwnerAccess(true);
    const ctx = unlockContext(1);
    expect(ICONS.every(i => isOpen(i.rule, ctx))).toBe(true);
    expect(NAME_COLORS.every(c => isOpen(c.rule, ctx))).toBe(true);
    expect(AVATAR_CATEGORIES.every(c => c.items.every(i => isOpen(i.rule, ctx)))).toBe(true);
    expect(AVATAR_FRAMES.every(f => avatarFrameOpen(f, ctx))).toBe(true);
    expect(TITLE_COLORS.every(c => titleColorOpen(c, ctx))).toBe(true);
    expect([...FRAMES, ...FLOORS].every(u => unlockOpen(u, 1, 0))).toBe(true);
    expect(THEMES.every(t => themeOpen(t.id, 1, 0))).toBe(true);
    expect(earnedExtraTitles(ctx)).toContain(OWNER_TITLE);
    expect(rankTitles()).toContain('Legend GM');
  });

  it('lets the owner equip the top rewards', () => {
    noteOwnerAccess(true);
    equip({ avatarFrame: 'goldCrown', title: OWNER_TITLE, frame: FRAMES[FRAMES.length - 1].id });
    const e = equipped(1);
    expect(e.avatarFrame).toBe('goldCrown');
    expect(e.title).toBe(OWNER_TITLE);
    expect(e.frame).toBe(FRAMES[FRAMES.length - 1].id);
  });
});
