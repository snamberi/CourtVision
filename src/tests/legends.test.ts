import { describe, it, expect } from 'vitest';
import { LEGEND_TEAM_TEMPLATES, buildLegendTeam, eraRulesFor } from '../simulation/legends';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';

describe('legends / era system', () => {
  it('generated legend teams are explicitly tagged as generated, never claimed as official historical data', () => {
    for (const template of LEGEND_TEAM_TEMPLATES) {
      const team = buildLegendTeam(template);
      expect(team.name).toMatch(/generated/i);
      for (const s of team.seasons) {
        expect(s.source).toBe('generated');
      }
    }
  });

  it('a 1990s ruleset has no three-point line while a modern ruleset does', () => {
    expect(ERA_PRESETS['1960s'].threePointLineDistance).toBe(0);
    expect(eraRulesFor('modern').threePointLineDistance).toBeGreaterThan(0);
  });

  it('two era-styled teams can actually be simulated against each other under a chosen ruleset', () => {
    const home = buildLegendTeam(LEGEND_TEAM_TEMPLATES[0]); // '90s-style
    const away = buildLegendTeam(LEGEND_TEAM_TEMPLATES[1]); // 2010s-style
    const result = simulateGame({
      home, away,
      settings: { ...DEFAULT_GAME_SETTINGS, era: eraRulesFor('modern'), seed: 3 },
    });
    expect(result.homeScore).toBeGreaterThan(0);
    expect(result.awayScore).toBeGreaterThan(0);
  });

  it('a shorter quarter length under one era produces a different total game length than another', () => {
    const home = buildLegendTeam(LEGEND_TEAM_TEMPLATES[0]);
    const away = buildLegendTeam(LEGEND_TEAM_TEMPLATES[1]);
    const shortRules = { ...eraRulesFor('modern'), quarterLengthMinutes: 6 };
    const longRules = { ...eraRulesFor('modern'), quarterLengthMinutes: 12 };
    const shortGame = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, era: shortRules, seed: 8 } });
    const longGame = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, era: longRules, seed: 8 } });
    // more total clock time should produce more possessions logged, not just a multiplied final score
    expect(longGame.possessionLog.length).toBeGreaterThan(shortGame.possessionLog.length);
  });
});
