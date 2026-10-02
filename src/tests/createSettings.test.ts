import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { applyCreateSettings, changedCount, summary, DEFAULT_CREATE } from '../menu/createSettings';
import { SETTINGS_PRESETS } from '../simulation/settingsPresets';

const fresh = () => generateFullLeague(7, 30, 18, 82, '2026', { balanced: true });
const gamesOf = (schedule: { homeTeamId?: string; awayTeamId?: string; home?: string; away?: string }[], teamId: string) =>
  schedule.filter(g => Object.values(g).includes(teamId)).length;

describe('New Franchise league settings', () => {
  it('leave the league exactly as built when nothing was changed', () => {
    const { league, extras } = fresh();
    const out = applyCreateSettings(league, extras, DEFAULT_CREATE, true);
    expect(out.league).toBe(league);
    expect(out.extras).toBe(extras);
    expect(changedCount(DEFAULT_CREATE)).toBe(0);
  });
  it('apply only what changed: style, injuries, quarters, sandbox', () => {
    const { league, extras } = fresh();
    const s = { ...DEFAULT_CREATE, feel: 'Arcade' as const, injuries: true, injuryRate: 2, quarterMinutes: 10, sandbox: true };
    const { league: l } = applyCreateSettings(league, extras, s, true);
    expect(l.settings.pacePreset).toBe('arcade');
    expect(l.settings.turnoverFrequencyMultiplier).toBe(SETTINGS_PRESETS.Arcade.turnoverFrequencyMultiplier);
    expect(l.settings.injuriesEnabled).toBe(true);
    expect(l.settings.injuryFrequencyMultiplier).toBe(2);
    expect(l.settings.era.quarterLengthMinutes).toBe(10);
    expect(l.settings.era.shotClockSeconds).toBe(league.settings.era.shotClockSeconds);
    expect(l.settings.sandboxMode).toBe(true);
    expect(l.settings.fatigueEnabled).toBe(league.settings.fatigueEnabled);
    expect(changedCount(s)).toBe(5);
  });
  it('rebuild the schedule for a shorter season', () => {
    const { league, extras } = fresh();
    const { league: l } = applyCreateSettings(league, extras, { ...DEFAULT_CREATE, games: 41 }, true);
    expect(l.settings.gamesPerSeason).toBe(41);
    const team = l.teams[0].teamId;
    expect(gamesOf(l.schedule as never, team)).toBe(41);
    expect(l.schedule.length).toBe((41 * 30) / 2 | 0);
  });
  it('change the salary cap only in random leagues, with the tax line in step', () => {
    const { league, extras } = fresh();
    const s = { ...DEFAULT_CREATE, salaryCap: 180_000_000, hardCap: true };
    const random = applyCreateSettings(league, extras, s, true).extras.capSettings;
    expect(random.salaryCap).toBe(180_000_000);
    expect(random.hardCapEnabled).toBe(true);
    expect(random.luxuryTaxLine / random.salaryCap).toBeCloseTo(extras.capSettings.luxuryTaxLine / extras.capSettings.salaryCap, 3);
    expect(applyCreateSettings(league, extras, s, false).extras.capSettings).toEqual(extras.capSettings);
    expect(summary(s, true)).toContain('Hard cap');
  });
});
