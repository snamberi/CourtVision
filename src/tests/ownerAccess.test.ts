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

describe('Game Owner only items', () => {
  it('are closed and hidden for everyone else, open for the owner', async () => {
    const { AVATAR_CATEGORIES, SOVEREIGN_LOOK, isOwnerPiece } = await import('../profile/avatar');
    const { listedFor } = await import('../profile/profile');
    const { AVATAR_FRAMES } = await import('../profile/avatarFrames');
    const staffIcon = ICONS.find(i => i.id === 'sovereign')!;
    expect(isOpen(staffIcon.rule, unlockContext(750))).toBe(false);
    expect(listedFor(FRAMES).some(f => f.id === 'sovereign')).toBe(false);
    expect(listedFor(FLOORS).some(f => f.id === 'celestial')).toBe(false);
    expect(unlockOpen(FRAMES.find(f => f.id === 'sovereign')!, 750, 1e9)).toBe(false);
    expect(avatarFrameOpen(AVATAR_FRAMES.find(f => f.id === 'sovereign')!, { level: 750, trophies: 1e9, honors: ['ranked-1'] })).toBe(false);
    expect(titleColorOpen(TITLE_COLORS.find(c => c.id === 'sovereign')!, { trophies: 1e9 })).toBe(false);
    // Every piece of the owner's character is an owner piece.
    for (const c of AVATAR_CATEGORIES) if (c.id !== 'beard') expect(isOwnerPiece(c.items.find(i => i.id === SOVEREIGN_LOOK[c.id])!)).toBe(true);
    noteOwnerAccess(true);
    expect(isOpen(staffIcon.rule, unlockContext(1))).toBe(true);
    expect(listedFor(FRAMES).some(f => f.id === 'sovereign')).toBe(true);
    equip({ frame: 'sovereign', floor: 'celestial', avatarFrame: 'sovereign', icon: 'sovereign', color: 'sovereign', titleColor: 'sovereign' });
    expect(equipped(1)).toMatchObject({ frame: 'sovereign', floor: 'celestial', avatarFrame: 'sovereign', icon: 'sovereign', color: 'sovereign', titleColor: 'sovereign' });
  });

  it('the boards show the owner character only for the owner account', async () => {
    const { publicAvatar } = await import('../../server/derive');
    const { decodeAvatar } = await import('../profile/avatarCode');
    const { SOVEREIGN_LOOK } = await import('../profile/avatar');
    const blob = { version: 1 as const, updatedAt: 1, careers: [], storage: { 'cv-avatar': JSON.stringify({ ...SOVEREIGN_LOOK, at: 5 }), 'cv-profile-equip': JSON.stringify({ avatarFrame: 'sovereign' }) } };
    const other = decodeAvatar(publicAvatar(blob, 750, ['ranked-1']));
    expect(other?.look.hat).not.toBe('blueCrown');
    expect(other?.frame).toBe('none');
    const owner = decodeAvatar(publicAvatar(blob, 1, [], true));
    expect(owner?.look).toMatchObject({ hat: 'blueCrown', neck: 'blackWings', aura: 'cosmicFire', skin: 'abyss', eyes: 'voidFace' });
    expect(owner?.frame).toBe('sovereign');
  });
});
