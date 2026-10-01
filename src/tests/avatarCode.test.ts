import { describe, expect, it } from 'vitest';
import { encodeAvatar, decodeAvatar, AVATAR_CODE_MAX } from '../profile/avatarCode';
import { AVATAR_CATEGORIES, DEFAULT_AVATAR, randomAvatar, type AvatarLook } from '../profile/avatar';
import { AVATAR_FRAMES } from '../profile/avatarFrames';
import { REAL_FRANCHISES } from '../profile/favorites';
import { SNAPSHOT } from './avatarCode.snapshot';

describe('avatar look code', () => {
  it('round-trips every piece, the jersey and the frame', () => {
    for (const c of AVATAR_CATEGORIES) for (const item of c.items) {
      const look: AvatarLook = { ...DEFAULT_AVATAR, [c.id]: item.id, kitTeam: REAL_FRANCHISES[7].id, kitNumber: 42 };
      const code = encodeAvatar(look, 'goldCrown');
      expect(code.length).toBeLessThanOrEqual(AVATAR_CODE_MAX);
      expect(decodeAvatar(code)).toEqual({ look, frame: 'goldCrown' });
    }
  });
  it('round-trips random characters', () => {
    let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) { const look = randomAvatar(rand, () => true); expect(decodeAvatar(encodeAvatar(look))?.look).toEqual(look); }
  });
  it('rejects junk and other versions', () => {
    for (const bad of ['', 'x', '2.0.0.0.0.0.0.0.0.0.0', '1.0.0', '1.<script>', '1.' + 'z'.repeat(80), null, undefined]) expect(decodeAvatar(bad as string)).toBeNull();
  });
  it('keeps every list append-only (a piece’s place is its code)', () => {
    for (const [cat, ids] of Object.entries(SNAPSHOT.pieces)) expect(AVATAR_CATEGORIES.find(c => c.id === cat)!.items.slice(0, ids.length).map(i => i.id)).toEqual(ids);
    expect(REAL_FRANCHISES.slice(0, SNAPSHOT.teams.length).map(t => t.id)).toEqual(SNAPSHOT.teams);
    expect(AVATAR_FRAMES.slice(0, SNAPSHOT.frames.length).map(f => f.id)).toEqual(SNAPSHOT.frames);
  });
});

describe('the character on the boards (server)', () => {
  const blob = (look: object, frame: string) => ({ version: 1 as const, updatedAt: 1, careers: [], storage: { 'cv-avatar': JSON.stringify({ ...DEFAULT_AVATAR, ...look, at: 5 }), 'cv-profile-equip': JSON.stringify({ avatarFrame: frame }) } });
  it('keeps earned pieces and frames, and drops ones that need an honor or level you lack', async () => {
    const { publicAvatar } = await import('../../server/derive');
    const ok = decodeAvatar(publicAvatar(blob({ aura: 'hunter', outfit: 'jersey-red' }, 'goldCrown'), 20, ['hunt-week-10', 'ranked-1']));
    expect(ok?.look.aura).toBe('hunter'); expect(ok?.frame).toBe('goldCrown');
    const stripped = decodeAvatar(publicAvatar(blob({ aura: 'hunter', outfit: 'astronaut' }, 'goldCrown'), 20, ['ranked-3']));
    expect(stripped?.look.aura).toBe(DEFAULT_AVATAR.aura);
    expect(stripped?.look.outfit).toBe(DEFAULT_AVATAR.outfit); // the space suit is level 150
    expect(stripped?.frame).toBe('none');
    expect(decodeAvatar(publicAvatar(blob({}, 'bronzeCrest'), 20, ['ranked-1']))?.frame).toBe('bronzeCrest');
  });
});
