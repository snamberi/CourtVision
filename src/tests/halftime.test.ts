import { describe, it, expect } from 'vitest';
import { simulateGame } from '../simulation/engine/game';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { speechOutcome } from '../simulation/halftime';

const gen = generateFullLeague(12, 2, 13, 4).league;
const side = (i: number, id: string) => ({ teamId: id, seasons: gen.teams[i].seasons, coach: gen.teams[i].coach });
const sim = (seed: number, liveCoaching?: Parameters<typeof simulateGame>[0]['liveCoaching']) => simulateGame({ home: side(0, 'H'), away: side(1, 'A'), settings: { ...DEFAULT_GAME_SETTINGS, injuriesEnabled: false, seed }, liveCoaching });

describe('halftime speech', () => {
  it('reactions depend on the speech, the score and personalities, within -3..+4', () => {
    const roster = gen.teams[0].seasons, starters = roster.slice(0, 5).map(p => p.playerId);
    for (const speech of ['fiery', 'calm', 'callout', 'bench'] as const) for (const margin of [-15, 0, 15]) {
      const o = speechOutcome(speech, roster, margin, starters);
      expect(o.reactions).toHaveLength(roster.length);
      for (const r of o.reactions) { expect(r.delta).toBeGreaterThanOrEqual(-3); expect(r.delta).toBeLessThanOrEqual(4); }
    }
    const bench = speechOutcome('bench', roster, 0, starters);
    expect(bench.reactions.filter(r => !starters.includes(r.playerId)).every(r => r.delta >= 1)).toBe(true);
  });
  it('leaves the first half exactly as it was and changes the second', () => {
    const base = sim(5);
    const half = base.possessionLog.findIndex(e => e.quarter > 2);
    const boost = Object.fromEntries(gen.teams[0].seasons.map(p => [p.playerId, 4]));
    const g = sim(5, [{ kind: 'speech', atPossession: half, teamId: 'H', speech: 'fiery', boost }]);
    expect(g.possessionLog.slice(0, half)).toEqual(base.possessionLog.slice(0, half));
    expect(g.possessionLog.slice(half)).not.toEqual(base.possessionLog.slice(half));
  });
});
