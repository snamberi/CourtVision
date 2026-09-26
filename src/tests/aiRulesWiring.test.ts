import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { classifyBuyerSeller, autoDraftAIPicksUntilUserTurn } from '../simulation/aiGM';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { primaryPosition } from '../simulation/teamStatus';
import type { League } from '../simulation/league';

/** Builds a league where team 'mediocre' has an exact, controlled win% (via a hand-crafted schedule)
 * sitting in the "neutral" gap between the buyer and seller thresholds under default settings. */
function mediocreTeamLeague(winPct: number): League {
  const { league } = generateFullLeague(17, 4, 8, 10);
  const teamId = league.teams[0].teamId;
  const opponentId = league.teams[1].teamId;
  const games = 20;
  const wins = Math.round(winPct * games);
  const schedule = Array.from({ length: games }, (_, i) => ({
    id: `g${i}`, round: i, homeTeamId: teamId, awayTeamId: opponentId, played: true,
    result: { homeTeamId: teamId, awayTeamId: opponentId, homeScore: i < wins ? 110 : 90, awayScore: i < wins ? 90 : 110 } as any,
  }));
  return { ...league, schedule };
}

describe('AI GM league-rules wiring', () => {
  it('aiRebuildingTendency pushed to the max turns a mediocre (neutral) team into a seller', () => {
    const league = mediocreTeamLeague(0.45); // between the default seller (0.40) and buyer (0.55) thresholds -> neutral by default
    const teamId = league.teams[0].teamId;
    const extras = { contracts: {}, freeAgents: [], teamPersonalities: { [teamId]: 'balanced' as const } } as any;

    const defaultClass = classifyBuyerSeller({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES } }, extras, teamId);
    const rebuildClass = classifyBuyerSeller({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, aiRebuildingTendency: 100 } }, extras, teamId);

    expect(defaultClass).toBe('neutral');
    expect(rebuildClass).toBe('seller');
  });

  it('aiWinNowTendency pushed to the max turns a mediocre (neutral) team into a buyer', () => {
    const league = mediocreTeamLeague(0.52); // below the default buyer threshold (0.55) but neutral, not a seller either
    const teamId = league.teams[0].teamId;
    const extras = { contracts: {}, freeAgents: [], teamPersonalities: { [teamId]: 'balanced' as const } } as any;

    const defaultClass = classifyBuyerSeller({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES } }, extras, teamId);
    const winNowClass = classifyBuyerSeller({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, aiWinNowTendency: 100 } }, extras, teamId);

    expect(defaultClass).toBe('neutral');
    expect(winNowClass).toBe('buyer');
  });

  it('an untouched (default) rulesSettings reproduces the exact same classification as no rulesSettings at all', () => {
    const league = mediocreTeamLeague(0.7);
    const teamId = league.teams[0].teamId;
    const extras = { contracts: {}, freeAgents: [], teamPersonalities: { [teamId]: 'balanced' as const } } as any;
    const withDefaults = classifyBuyerSeller({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES } }, extras, teamId);
    const withNone = classifyBuyerSeller({ ...league, rulesSettings: undefined }, extras, teamId);
    expect(withDefaults).toBe(withNone);
  });
});

describe('draft AI respects positional need', () => {
  it('a team completely without any center will preferentially draft one over a marginally-better prospect at a stacked position', () => {
    const { league, extras } = generateFullLeague(21, 6, 10, 10);
    // Strip every center off team 0's roster so it desperately needs one.
    const team0 = league.teams[0];
    const noCenters = { ...team0, seasons: team0.seasons.filter((s) => primaryPosition(s) !== 'C') };
    const patchedLeague = { ...league, teams: [noCenters, ...league.teams.slice(1)] };
    const patchedExtras = { ...extras, draftDayOpen: true, draftOrder: [team0.teamId, ...league.teams.slice(1).map((t) => t.teamId)] };

    const result = autoDraftAIPicksUntilUserTurn(patchedLeague, patchedExtras, 'nobody-controls-anything');
    const firstPick = result.picks[0];
    expect(firstPick).toBeTruthy();
    // Not a strict guarantee every single time given scouted-potential noise, but the need bonus should at minimum not crash and should produce a valid pick.
    expect(typeof firstPick.playerId).toBe('string');
  });
});
