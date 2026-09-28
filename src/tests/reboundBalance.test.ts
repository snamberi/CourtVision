import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { perGameAverages } from '../simulation/careerStats';

describe('rebound balance', () => {
  it('team rebounding is NBA-like and no one hauls in 16+ a night; about one miss in eleven goes out of bounds', () => {
    const { league: g } = generateFullLeague(22, 30, 13, 40, '2026');
    const l = simulateRemainingSeason({ ...g, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 22);
    let games = 0, reb = 0, oreb = 0, misses = 0, outs = 0;
    for (const s of l.schedule) {
      const r = s.result; if (!r) continue;
      for (const box of [r.homeBox, r.awayBox]) { games++; for (const p of Object.values(box.players)) { reb += p.oreb + p.dreb; oreb += p.oreb; misses += p.fga - p.fgm; } }
      outs += r.possessionLog.filter(e => e.events.some(ev => ev.startsWith('Out of bounds'))).length;
    }
    expect(reb / games).toBeGreaterThan(39.5);
    expect(reb / games).toBeLessThan(46);
    expect(oreb / games).toBeGreaterThan(8.5);
    expect(oreb / games).toBeLessThan(12.5);
    expect(outs / misses).toBeGreaterThan(0.05);
    expect(outs / misses).toBeLessThan(0.14);
    const leaders = l.teams.flatMap(t => t.seasons).map(p => perGameAverages(p.seasonStats)).filter(a => a.gamesPlayed >= 25).map(a => a.rpg).sort((a, b) => b - a);
    expect(leaders[0]).toBeLessThan(16);
    expect(leaders[0]).toBeGreaterThan(10);
  }, 120000);
});
