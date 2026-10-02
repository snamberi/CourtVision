// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { rivalAlerts, dismissRival, rivalSeen } from '../cloud/rivals';

beforeEach(() => localStorage.clear());

describe('Friend rivalry alerts', () => {
  it('flags friends ahead of you on each board, closest races first', () => {
    const weekly = [
      { user_id: 'me', username: 'me', score: 1000, board: 'hunt' },
      { user_id: 'sam', username: 'sam', score: 1100, board: 'hunt' },
      { user_id: 'ana', username: 'ana', score: 900, board: 'hunt' },
      { user_id: 'ana', username: 'ana', score: 15020, board: 'perfect' },
      { user_id: 'me', username: 'me', score: 14317, board: 'perfect' },
      { user_id: 'sam', username: 'sam', score: 80, board: 'career' },
    ];
    const daily = [{ user_id: 'ana', username: 'ana', score: 1200 }];
    const out = rivalAlerts('me', weekly, daily, '2026-W40', '2026-10-02');
    expect(out.map(a => `${a.board}:${a.friend}`)).toEqual(['perfect:ana', 'hunt:sam', 'career:sam', 'daily:ana']);
    expect(out[0]).toMatchObject({ theirs: 15020, mine: 14317, id: 'perfect:2026-W40:ana:15020' });
    expect(out.find(a => a.board === 'career')!.mine).toBeNull();
    expect(out.some(a => a.friend === 'ana' && a.board === 'hunt')).toBe(false);
  });
  it('remembers dismissed alerts until the score moves', () => {
    dismissRival(['hunt:2026-W40:sam:1100']);
    expect(rivalSeen('hunt:2026-W40:sam:1100')).toBe(true);
    expect(rivalSeen('hunt:2026-W40:sam:1250')).toBe(false);
  });
});
