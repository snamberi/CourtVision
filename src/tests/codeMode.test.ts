import { describe, it, expect } from 'vitest';
import { runPlayerScript } from '../simulation/codeApi';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';

describe('Code Mode script execution', () => {
  it('mutates the same PlayerSeason shape the visual editor reads/writes', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    const result = runPlayerScript(season, `player.attributes.offense.threePoint = 110;`);
    expect(result.error).toBeNull();
    expect(result.season.attributes.offense.threePoint).toBe(110);
    // original untouched
    expect(season.attributes.offense.threePoint).not.toBe(110);
  });

  it('supports pushing badge ids and editing nested tendency objects', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    const code = `
      player.badges.push('never_turnover');
      player.tendencies.ballDominance = 90;
      player.minutes = { mode: 'EXACT', target: 36, perQuarter: [9,9,9,9] };
    `;
    const result = runPlayerScript(season, code);
    expect(result.error).toBeNull();
    expect(result.season.badges).toContain('never_turnover');
    expect(result.season.tendencies.ballDominance).toBe(90);
    expect(result.season.minutes.mode).toBe('EXACT');
    expect(result.season.minutes.perQuarter).toEqual([9, 9, 9, 9]);
  });

  it('captures console.log output from the script', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    const result = runPlayerScript(season, `console.log('hello', 42);`);
    expect(result.logs).toEqual(['hello 42']);
  });

  it('a runtime error is caught and the original season is returned unchanged', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    const result = runPlayerScript(season, `player.attributes.offense.nonexistentGroup.foo = 1;`);
    expect(result.error).not.toBeNull();
    expect(result.season).toBe(season); // unchanged reference on error
  });

  it('a syntax error is caught rather than throwing out of the function', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    const result = runPlayerScript(season, `this is not valid javascript {{{`);
    expect(result.error).not.toBeNull();
  });

  it('conditional logic based on current attributes works as in the documented example', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    season.attributes.offense.ballHandling = 95;
    const code = `
      if (player.attributes.offense.ballHandling > 90) {
        player.attributes.offense.speedWithBall += 10;
      }
    `;
    const before = season.attributes.offense.speedWithBall;
    const result = runPlayerScript(season, code);
    expect(result.season.attributes.offense.speedWithBall).toBe(before + 10);
  });
});
