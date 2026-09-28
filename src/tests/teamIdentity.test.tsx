// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { TeamIdentityPanel } from '../components/TeamIdentityPanel';
import { TeamIdentityProvider } from '../visuals/TeamIdentityContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { buildSnapshot, parseUniverseFile } from '../storage/universeIO';
afterEach(cleanup);
const fixture = () => generateFullLeague(17, 4, 10, 6, '2026', { priorSeasons: false });
describe('team identity', () => {
  it('gives old saves stable branding and rejects invalid imported colors', () => {
    const { league } = fixture(), team = league.teams[0];
    const original = resolveTeamIdentity(team);
    expect(resolveTeamIdentity(structuredClone(team))).toEqual(original);
    expect(resolveTeamIdentity({ ...team, identity: { ...original, primary: 'url(evil)' } }).primary).toBe(original.primary);
  });
  it('updates the shared player jersey, saves a logo design, and round trips new branding', () => {
    const { league, extras } = fixture();
    let latest = league;
    function Harness() {
      const [state, setState] = useState(league); latest = state;
      return <TeamIdentityProvider teams={state.teams}><TeamIdentityPanel team={state.teams[0]} onChange={identity => setState({ ...state, teams: state.teams.map((t, i) => i === 0 ? { ...t, identity } : t) })} />
        <div data-testid="roster-avatar"><PlayerAvatar playerId="Test" teamId={state.teams[0].teamId} /></div></TeamIdentityProvider>;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Team Identity' }));
    fireEvent.change(screen.getByLabelText('Jersey primary'), { target: { value: '#123456' } });
    fireEvent.change(screen.getByLabelText('Team abbreviation'), { target: { value: 'CUR' } });
    fireEvent.change(screen.getByLabelText('Logo'), { target: { value: 'crown' } });
    fireEvent.change(screen.getByLabelText('Jersey design'), { target: { value: 'stripe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Team Identity' }));
    expect(latest.teams[0].identity?.abbreviation).toBe('CUR');
    expect(screen.getByTestId('roster-avatar').querySelector('[fill="#123456"]')).not.toBeNull();
    expect(parseUniverseFile(JSON.stringify(buildSnapshot(latest, extras))).league.teams[0].identity).toEqual(latest.teams[0].identity);
  });
  it('shows only earned banners and exposes editing only when authorized', () => {
    const { league } = fixture(), team = { ...league.teams[0], retiredJerseys: [{ playerId: 'Legend', number: 30, season: '2025' }] };
    render(<TeamIdentityPanel team={team} currentChampion={team.teamId} currentSeason="2026" />);
    expect(screen.getByRole('img', { name: 'Champions 2027' })).toBeTruthy(); expect(screen.getByRole('img', { name: 'Retired number 30, Legend' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Team Identity' })).toBeNull();
  });
});
