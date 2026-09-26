// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { Sidebar } from '../components/Sidebar';
import { CoachingPage } from '../components/CoachingPage';
import { FreeAgencyPage } from '../components/FreeAgencyPage';
import { TradePage } from '../components/TradePage';
import { TeamProfilePage } from '../components/TeamProfilePage';
import { TeamLinksProvider, TeamLink } from '../components/TeamLink';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { parseRoute, routeHash, analyticsPath } from '../navigation/routes';

afterEach(cleanup);
const fixture = () => generateFullLeague(453, 4, 12, 6, '2026', { priorSeasons: false });
describe('Sandbox access and franchise viewing', () => {
  it('locks every editing destination but keeps Auto Play and the Sandbox switch page accessible', () => {
    const props = { tab: 'sandbox', onNavigate: vi.fn(), onNavigateLeagueSettings: vi.fn(), collapsed: false, hasControlledTeam: true, seasonPhase: 'regular_season' as const };
    const view = render(<Sidebar {...props} sandboxMode={false} />);
    for (const name of ['God Mode', 'Import/Export', 'Fast Edit', 'Code Mode', 'Simulation Lab']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Auto Play' }));
    expect(props.onNavigate).toHaveBeenCalledWith('autoPlay');
    fireEvent.click(screen.getByRole('button', { name: 'Sandbox Mode' }));
    expect(props.onNavigate).toHaveBeenCalledWith('sandbox');
    view.rerender(<Sidebar {...props} sandboxMode />);
    fireEvent.click(screen.getByRole('button', { name: 'God Mode' }));
    expect(props.onNavigate).toHaveBeenCalledWith('bulk');
  });
  it('limits coaching to your team, then immediately restores that scope after leaving Sandbox', () => {
    const { league } = fixture(); const change = vi.fn();
    const props = { league, controlledTeamId: league.teams[1].teamId, onChange: change, onOpenRoster: vi.fn() };
    const view = render(<CoachingPage {...props} />);
    expect(screen.queryByLabelText('Coaching team')).toBeNull();
    fireEvent.change(screen.getByLabelText('System', { exact: true }), { target: { value: 'motion' } });
    expect(change.mock.lastCall![0].teams[1].coach.offensiveSystem).toBe('motion');
    expect(change.mock.lastCall![0].teams[0]).toEqual(league.teams[0]);
    view.rerender(<CoachingPage {...props} sandboxMode />);
    fireEvent.change(screen.getByLabelText('Coaching team'), { target: { value: league.teams[2].teamId } });
    view.rerender(<CoachingPage {...props} sandboxMode={false} />);
    fireEvent.change(screen.getByLabelText('System', { exact: true }), { target: { value: 'post' } });
    expect(change.mock.lastCall![0].teams[1].coach.offensiveSystem).toBe('post');
    expect(change.mock.lastCall![0].teams[2]).toEqual(league.teams[2]);
  });
  it('removes other-team free-agent signing selectors in normal mode', () => {
    const { league, extras } = fixture();
    const view = render(<FreeAgencyPage league={league} extras={extras} controlledTeamId={league.teams[1].teamId} onChange={vi.fn()} onSelectPlayer={vi.fn()} />);
    expect(screen.queryByLabelText('Signing team')).toBeNull();
    expect(screen.getByText(/Signing for:/).textContent).toContain(league.teams[1].name);
    view.rerender(<FreeAgencyPage sandboxMode league={league} extras={extras} controlledTeamId={null} onChange={vi.fn()} onSelectPlayer={vi.fn()} />);
    expect((screen.getByLabelText('Signing team') as HTMLSelectElement).options.length).toBe(league.teams.length);
  });
  it('renders a team profile without editing controls and still opens player profiles', () => {
    const { league, extras } = fixture(); const select = vi.fn();
    const { container } = render(<TeamProfilePage league={league} extras={extras} teamId={league.teams[0].teamId} onSelectPlayer={select} />);
    for (const name of ['Coaching', 'Roster', 'Finances']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(container.querySelector('input,select,textarea')).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit|Sign|Release|Hire/ })).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(select).toHaveBeenCalledWith(league.teams[0].seasons[0].playerId);
  });
  it('encodes team destinations and prevents parent rows opening a different profile', () => {
    const { league } = fixture(); const parent = vi.fn(); const team = { ...league.teams[0], teamId: 'ID / ? & ü' };
    render(<TeamLinksProvider teams={[team]} saveId="save/a"><div onClick={parent}><TeamLink teamId={team.teamId} /></div></TeamLinksProvider>);
    const link = screen.getByRole('link', { name: team.name });
    const hash = link.getAttribute('href')!;
    expect(parseRoute(hash)).toEqual({ saveId: 'save/a', tab: 'teamProfile', team: team.teamId });
    expect(analyticsPath(hash)).toBe('/game/teamProfile');
    expect(routeHash(parseRoute(hash)!)).toBe(hash);
    fireEvent.click(link); expect(parent).not.toHaveBeenCalled();
  });
  it('does not crash or expose trades when no team is controlled', () => {
    const { league, extras } = fixture();
    render(<TradePage league={league} extras={extras} controlledTeamId="__spectator__" onChange={vi.fn()} />);
    expect(screen.getByText(/Control a team to propose trades/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Propose Trade' })).toBeNull();
  });
  it('keeps a failed confirmation open and allows retry or cancel', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    const confirm = vi.fn().mockRejectedValue(new Error('Save failed')); const cancel = vi.fn();
    render(<ConfirmationDialog title="Return to Main Menu?" confirmLabel="Save & Exit" onConfirm={confirm} onCancel={cancel}>Your league will be saved.</ConfirmationDialog>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Exit' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not finish'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
  });
});
