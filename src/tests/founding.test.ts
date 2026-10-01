// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { noteFoundingAccount, hasFoundingAccount, FOUNDING_TITLE } from '../profile/founding';
import { unlockContext, earnedExtraTitles } from '../profile/cosmetics';
import { AVATAR_FRAMES, avatarFrameOpen, avatarFrameHow } from '../profile/avatarFrames';
import { nudgeDue } from '../components/cloud/SaveSafetyNudge';

beforeEach(() => localStorage.clear());
const founding = AVATAR_FRAMES.find(f => f.id === 'founding')!;

describe('Founding GM', () => {
  it('opens the title and the frame once this browser has signed in, and keeps them', () => {
    expect(AVATAR_FRAMES.at(-1)?.id).toBe('founding'); // the list is append-only (look codes)
    expect(hasFoundingAccount()).toBe(false);
    expect(earnedExtraTitles(unlockContext(1))).not.toContain(FOUNDING_TITLE);
    expect(avatarFrameOpen(founding, unlockContext(1))).toBe(false);
    expect(avatarFrameHow(founding)).toBe('Create a free account');
    expect(noteFoundingAccount()).toBe(true);
    expect(noteFoundingAccount()).toBe(false);
    expect(earnedExtraTitles(unlockContext(1))).toContain(FOUNDING_TITLE);
    expect(avatarFrameOpen(founding, unlockContext(1))).toBe(true);
  });
  it('reminds a guest about saves after three hours or three careers', () => {
    expect(nudgeDue(2 * 3600, 2)).toBe(false);
    expect(nudgeDue(3 * 3600, 0)).toBe(true);
    expect(nudgeDue(0, 3)).toBe(true);
  });
});
