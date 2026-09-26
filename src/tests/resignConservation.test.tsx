// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { ResignWaivePage } from '../components/ResignWaivePage';
import { waiveToFreeAgency, type GMLeagueExtras } from '../simulation/gm';
import type { League } from '../simulation/league';

afterEach(cleanup);

/** Every player id must live in exactly one place: a roster or the free-agent pool. Contracts only for rostered players. */
function assertConserved(league: League, extras: GMLeagueExtras, ids: string[]) {
  for (const id of ids) {
    const onRosters = league.teams.filter(t => t.seasons.some(s => s.playerId === id)).length;
    const inPool = extras.freeAgents.filter(s => s.playerId === id).length;
    expect(onRosters + inPool, id).toBe(1);
    expect(!!extras.contracts[id], `${id} contract`).toBe(onRosters === 1);
  }
}

describe('re-signing conserves players', () => {
  it('a re-signed player lands on the roster with a contract and leaves free agency', () => {
    const { league: base, extras: baseExtras } = generateFullLeague(501, 4, 12, 6, '2026', { priorSeasons: false });
    const team = base.teams[0];
    const target = team.seasons[team.seasons.length - 1];
    const extrasRoomy = { ...baseExtras, capSettings: { ...baseExtras.capSettings, minRosterSize: 0 } };
    const waived = waiveToFreeAgency({ ...base, seasonPhase: 'resign_waive' }, extrasRoomy, target.playerId, team.teamId);
    const allIds = [...waived.league.teams.flatMap(t => t.seasons.map(s => s.playerId)), ...waived.extras.freeAgents.map(s => s.playerId)];
    assertConserved(waived.league, waived.extras, allIds);

    const onChange = vi.fn();
    render(<ResignWaivePage league={waived.league} extras={waived.extras} controlledTeamId={team.teamId} summary={null} onChange={onChange} onContinue={() => {}} onSelectPlayer={() => {}} />);
    const row = screen.getAllByRole('row').find(r => r.textContent?.includes(target.playerId))!;
    const sign = within(row).getAllByRole('button', { name: 'Sign' })[0] as HTMLButtonElement;
    expect(sign.disabled).toBe(false); // fresh league: no morale history, so he's willing at his asking price
    fireEvent.click(sign);
    expect(onChange).toHaveBeenCalledOnce();
    const [league, extras] = onChange.mock.calls[0] as [League, GMLeagueExtras];
    expect(league.teams[0].seasons.some(s => s.playerId === target.playerId)).toBe(true);
    expect(extras.freeAgents.some(s => s.playerId === target.playerId)).toBe(false);
    assertConserved(league, extras, allIds);
  });
});
