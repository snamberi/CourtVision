import type { GameSettings } from '../simulation/types';
import type { League } from '../simulation/league';
import { ERA_PRESETS } from '../simulation/types';
import { SETTINGS_PRESETS } from '../simulation/settingsPresets';
import { generateSeasonSchedule } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

/*
 * League settings picked on the New Franchise page, before the league exists. They are applied once to the freshly
 * built league (random or real); everything stays editable later in the league's own Settings.
 */

/** 'Standard' leaves the game engine's own defaults; the others are the Settings page presets. */
export type GameFeel = 'Standard' | 'Realistic' | 'Balanced' | 'Arcade' | 'Chaos' | 'Simulation';
/** 'season' keeps a real league's own rules for its starting year. */
export type EraChoice = 'season' | keyof typeof ERA_PRESETS;

export interface CreateSettings {
  feel: GameFeel;
  era: EraChoice;
  quarterMinutes: number;
  games: number;
  injuries: boolean;
  /** 0.5 = half as many, 2 = twice as many. */
  injuryRate: number;
  fatigue: boolean;
  chemistry: boolean;
  /** Home-court edge, 0-0.1. */
  homeCourt: number;
  /** Share of the schedule played at the trade deadline. */
  tradeDeadline: number;
  sandbox: boolean;
  /** Random leagues: the salary cap (the tax line moves with it) and a hard cap. */
  salaryCap: number;
  hardCap: boolean;
}

export const FEELS: { id: GameFeel; blurb: string }[] = [
  { id: 'Standard', blurb: "Court Vision's default game: what most leagues play." },
  { id: 'Realistic', blurb: 'NBA-like scoring, pace and shooting.' },
  { id: 'Simulation', blurb: 'The most predictable results: the better team wins more.' },
  { id: 'Balanced', blurb: 'A little more swing in every game.' },
  { id: 'Arcade', blurb: 'Fast, high-scoring, fewer turnovers.' },
  { id: 'Chaos', blurb: 'Anything can happen: hot streaks, fouls and upsets.' },
];
export const ERA_CHOICES: { id: EraChoice; label: string }[] = [
  { id: 'season', label: "The season's real rules" },
  { id: 'modern', label: 'Modern' }, { id: '2010s', label: '2010s' }, { id: '2000s', label: '2000s' }, { id: '1990s', label: '1990s' },
  { id: '1980s', label: '1980s' }, { id: '1970s', label: '1970s (no 3-point line)' }, { id: '1960s', label: '1960s (no 3-point line)' },
];
export const GAME_COUNTS = [82, 72, 66, 58, 41, 29];
export const QUARTER_LENGTHS = [12, 10, 8, 6];

export const DEFAULT_CREATE: CreateSettings = {
  feel: 'Standard', era: 'season', quarterMinutes: 12, games: 82, injuries: false, injuryRate: 1, fatigue: true, chemistry: true,
  homeCourt: 0.03, tradeDeadline: 0.65, sandbox: false, salaryCap: 140_000_000, hardCap: false,
};

/** How many settings differ from the defaults (shown on the button). */
export const changedCount = (s: CreateSettings) => (Object.keys(DEFAULT_CREATE) as (keyof CreateSettings)[]).filter(k => s[k] !== DEFAULT_CREATE[k]).length;

/** A one-line summary of the settings, for the creation page. */
export function summary(s: CreateSettings, random: boolean): string[] {
  const out = [s.feel === 'Standard' ? 'Standard game' : `${s.feel} games`, `${s.games} games a season`];
  if (s.quarterMinutes !== 12) out.push(`${s.quarterMinutes}-minute quarters`);
  if (s.era !== 'season') out.push(`${ERA_CHOICES.find(e => e.id === s.era)?.label} rules`);
  out.push(s.injuries ? (s.injuryRate === 1 ? 'Injuries on' : `Injuries ×${s.injuryRate}`) : 'No injuries');
  if (!s.fatigue) out.push('No fatigue');
  if (!s.chemistry) out.push('No chemistry');
  if (s.sandbox) out.push('Sandbox');
  if (random && s.salaryCap !== DEFAULT_CREATE.salaryCap) out.push(`$${Math.round(s.salaryCap / 1e6)}M cap`);
  if (random && s.hardCap) out.push('Hard cap');
  return out;
}

/** The new league with the chosen settings applied (schedule rebuilt for a different season length). Only the
 *  settings that were changed from the defaults are touched, so an untouched page builds exactly the usual league. */
export function applyCreateSettings(league: League, extras: GMLeagueExtras, s: CreateSettings, random: boolean): { league: League; extras: GMLeagueExtras } {
  if (!changedCount(s)) return { league, extras };
  const d = DEFAULT_CREATE, settings: GameSettings = { ...league.settings };
  if (s.feel !== 'Standard') {
    const preset = SETTINGS_PRESETS[s.feel];
    Object.assign(settings, { pacePreset: preset.pacePreset, shootingVariance: preset.shootingVariance, foulFrequency: preset.foulFrequency, turnoverFrequencyMultiplier: preset.turnoverFrequencyMultiplier });
  }
  if (s.era !== d.era || s.quarterMinutes !== d.quarterMinutes) settings.era = { ...(s.era === 'season' ? league.settings.era : ERA_PRESETS[s.era]), quarterLengthMinutes: s.quarterMinutes };
  if (s.injuries !== d.injuries || s.injuryRate !== d.injuryRate) { settings.injuriesEnabled = s.injuries; settings.injuryFrequencyMultiplier = s.injuryRate; }
  if (s.fatigue !== d.fatigue) settings.fatigueEnabled = s.fatigue;
  if (s.chemistry !== d.chemistry) settings.teamChemistryEnabled = s.chemistry;
  if (s.homeCourt !== d.homeCourt) settings.homeCourtAdvantage = s.homeCourt;
  if (s.tradeDeadline !== d.tradeDeadline) settings.tradeDeadlinePct = s.tradeDeadline;
  if (s.sandbox !== d.sandbox) settings.sandboxMode = s.sandbox;
  if (s.games !== d.games) settings.gamesPerSeason = s.games;
  const scheduled = league.teams.length ? Math.round((league.schedule.length * 2) / league.teams.length) : s.games;
  const schedule = scheduled !== s.games && league.teams.length > 1 ? generateSeasonSchedule(league.teams.map(t => t.teamId), s.games) : league.schedule;
  const capSettings = random && (s.salaryCap !== d.salaryCap || s.hardCap !== d.hardCap)
    ? { ...extras.capSettings, salaryCap: s.salaryCap, luxuryTaxLine: Math.round(s.salaryCap * (extras.capSettings.luxuryTaxLine / extras.capSettings.salaryCap)), hardCapEnabled: s.hardCap }
    : extras.capSettings;
  return { league: { ...league, settings, schedule }, extras: { ...extras, capSettings } };
}
