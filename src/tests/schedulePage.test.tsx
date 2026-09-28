// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
afterEach(cleanup);
import { SchedulePage } from '../components/SchedulePage';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';

const { league: base } = generateFullLeague(21, 6, 13, 10, '2026', { priorSeasons: false });
const league = simulateRounds(base, 3, 5);
const mine = league.teams[0].teamId;

describe('schedule page', () => {
  it('shows your team calendar with a record, the next game and results you can open', () => {
    const open = vi.fn();
    render(<SchedulePage league={league} controlledTeamId={mine} onViewGame={open} />);
    expect(screen.getByText(/NEXT GAME/)).toBeTruthy();
    const played = screen.getAllByRole('button', { name: /(won|lost) \d+-\d+/ });
    expect(played.length).toBeGreaterThan(0);
    fireEvent.click(played[0]);
    expect(open).toHaveBeenCalled();
  });

  it('lists every game of a day in the league view', () => {
    render(<SchedulePage league={league} controlledTeamId={mine} onViewGame={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'League by day' }));
    const day = screen.getByRole('combobox', { name: 'Game day' }) as HTMLSelectElement;
    const round = Number(day.value);
    expect(document.querySelectorAll('.sched-matchup').length).toBe(league.schedule.filter(g => g.round === round).length);
    expect(within(document.querySelector('.sched-day-nav') as HTMLElement).getByText('Today')).toBeTruthy();
  });
});
