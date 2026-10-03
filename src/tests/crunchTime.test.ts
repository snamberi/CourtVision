import { describe, it, expect } from 'vitest';
import { crunchMoment, crunchStart } from '../simulation/coachMoments';
import type { PossessionLogEntry } from '../simulation/boxscore';

const trip = (quarter: number, clockSeconds: number, offenseTeamId: string, homeScoreAfter: number, awayScoreAfter: number): PossessionLogEntry =>
  ({ quarter, clockSeconds, offenseTeamId, ballHandlerId: 'p', action: '', events: [], result: 'MISS', onCourtHome: [], onCourtAway: [], homeScoreAfter, awayScoreAfter });

describe('crunch time: play it yourself', () => {
  const log = [trip(3, 300, 'H', 80, 78), trip(4, 400, 'A', 90, 88), trip(4, 110, 'H', 92, 88), trip(4, 90, 'A', 92, 90), trip(4, 60, 'H', 92, 90)];
  it('starts in the last two minutes of the fourth quarter when the game is close', () => {
    expect(crunchStart(log, 4)).toBe(2);
    expect(crunchMoment(log, 2, 'H', 4)).toBe(true);
    expect(crunchMoment(log, 3, 'H', 4)).toBe(false); // their ball
    expect(crunchMoment(log, 1, 'A', 4)).toBe(false); // too early
  });
  it('is not crunch time in a blowout', () => {
    const blowout = [trip(3, 10, 'A', 108, 80), trip(4, 100, 'H', 110, 80), trip(4, 80, 'A', 110, 80)];
    expect(crunchStart(blowout, 4)).toBe(-1);
    expect(crunchMoment(blowout, 1, 'H', 4)).toBe(false);
  });
});
