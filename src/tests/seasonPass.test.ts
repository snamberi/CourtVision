// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { noteSeason, markSeasonPaid, seasonTiers, seasonTitles, seasonRule, currentSeason, daysLeft, GLITCH_REWARDS, SEASON_TIERS, SEASON_TIER_XP, SEASON_COSMETIC_EVERY } from '../retention/season';
import { readPass, mergePass, PASS_KEY } from '../retention/pass';
import { paySeasonSpins } from '../relics/rewards';
import { loadRelics, saveRelics, freeLuckySpin, grantLuckySpins, mergeRelics, RELICS_KEY } from '../relics/relics';
import { isOpen, unlockContext, ICONS, NAME_COLORS, earnedExtraTitles } from '../profile/cosmetics';
import { FRAMES, FLOORS, PHONES, unlockOpen, unlockHow } from '../profile/profile';
import { TITLE_COLORS, titleColorOpen } from '../profile/trophyRoad';
import { AVATAR_FRAMES, avatarFrameOpen } from '../profile/avatarFrames';
import { AVATAR_CATEGORIES, avatarHow, avatarItem, type AvatarCategory } from '../profile/avatar';
import { buildAvatarGrid } from '../visuals/avatarSprite';
import { THEME_BY_ID, themeOpen } from '../theme/themes';
import { roadPosition } from '../profile/roadMath';

const oct = (d: number) => new Date(Date.UTC(2026, 9, d, 12));
beforeEach(() => { localStorage.removeItem(PASS_KEY); localStorage.removeItem(RELICS_KEY); });

describe('Season 1: Glitch', () => {
  it('runs October to December and has a cosmetic every 5 tiers', () => {
    expect(currentSeason(oct(11)).id).toBe('glitch');
    expect(daysLeft(currentSeason(oct(11)), oct(11))).toBe(82);
    expect(GLITCH_REWARDS.map(r => r.tier)).toEqual(Array.from({ length: SEASON_TIERS / SEASON_COSMETIC_EVERY }, (_, i) => (i + 1) * SEASON_COSMETIC_EVERY));
    // Every kind the pass promises is in it.
    expect(new Set(GLITCH_REWARDS.map(r => r.kind))).toEqual(new Set(['icon', 'color', 'title', 'titleColor', 'frame', 'floor', 'phone', 'look', 'avatarFrame', 'skin', 'hair', 'hairColor', 'beard', 'outfit', 'hat', 'eyes', 'neck', 'shoes', 'aura']));
  });

  it('starts at your XP on the first look and fills a tier every 100 XP', () => {
    expect(noteSeason(5_000, oct(2)).tier).toBe(0);
    const p = noteSeason(5_000 + SEASON_TIER_XP * 7 + 40, oct(3));
    expect(p).toMatchObject({ tier: 7, into: 40, need: SEASON_TIER_XP, paid: 0 });
    expect(p.newTiers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(seasonTiers()).toEqual({ glitch: 7 });
    // The pass tops out at 100 tiers.
    expect(noteSeason(5_000 + SEASON_TIER_XP * 500, oct(4)).tier).toBe(SEASON_TIERS);
  });

  it('pays one free Lucky Spin per tier, once', () => {
    noteSeason(0, oct(2));
    expect(paySeasonSpins(SEASON_TIER_XP * 3, oct(3))).toBe(3);
    expect(paySeasonSpins(SEASON_TIER_XP * 3, oct(3))).toBe(0);
    expect(loadRelics().luckySpins).toBe(3);
    expect(paySeasonSpins(SEASON_TIER_XP * 5, oct(4))).toBe(2);
    expect(loadRelics().luckySpins).toBe(5);
    expect(readPass().seasons?.glitch).toMatchObject({ tier: 5, paid: 5 });
    expect(markSeasonPaid('glitch', 5)).toBe(0);
  });

  it('a free Lucky Spin is a lucky roll that costs no coins', () => {
    const s = grantLuckySpins({ ...loadRelics(), coins: 10 }, 1);
    const out = freeLuckySpin(s, () => 0.5)!;
    expect(out.result.lucky).toBe(true);
    expect(out.state.luckySpins).toBe(0);
    expect(out.state.coins).toBeGreaterThanOrEqual(10);
    expect(freeLuckySpin(out.state)).toBeNull();
    // Saved and loaded back (a bad value loads as none).
    saveRelics({ ...out.state, luckySpins: 4 });
    expect(loadRelics().luckySpins).toBe(4);
    localStorage.setItem(RELICS_KEY, JSON.stringify({ ...out.state, luckySpins: -3 }));
    expect(loadRelics().luckySpins).toBe(0);
    expect(mergeRelics(loadRelics(), { ...loadRelics(), luckySpins: 2, opens: 999 }).luckySpins).toBe(2);
  });

  it('merges two devices: earliest start, highest tier, most paid', () => {
    const a = { months: {}, seasons: { glitch: { start: 100, tier: 4, paid: 4 } } };
    const b = { months: {}, seasons: { glitch: { start: 50, tier: 9, paid: 2 } } };
    expect(mergePass(a, b).seasons).toEqual({ glitch: { start: 50, tier: 9, paid: 4 } });
    expect(mergePass({ months: {} }, { months: {} }).seasons).toBeUndefined();
  });
});

describe('Glitch cosmetics open with the pass', () => {
  const at = (tier: number) => { localStorage.setItem(PASS_KEY, JSON.stringify({ months: {}, seasons: { glitch: { start: 0, tier, paid: 0 } } })); return unlockContext(1); };

  it('profile icon, name colour, titles and title colour', () => {
    const icon = ICONS.find(i => i.id === 'glitch')!, color = NAME_COLORS.find(c => c.id === 'glitch')!, tc = TITLE_COLORS.find(c => c.id === 'glitch')!;
    expect(isOpen(icon.rule, at(4))).toBe(false);
    expect(isOpen(icon.rule, at(5))).toBe(true);
    expect(isOpen(color.rule, at(10))).toBe(true);
    expect(titleColorOpen(tc, at(59))).toBe(false);
    expect(titleColorOpen(tc, at(60))).toBe(true);
    expect(earnedExtraTitles(at(29))).not.toContain('Glitched');
    expect(earnedExtraTitles(at(30))).toContain('Glitched');
    expect(seasonTitles({ glitch: 100 })).toEqual(['Glitched', 'Corrupted Legend']);
  });

  it('card frame, court floor, phone, picture frame and app look', () => {
    const frame = FRAMES.find(f => f.id === 'glitch')!, floor = FLOORS.find(f => f.id === 'glitch')!, phone = PHONES.find(f => f.id === 'glitch')!;
    at(19);
    expect(unlockOpen(frame, 999, 1e9)).toBe(false);
    expect(unlockHow(frame)).toBe('Season 1 pass tier 20');
    at(50);
    expect(unlockOpen(frame, 1, 0) && unlockOpen(floor, 1, 0) && unlockOpen(phone, 1, 0)).toBe(true);
    const pf = AVATAR_FRAMES.find(f => f.id === 'glitch')!;
    expect(avatarFrameOpen(pf, at(74))).toBe(false);
    expect(avatarFrameOpen(pf, at(75))).toBe(true);
    expect(THEME_BY_ID.get('glitch')).toBeTruthy();
    at(89); expect(themeOpen('glitch', 999, 1e9)).toBe(false);
    at(90); expect(themeOpen('glitch', 1, 0)).toBe(true);
  });

  it('a whole character set, each piece at its tier, and it draws', () => {
    for (const r of GLITCH_REWARDS.filter(r => AVATAR_CATEGORIES.some(c => c.id === r.kind))) {
      const item = avatarItem(r.kind as AvatarCategory, r.id)!;
      expect(item, `${r.kind}:${r.id}`).toBeTruthy();
      expect(item.rule).toEqual(seasonRule(r.kind, r.id));
      expect(avatarHow(item)).toBe(`Season 1 pass tier ${r.tier}`);
      expect(isOpen(item.rule, at(r.tier - 1))).toBe(false);
      expect(isOpen(item.rule, at(r.tier))).toBe(true);
    }
    const look = { skin: 'glitch', hair: 'glitchSpikes', hairColor: 'glitch', beard: 'glitchBeard', outfit: 'glitchSuit', hat: 'glitchHalo', eyes: 'glitchVisor', neck: 'glitchWings', shoes: 'glitch', aura: 'glitch' };
    const { grid, aura } = buildAvatarGrid({ look });
    const colours = new Set(grid.flat().filter(Boolean));
    expect(colours.has('#00f0ff')).toBe(true);
    expect(colours.has('#ff2bd6')).toBe(true);
    expect(aura.flat().some(Boolean)).toBe(true);
  });
});

describe('road placement', () => {
  it('puts each stop in the middle of its column and slides in between', () => {
    expect(roadPosition([10, 20, 30], 10, 100)).toBe(50);
    expect(roadPosition([10, 20, 30], 15, 100)).toBe(100);
    expect(roadPosition([10, 20, 30], 30, 100)).toBe(250);
    expect(roadPosition([10, 20, 30], 999, 100)).toBe(250);
    expect(roadPosition([10, 20, 30], 0, 100)).toBe(0);
  });
});

describe('Season 2: Frozen', () => {
  const jan = (d: number) => new Date(Date.UTC(2027, 0, d, 12));
  it('follows Glitch on January 1st with its own full set', async () => {
    const { currentSeason, nextSeason, daysUntil, FROZEN_REWARDS } = await import('../retention/season');
    expect(nextSeason(oct(11))?.id).toBe('frozen');
    expect(daysUntil(nextSeason(oct(11))!, oct(11))).toBe(82);
    expect(currentSeason(jan(2)).id).toBe('frozen');
    expect(FROZEN_REWARDS.map(r => r.kind)).toEqual(GLITCH_REWARDS.map(r => r.kind));
  });
  it('every Frozen cosmetic exists and opens at its tier', async () => {
    const { FROZEN_REWARDS } = await import('../retention/season');
    localStorage.setItem(PASS_KEY, JSON.stringify({ months: {}, seasons: { frozen: { start: 0, tier: 100, paid: 0 } } }));
    const c = unlockContext(1);
    for (const r of FROZEN_REWARDS) {
      if (AVATAR_CATEGORIES.some(cat => cat.id === r.kind)) expect(isOpen(avatarItem(r.kind as AvatarCategory, r.id)!.rule, c), r.id).toBe(true);
    }
    expect(isOpen(ICONS.find(i => i.id === 'frozen')!.rule, c)).toBe(true);
    expect(isOpen(NAME_COLORS.find(i => i.id === 'frost')!.rule, c)).toBe(true);
    expect(titleColorOpen(TITLE_COLORS.find(t => t.id === 'frozen')!, c)).toBe(true);
    expect(unlockOpen(FRAMES.find(f => f.id === 'frozen')!, 1, 0) && unlockOpen(FLOORS.find(f => f.id === 'frozen')!, 1, 0) && unlockOpen(PHONES.find(f => f.id === 'frozen')!, 1, 0)).toBe(true);
    expect(avatarFrameOpen(AVATAR_FRAMES.find(f => f.id === 'frozen')!, c)).toBe(true);
    expect(themeOpen('frozen', 1, 0)).toBe(true);
    expect(earnedExtraTitles(c)).toEqual(expect.arrayContaining(['Frostbitten', 'Absolute Zero']));
    // Glitch stays locked: each season's tiers are its own.
    expect(themeOpen('glitch', 1, 0)).toBe(false);
    const { grid, aura } = buildAvatarGrid({ look: { skin: 'frozen', hair: 'iceSpikes', hairColor: 'frozen', beard: 'frostBeard', outfit: 'frostParka', hat: 'iceCrown', eyes: 'snowGoggles', neck: 'frostCape', shoes: 'iceSkates', aura: 'blizzard' } });
    expect(new Set(grid.flat()).has('#9fd8ff')).toBe(true);
    expect(aura.flat().some(Boolean)).toBe(true);
  });
});

describe('Season 3: Inferno', () => {
  it('follows Frozen on April 1st with every cosmetic opening at its tier', async () => {
    const { currentSeason, INFERNO_REWARDS } = await import('../retention/season');
    expect(currentSeason(new Date(Date.UTC(2027, 3, 2, 12))).id).toBe('inferno');
    expect(INFERNO_REWARDS.map(r => r.kind)).toEqual(GLITCH_REWARDS.map(r => r.kind));
    localStorage.setItem(PASS_KEY, JSON.stringify({ months: {}, seasons: { inferno: { start: 0, tier: 100, paid: 0 } } }));
    const c = unlockContext(1);
    for (const r of INFERNO_REWARDS) {
      if (AVATAR_CATEGORIES.some(cat => cat.id === r.kind)) expect(isOpen(avatarItem(r.kind as AvatarCategory, r.id)!.rule, c), r.id).toBe(true);
    }
    expect(isOpen(ICONS.find(i => i.id === 'inferno')!.rule, c)).toBe(true);
    expect(isOpen(NAME_COLORS.find(i => i.id === 'magma')!.rule, c)).toBe(true);
    expect(titleColorOpen(TITLE_COLORS.find(t => t.id === 'inferno')!, c)).toBe(true);
    expect(unlockOpen(FRAMES.find(f => f.id === 'inferno')!, 1, 0) && unlockOpen(FLOORS.find(f => f.id === 'inferno')!, 1, 0) && unlockOpen(PHONES.find(f => f.id === 'inferno')!, 1, 0)).toBe(true);
    expect(avatarFrameOpen(AVATAR_FRAMES.find(f => f.id === 'inferno')!, c)).toBe(true);
    expect(themeOpen('inferno', 1, 0)).toBe(true);
    expect(earnedExtraTitles(c)).toEqual(expect.arrayContaining(['Scorched', 'Living Inferno']));
    expect(themeOpen('frozen', 1, 0)).toBe(false);
    const { grid, aura } = buildAvatarGrid({ look: { skin: 'inferno', hair: 'magmaSpikes', hairColor: 'inferno', beard: 'emberBeard', outfit: 'magmaArmor', hat: 'flameCrown', eyes: 'lavaGoggles', neck: 'flameCape', shoes: 'magmaBoots', aura: 'inferno' } });
    expect(new Set(grid.flat()).has('#ff4d2e')).toBe(true);
    expect(aura.flat().some(Boolean)).toBe(true);
  });
});

describe('streak bonus and tier-up rewards', () => {
  it('adds pass XP once a day for the streak, capped at 10 days', async () => {
    const { claimStreakBonus, streakBonus } = await import('../retention/season');
    expect(streakBonus(3)).toBe(30);
    expect(streakBonus(40)).toBe(100);
    noteSeason(0, oct(2));
    expect(claimStreakBonus(5, 0, oct(3))).toBe(50);
    expect(claimStreakBonus(5, 0, oct(3))).toBe(0);
    expect(claimStreakBonus(6, 0, oct(4))).toBe(60);
    expect(noteSeason(0, oct(4)).tier).toBe(1);
    expect(readPass().seasons?.glitch.bonus).toBe(110);
  });
  it('reports the cosmetics new tiers unlocked, once', async () => {
    const { paySeasonRewards } = await import('../relics/rewards');
    noteSeason(0, oct(2));
    const first = paySeasonRewards(SEASON_TIER_XP * 11, oct(3));
    expect(first.spins).toBe(11);
    expect(first.cosmetics.map(c => c.tier)).toEqual([5, 10]);
    expect(paySeasonRewards(SEASON_TIER_XP * 11, oct(3))).toEqual({ spins: 0, cosmetics: [] });
    expect(paySeasonRewards(SEASON_TIER_XP * 15, oct(4)).cosmetics.map(c => c.id)).toEqual(['glitch']);
  });
});
