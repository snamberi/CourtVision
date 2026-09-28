import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { collectPress, answerPress, pressState, pressMood, aroundTheLeague } from '../simulation/press';
import { ensureFrontOffice } from '../simulation/frontOffice';
import { playerMorale } from '../simulation/personality';

const { league: base, extras } = generateFullLeague(71, 10, 13, 30, '2026', { priorSeasons: false });
const me = base.teams[0].teamId;
const played = simulateRounds(ensureFrontOffice(base, me), 25, 4);

describe('press room', () => {
  it('queues press conferences from real results, at most three, and is stable when nothing is new', () => {
    const l = collectPress(played, me);
    const s = pressState(l);
    expect(s.gamesSeen).toBeGreaterThan(10);
    expect(s.pending.length).toBeGreaterThan(0);
    expect(s.pending.length).toBeLessThanOrEqual(3);
    expect(collectPress(l, me)).toBe(l);
    for (const c of s.pending) { expect(c.answers).toHaveLength(3); expect(c.question.length).toBeGreaterThan(10); }
  });

  it('answers move fans, the owner and the locker room', () => {
    const l = collectPress(played, me);
    const c = pressState(l).pending[0];
    const a = [...c.answers].sort((x, y) => Math.abs(y.effects.team ?? 0) - Math.abs(x.effects.team ?? 0))[0];
    const after = answerPress(l, c.id, a.id, me);
    const s = pressState(after);
    expect(s.pending.some(p => p.id === c.id)).toBe(false);
    expect(s.log.at(-1)!.answer).toBe(a.text);
    expect(s.fans).toBe(Math.max(0, Math.min(100, pressState(l).fans + (a.effects.fans ?? 0))));
    if (a.effects.owner) expect(after.frontOffice!.security).not.toBe(l.frontOffice!.security);
    if (a.effects.team) {
      const p = after.teams[0].seasons[0];
      expect(pressMood(after, p.playerId)).not.toBe(0);
      const factor = playerMorale(p, after.teams[0], after, extras).factors.find(f => f.label === 'What the coach said to the press');
      expect(factor).toBeDefined();
    }
  });

  it('overflow from a long sim is logged as "no comment" and costs a little fan mood, never silently lost', () => {
    const l = collectPress(played, me);
    const s = pressState(l);
    const skipped = s.lastSkipped ?? 0;
    expect(skipped).toBeGreaterThan(0); // 25 game days produce more than three press moments
    const noComment = s.log.filter(r => r.tone === 'No comment');
    expect(noComment).toHaveLength(skipped);
    if (skipped) expect(s.fans).toBeLessThan(55 + 25 * 0.35);
    const all = new Set([...s.pending.map(p => p.id), ...s.log.map(r => r.id)]);
    expect(all.size).toBe(s.pending.length + s.log.length);
  });

  it('builds an Around the League segment from what happened', () => {
    const stories = aroundTheLeague(played, extras, me);
    expect(stories.length).toBeGreaterThan(0);
    for (const s of stories) expect(s.text.length).toBeGreaterThan(10);
  });
});
