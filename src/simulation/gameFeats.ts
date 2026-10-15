import type { GameResult, PossessionLogEntry } from './boxscore';
import type { PlayerId, SeasonMilestones, SeasonStatTotals } from './types';
import { gameLog } from './logPacking';
import { playbackForEntry } from './gamePlayback';
import { BAND_COUNT, bandOf, isThreeType } from './shotDistance';

/*
 * What one game adds beyond the box score, read from its possession log: shooting by distance, buzzer-beaters and
 * game-winners. Plus the season feats built on them (20-point streaks, 20-20-20 games, the 50-40-90 club).
 */

export interface PlayerGameFeats {
  /** Attempts and makes per distance band: [a0, m0, a1, m1, …]. */
  zones: number[];
  buzzerBeaters: number;
  gameWinners: number;
}
const emptyFeats = (): PlayerGameFeats => ({ zones: Array(BAND_COUNT * 2).fill(0), buzzerBeaters: 0, gameWinners: 0 });

/** A buzzer-beater: a field goal on the last trip of a period that started with 2 seconds or less and ran the clock out. */
const BUZZER_SECONDS = 2;
/** A game-winner: the basket that put the winner ahead for good, in the last 24 seconds of regulation or overtime. */
const WINNER_SECONDS = 24;

const margin = (e: PossessionLogEntry | undefined) => (e ? e.homeScoreAfter - e.awayScoreAfter : 0);

/** One game's feats per player, as a plain object (it travels back from the engine workers with the result). */
export type GameFeatsRecord = Record<PlayerId, PlayerGameFeats>;
export const gameFeatsRecord = (result: GameResult): GameFeatsRecord => Object.fromEntries(gameFeats(result));

export function gameFeats(result: GameResult): Map<PlayerId, PlayerGameFeats> {
  const out = new Map<PlayerId, PlayerGameFeats>();
  const log = gameLog(result);
  if (!log.length) return out;
  const of = (id: PlayerId) => { let f = out.get(id); if (!f) out.set(id, f = emptyFeats()); return f; };
  const regulation = result.regulationPeriods ?? 4;
  const final = Math.sign(margin(log[log.length - 1]));
  let decider = -1;
  for (let i = 0; i < log.length; i++) if (Math.sign(margin(log[i])) === final && Math.sign(margin(log[i - 1])) !== final) decider = i;
  for (let i = 0; i < log.length; i++) {
    const e = log[i], p = playbackForEntry(e), feet = e.debug?.shotFeet;
    if (!p.shooterId) continue;
    const endClock = Math.max(0, e.clockSeconds - (e.durationSeconds ?? 0));
    if (typeof feet === 'number') {
      const f = of(p.shooterId), band = bandOf(feet, isThreeType(p.shotType ?? ''));
      f.zones[band * 2]++;
      if (p.shotMade) f.zones[band * 2 + 1]++;
      const lastOfPeriod = log[i + 1]?.quarter !== e.quarter;
      if (p.shotMade && lastOfPeriod && endClock === 0 && e.clockSeconds <= BUZZER_SECONDS) f.buzzerBeaters++;
    }
    if (i === decider && final !== 0 && e.quarter >= regulation && endClock <= WINNER_SECONDS) of(p.shooterId).gameWinners++;
  }
  return out;
}

export function addZones(a: number[] | undefined, b: number[] | undefined): number[] | undefined {
  if (!b?.length) return a;
  if (!a?.length) return b.slice();
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
}

/** The season's feats after one more game. `streak20` is the run of 20-point games going into it (it carries over seasons). */
export function addGameFeats(m: SeasonMilestones, line: { points: number; oreb: number; dreb: number; ast: number }, streak20: number, feats?: PlayerGameFeats): SeasonMilestones {
  const reb = line.oreb + line.dreb;
  const twenties = [line.points, reb, line.ast].filter(v => v >= 20).length;
  const out: SeasonMilestones = {
    ...m,
    games20: (m.games20 ?? 0) + (line.points >= 20 ? 1 : 0),
    best20Streak: Math.max(m.best20Streak ?? 0, streak20),
    twentyTwenty: (m.twentyTwenty ?? 0) + (twenties >= 2 ? 1 : 0),
    triple20: (m.triple20 ?? 0) + (twenties >= 3 ? 1 : 0),
    fiftyPointGames: (m.fiftyPointGames ?? 0) + (line.points >= 50 ? 1 : 0),
    buzzerBeaters: (m.buzzerBeaters ?? 0) + (feats?.buzzerBeaters ?? 0),
    gameWinners: (m.gameWinners ?? 0) + (feats?.gameWinners ?? 0),
  };
  const shotZones = addZones(m.shotZones, feats?.zones);
  return shotZones ? { ...out, shotZones } : out;
}

/** Two seasons' feats together (career totals); the longest streak is the longer one. */
export function sumFeats(a: SeasonMilestones, b: SeasonMilestones): Partial<SeasonMilestones> {
  const s = (k: 'games20' | 'twentyTwenty' | 'triple20' | 'fiftyPointGames' | 'buzzerBeaters' | 'gameWinners') => (a[k] ?? 0) + (b[k] ?? 0);
  return {
    games20: s('games20'), twentyTwenty: s('twentyTwenty'), triple20: s('triple20'), fiftyPointGames: s('fiftyPointGames'),
    buzzerBeaters: s('buzzerBeaters'), gameWinners: s('gameWinners'), best20Streak: Math.max(a.best20Streak ?? 0, b.best20Streak ?? 0),
    ...(a.shotZones?.length || b.shotZones?.length ? { shotZones: addZones(a.shotZones, b.shotZones) } : {}),
  };
}

/*
 * The 50-40-90 club: 50% from the field, 40% from three and 90% at the line in one season, with the NBA's minimums
 * (300 field goals, 82 threes and 125 free throws made in an 82-game, 48-minute season), scaled to shorter seasons
 * and games.
 */
export const CLUB_MINIMUMS = { fgm: 300, tpm: 82, ftm: 125 };
export function fiftyFortyNinety(s: SeasonStatTotals, scale = 1): boolean {
  const k = Math.max(0.1, Math.min(1, scale));
  return s.fga > 0 && s.tpa > 0 && s.fta > 0 && s.fgm / s.fga >= 0.5 && s.tpm / s.tpa >= 0.4 && s.ftm / s.fta >= 0.9
    && s.fgm >= CLUB_MINIMUMS.fgm * k && s.tpm >= CLUB_MINIMUMS.tpm * k && s.ftm >= CLUB_MINIMUMS.ftm * k;
}

/** Field-goal percentage by distance band (null when no shots). */
export function zoneSplits(zones: number[] | undefined): { attempts: number; makes: number; pct: number | null }[] {
  return Array.from({ length: BAND_COUNT }, (_, i) => {
    const attempts = zones?.[i * 2] ?? 0, makes = zones?.[i * 2 + 1] ?? 0;
    return { attempts, makes, pct: attempts ? makes / attempts : null };
  });
}
