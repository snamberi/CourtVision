// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ContinueFranchise } from '../components/ContinueFranchise';
import { matchesRunName } from '../components/presentation/cardFinish';
import { modeRecords } from '../menu/modePresentation';
import { localProgress } from '../menu/inProgress';
import type { SaveSummary } from '../storage/saves';

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const saves: SaveSummary[] = [
  { id: 'older', name: 'Bulls rebuild', createdAt: 1, updatedAt: 10, season: '1998-99', teamCount: 30, controlledTeamName: 'Chicago' },
  { id: 'newer', name: 'Curry dynasty', createdAt: 2, updatedAt: 20, season: '2016-17', teamCount: 30, controlledTeamName: 'Golden State' },
];
const props = () => ({ saves, onContinue: vi.fn(), onDeleteSave: vi.fn(), onRenameSave: vi.fn(), onBack: vi.fn(), onCreate: vi.fn() });

describe('Franchise Continue', () => {
  it('lists recent saves first and continues the chosen id, including after filtering', async () => {
    const p = props(); render(<ContinueFranchise {...p} />);
    expect(screen.getAllByRole('article')[0].textContent).toContain('Curry dynasty');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Chicago' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(p.onContinue).toHaveBeenCalledWith('older'));
  });
  it('does not rename on blur or Escape; commits a trimmed name on submit', async () => {
    const p = props(); render(<ContinueFranchise {...p} />);
    const card = within(screen.getAllByRole('article')[0]);
    fireEvent.click(card.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'League name' });
    fireEvent.change(input, { target: { value: '  Warriors  ' } });
    fireEvent.blur(input);
    expect(p.onRenameSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(p.onRenameSave).toHaveBeenCalledWith('newer', 'Warriors'));
  });
  it('only deletes after confirmation, and Cancel preserves the save', async () => {
    const p = props(); render(<ContinueFranchise {...p} />);
    fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Delete' }));
    expect(p.onDeleteSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onDeleteSave).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(p.onDeleteSave).toHaveBeenCalledWith('newer'));
  });
  it('handles empty saves and failed mutations', async () => {
    const p = props(); const view = render(<ContinueFranchise {...p} saves={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play · new franchise' })); expect(p.onCreate).toHaveBeenCalledOnce();
    view.rerender(<ContinueFranchise {...p} onDeleteSave={() => Promise.reject(new Error('storage blocked'))} />);
    fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be saved'));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});

describe('mode records and active-run progress', () => {
  it('uses completed records even when no active run exists', () => {
    localStorage.setItem('cv-perfect-records', JSON.stringify({ runs: 790, bestWins: 82, perfect98: 1 }));
    localStorage.setItem('cv-hunt-records', JSON.stringify({ runs: 5, bestStop: 8, wins: 0 }));
    localStorage.setItem('cv-survival-records', JSON.stringify({ runs: 3, best: { rookie: { wins: 12 }, pro: { wins: 7 } } }));
    expect(modeRecords()).toMatchObject({ perfect: '98–0 achieved · 1 perfect run', legends: 'Best: series 9 / 10', survival: 'Best: 12 wins survived' });
    expect(localProgress().perfect).toBeUndefined();
  });
  it('never treats a completed run as active or invents a record for a new player', () => {
    localStorage.setItem('cv-perfect-run', JSON.stringify({ v: 1, stage: 'done', games: [{ won: true }] }));
    localStorage.setItem('cv-hunt-records', 'broken-json');
    expect(localProgress().perfect).toBeUndefined(); expect(modeRecords()).toEqual({});
    localStorage.setItem('cv-survival-run', JSON.stringify({ v: 1, stage: 'pregame', games: [1, 2, 3] }));
    expect(localProgress().survival).toBe('Round 4');
  });
});

describe('season-specific MVP identity', () => {
  it('keeps two versions of a player distinct when matching box-score names', () => {
    expect(matchesRunName({ name: 'Stephen Curry', end: 2017 }, "Stephen Curry '17")).toBe(true);
    expect(matchesRunName({ name: 'Stephen Curry', end: 2022 }, "Stephen Curry '17")).toBe(false);
    expect(matchesRunName(undefined, "Stephen Curry '17")).toBe(false);
  });
});
