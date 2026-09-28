// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayoffsPage } from '../components/PlayoffsPage';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { generateConferencePlayoffBracket } from '../simulation/playoffs';

describe('your playoff series', () => {
  it('shows your series and plays to your next game live', () => {
    const { league: g } = generateFullLeague(55, 30, 13, 20, '2026');
    const league = simulateRemainingSeason({ ...g, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 2);
    const bracket = generateConferencePlayoffBracket(league);
    const me = bracket.rounds[0][2].teamAId!;
    const onBracket = vi.fn();
    const { rerender } = render(<PlayoffsPage league={league} onChange={() => {}} bracket={bracket} onBracketChange={onBracket} controlledTeamId={me} />);
    expect(screen.getByLabelText('Your series')).toBeTruthy();
    fireEvent.click(screen.getByText('▶ Watch your next game live'));
    expect(onBracket).toHaveBeenCalled();
    const next = onBracket.mock.calls.at(-1)![0];
    const mine = next.rounds[0].find((s: { teamAId: string }) => s.teamAId === me);
    expect(mine.games.length).toBe(1);
    rerender(<PlayoffsPage league={league} onChange={() => {}} bracket={next} onBracketChange={onBracket} controlledTeamId={me} />);
    expect(screen.getByText('Back to Playoffs')).toBeTruthy();
    expect(screen.getAllByText(/GAME 1/).length).toBeGreaterThan(0);
  });
});
