import { describe, it, expect } from 'vitest';
import type { SeasonAwards, AwardWinner } from '../simulation/awards';
import type { AwardVote } from '../simulation/awardVoting';
import { isUnanimous, voteRows } from '../simulation/almanac';

const line = (id: string, firstVotes: number, points: number) =>
  ({ id, teamId: 't', teamName: 'T', points, firstVotes, places: [firstVotes], share: points / 1000, score: 1 });
const vote = (lines: ReturnType<typeof line>[], winners = [lines[0].id]): AwardVote => ({ voters: 100, pointsByPlace: [10, 7, 5, 3, 1], lines, winners });
const withVote = (v: AwardVote) => ({ votes: { mvp: v }, ballots: {} }) as unknown as SeasonAwards;
const winner = (playerId: string, extra: Partial<AwardWinner> = {}) => ({ playerId, teamId: 't', teamName: 'T', score: 10, ...extra }) as AwardWinner;

describe('unanimous awards', () => {
  it('flags a saved vote where the winner took every first-place vote', () => {
    const awards = withVote(vote([line('A', 100, 1000), line('B', 0, 600)]));
    expect(voteRows(awards, 'mvp', '2026')[0].unanimous).toBe(true);
    expect(isUnanimous(awards, 'mvp', '2026', 'A')).toBe(true);
    expect(isUnanimous(awards, 'mvp', '2026', 'B')).toBe(false);
  });
  it('does not flag a split vote or co-winners', () => {
    expect(isUnanimous(withVote(vote([line('A', 99, 997), line('B', 1, 700)])), 'mvp', '2026')).toBe(false);
    expect(isUnanimous(withVote(vote([line('A', 100, 1000), line('B', 0, 1000)], ['A', 'B'])), 'mvp', '2026')).toBe(false);
  });
  it('uses the recorded share for real NBA seasons', () => {
    const real = (share: number) => ({ ballots: { mvp: [winner('Curry', { voteShare: share, firstVotes: 131 }), winner('Kawhi', { voteShare: .48, firstVotes: 0 })] } }) as unknown as SeasonAwards;
    expect(isUnanimous(real(1), 'mvp', '2016')).toBe(true);
    expect(isUnanimous(real(.986), 'mvp', '2016')).toBe(false);
  });
});
