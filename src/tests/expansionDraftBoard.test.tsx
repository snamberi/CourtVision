// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpansionDraftBoard } from '../components/ExpansionDraftBoard';
import { generateFullLeague } from '../simulation/leagueGenerator';

describe('expansion draft board', () => {
  it('shows protection lists first, then lets you draft and start', () => {
    const { league, extras } = generateFullLeague(7, 8, 16, 10, '2026', { priorSeasons: false });
    const done = vi.fn();
    render(<ExpansionDraftBoard league={league} extras={extras} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: /Collect the protection lists/ }));
    expect(screen.getByRole('heading', { name: 'Protection lists' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open the draft/ }));
    const start = screen.getByRole('button', { name: /Pick 14 more/ }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Draft' })[0]);
    expect(screen.getByText(/1 of 14 picked/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Auto-pick the rest' }));
    fireEvent.click(screen.getByRole('button', { name: /Start with this team/ }));
    expect(done).toHaveBeenCalledTimes(1);
    const [nextLeague, , teamId] = done.mock.calls[0];
    expect(nextLeague.teams.find((t: { teamId: string }) => t.teamId === teamId).seasons).toHaveLength(14);
  });
});
