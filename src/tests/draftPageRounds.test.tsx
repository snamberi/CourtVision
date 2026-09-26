// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DraftPage } from '../components/DraftPage';
import { DEFAULT_CAP_SETTINGS, DEFAULT_GM_FLAGS, DEFAULT_TRADE_SETTINGS, generateDraftClass } from '../simulation/gm';
import type { League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';

/**
 * Regression test for the draft-round display bug: with a 30-team two-round order (60 total picks),
 * every pick used to be labelled "round 1" (dividing by the full 60-pick order instead of the 30-pick
 * round size) — see DraftPage.tsx's pickLabel. Round 1 should be picks 1-30, round 2 picks 1-30 again.
 */
describe('DraftPage pick round labels', () => {
  it('shows 30 picks per round, not 60', () => {
    const teamIds = Array.from({ length: 30 }, (_, i) => `T${i}`);
    const teams = teamIds.map((id) => ({ ...buildDemoTeam(id, id) }));
    const league: League = {
      teams: teams.map((t) => ({ teamId: t.teamId, name: t.label, seasons: t.seasons })),
      schedule: [],
      settings: { ...DEFAULT_GAME_SETTINGS },
    };
    // Two rounds concatenated (same shape buildTwoRoundDraftOrder produces): 30 teams, twice.
    const draftOrder = [...teamIds, ...teamIds];
    const extras = {
      contracts: {}, freeAgents: [], draftClass: generateDraftClass(5, 1, '2026-27'),
      capSettings: { ...DEFAULT_CAP_SETTINGS },
      tradeSettings: { ...DEFAULT_TRADE_SETTINGS },
      ...DEFAULT_GM_FLAGS,
      draftDayOpen: true,
      draftOrder,
      draftPickIndex: 29, // the 30th and last pick of round 1
      draftPicksMade: [],
    };

    render(
      <DraftPage league={league} extras={extras} controlledTeamId={null} onChange={() => {}} onSelectPlayer={() => {}} />,
    );

    // Current pick (index 29, the last of round 1) must read "1-30", not "1-60".
    expect(screen.getByText(/On the clock · R1 · #30/)).toBeTruthy();
    // Next pick (index 30, the first of round 2) must read "2-1".
    expect(screen.getByText(/Up next · R2 · #1/)).toBeTruthy();

    // The results table should show pick 2-1 as a distinct row from 1-30, i.e. round resets at 31 team picks.
    const table = screen.getByText('Draft results · two rounds').closest('div')!;
    expect(within(table).getByText('R2 · #1')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(61);
    expect(within(table).queryByText(/R3/)).toBeNull();
  });
});
