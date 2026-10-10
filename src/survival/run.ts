import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../hunt/teams';
import { eraOf, eraCoach, eraRules, underEra, type HuntEra } from '../hunt/eras';
import { withRotation } from '../hunt/run';

/*
 * Survival: Last Team Standing. You start with a stacked team of all-time greats and play real teams from NBA
 * history, one game at a time, each under its own era's rules. Every win has a price: the team you beat claims one
 * of your players, and you sign one of theirs. Your Franchise Player can never be taken; Shields (one to start, one
 * more for every boss) block a claim. One loss and the run is over. How long can you last?
 *
 * Seeded throughout: the same seed (the Daily Survival is the same for everyone) deals the same legends, the same
 * opponents and the same games for the same choices.
 */

export type SurvivalLevel = 'rookie' | 'pro' | 'legend';
export const SURVIVAL_LEVELS: Record<SurvivalLevel, { name: string; blurb: string; oppShift: number; claimFrom: number; mult: number }> = {
  rookie: { name: 'Rookie', blurb: 'Softer opponents; they claim one of your top four, not always the best.', oppShift: -3, claimFrom: 4, mult: 0.75 },
  pro: { name: 'Pro', blurb: 'The standard climb. They take one of your two best.', oppShift: 0, claimFrom: 2, mult: 1 },
  legend: { name: 'Legend', blurb: 'Tougher teams from the start, and they always take your best.', oppShift: 3, claimFrom: 1, mult: 1.5 },
};

export const ROSTER = 10;
export const DEALT = 14;
export const BOSS_EVERY = 5;
export const MAX_SHIELDS = 3;

export interface SurvivalGame {
  round: number; oppId: string; oppName: string; boss: boolean;
  us: number; them: number; won: boolean; top: string;
  /** Who they took (card id) and who you signed (card id), after a win. */
  lost?: string; signed?: string; shielded?: string;
}

export interface SurvivalRun {
  v: 1;
  seed: number;
  level: SurvivalLevel;
  /** "2026-10-10" for the Daily Survival. */
  daily?: string;
  /** The cards dealt at the start (pick ten). */
  dealt: string[];
  roster: string[];
  franchise: string | null;
  shields: number;
  games: SurvivalGame[];
  /** Opponents already faced (never twice). */
  faced: string[];
  /** The next opponent (team id), drawn when the round opens. */
  next: string | null;
  /** After a win: the player they want, and three of theirs to choose from. */
  claim?: { cardId: string; offer: string[] };
  stage: 'draft' | 'tag' | 'pregame' | 'claim' | 'sign' | 'over';
}

const posGroup = (pos: string) => (pos.includes('C') ? 'C' : pos.includes('G') ? 'G' : 'F');
const card = (h: NbaHistory, id: string) => cardPool(h).byId.get(id)!;

/** Fourteen greats from all of history, one season each, with a playable spread: five guards, five forwards, four centers. */
export function dealLegends(h: NbaHistory, seed: number): string[] {
  const pool = cardPool(h);
  const rng = new RNG(seed * 31 + 5);
  const out: HuntCard[] = [];
  const want: Record<'G' | 'F' | 'C', number> = { G: 5, F: 5, C: 4 };
  const pick = (list: HuntCard[], group: 'G' | 'F' | 'C') => {
    const fits = list.filter(c => posGroup(c.pos) === group && !out.some(o => o.playerId === c.playerId));
    return fits.length ? fits[rng.nextInt(fits.length)] : null;
  };
  // One legendary season at each position, the rest epic.
  for (const group of ['G', 'F', 'C'] as const) {
    for (let i = 0; i < want[group]; i++) {
      const c = pick(i < 1 ? pool.byRarity.legendary : pool.byRarity.epic, group) ?? pick(pool.byRarity.epic, group);
      if (c) out.push(c);
    }
  }
  return out.sort((a, b) => b.ovr - a.ovr).map(c => c.id);
}

export function newSurvivalRun(h: NbaHistory, seed: number, level: SurvivalLevel = 'pro', daily?: string): SurvivalRun {
  return { v: 1, seed, level, ...(daily ? { daily } : {}), dealt: dealLegends(h, seed), roster: [], franchise: null, shields: 1, games: [], faced: [], next: null, stage: 'draft' };
}

/** Keep ten of the fourteen. */
export function keepTen(run: SurvivalRun, ids: string[]): SurvivalRun {
  const keep = [...new Set(ids)].filter(id => run.dealt.includes(id));
  if (run.stage !== 'draft' || keep.length !== ROSTER) return run;
  return { ...run, roster: keep, stage: 'tag' };
}

/** Name the Franchise Player: nobody can ever take him. Opens round one. */
export function tagFranchise(h: NbaHistory, run: SurvivalRun, id: string): SurvivalRun {
  if (run.stage !== 'tag' || !run.roster.includes(id)) return run;
  return openRound(h, { ...run, franchise: id });
}

export const wins = (run: Pick<SurvivalRun, 'games'>) => run.games.filter(g => g.won).length;
export const roundNo = (run: Pick<SurvivalRun, 'games'>) => run.games.length + 1;
export const isBossRound = (round: number) => round % BOSS_EVERY === 0;

/** How strong the next opponent should be: a steady climb (real teams run from ~40 to ~73). */
export const targetStrength = (round: number, level: SurvivalLevel) => Math.min(72, 61 + round * 0.8 + SURVIVAL_LEVELS[level].oppShift + (isBossRound(round) ? 3 : 0));
/** Every round the opposition plays a little harder (added to each of their players), so late rounds stay scary. */
export const oppLift = (round: number) => Math.min(8, Math.round((round - 1) * 0.5));
/** The opponent's rating as shown before tip-off (their real strength plus the round's lift). */
export const opponentRating = (h: NbaHistory, run: SurvivalRun) => { const o = opponentOf(h, run); return o ? Math.round((o.strength + oppLift(roundNo(run))) * 10) / 10 : 0; };

function drawOpponent(h: NbaHistory, run: SurvivalRun): HuntTeam {
  const round = roundNo(run);
  const target = targetStrength(round, run.level);
  const boss = isBossRound(round);
  const rng = new RNG(run.seed * 977 + round * 131);
  const all = huntTeams(h).filter(t => !run.faced.includes(t.id) && (!boss || t.champion));
  const near = [...all].sort((a, b) => Math.abs(a.strength - target) - Math.abs(b.strength - target)).slice(0, boss ? 6 : 12);
  return near[rng.nextInt(near.length)];
}

function openRound(h: NbaHistory, run: SurvivalRun): SurvivalRun {
  const opp = drawOpponent(h, run);
  return { ...run, next: opp.id, stage: 'pregame', claim: undefined };
}

export const opponentOf = (h: NbaHistory, run: SurvivalRun): HuntTeam | null => (run.next ? huntTeams(h).find(t => t.id === run.next) ?? null : null);

/** Team rating: the best eight, starters counted more (the same scale as the opponents' strength). */
export function survivalRating(h: NbaHistory, ids: string[]): number {
  const best = ids.map(id => card(h, id)).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  if (!best.length) return 0;
  const w = best.map((_, i) => (i < 5 ? 1.2 : 0.7));
  return Math.round(best.reduce((n, c, i) => n + c.ovr * w[i], 0) / w.reduce((a, b) => a + b, 0) * 10) / 10;
}

function decadeOf(end: number) {
  return `${Math.floor(Math.min(2020, Math.max(1960, end - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
}

/** Plays the round's game under the opponent's era rules. */
export function playRound(h: NbaHistory, run: SurvivalRun): SurvivalRun {
  const opp = opponentOf(h, run);
  if (run.stage !== 'pregame' || !opp) return run;
  const era: HuntEra = eraOf(opp.end);
  const round = roundNo(run);
  const mineIds = new Set(run.roster.map(id => card(h, id).playerId));
  const theirCards = opp.roster.map(id => card(h, id)).filter(c => c && !mineIds.has(c.playerId)).slice(0, ROSTER);
  const mine = withRotation(run.roster.map(id => underEra(cardPlayer(h, card(h, id), 'SURV'), era)));
  const oppId = opp.abbr === 'SURV' ? 'OPP' : opp.abbr;
  const theirs = withRotation(theirCards.map(c => underEra(cardPlayer(h, c, oppId, oppLift(round)), era)));
  const home = round % 2 === 1;
  const us = { teamId: 'SURV', seasons: mine, coach: { ...eraCoach(era), rotationDepth: ROSTER }, chemistry: 70 };
  const them = { teamId: oppId, seasons: theirs, coach: { ...eraCoach(era), rotationDepth: ROSTER }, chemistry: 75 };
  const r = simulateGame({ home: home ? us : them, away: home ? them : us, rules: eraRules(era),
    settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decadeOf(opp.end)] ?? DEFAULT_GAME_SETTINGS.era, seed: run.seed * 101 + round * 7919, injuriesEnabled: false, teamChemistryEnabled: false } });
  const ours = home ? r.homeScore : r.awayScore, theirsPts = home ? r.awayScore : r.homeScore;
  let top = { name: '', pts: -1 };
  for (const [name, l] of Object.entries((home ? r.homeBox : r.awayBox).players)) if (l.minutes && l.points > top.pts) top = { name, pts: l.points };
  const won = ours > theirsPts;
  const game: SurvivalGame = { round, oppId: opp.id, oppName: teamLabel(opp), boss: isBossRound(round), us: ours, them: theirsPts, won, top: top.pts >= 0 ? `${top.name} ${top.pts}` : '' };
  const next: SurvivalRun = { ...run, games: [...run.games, game], faced: [...run.faced, opp.id] };
  if (!won) return { ...next, stage: 'over', next: null };
  const shields = game.boss ? Math.min(MAX_SHIELDS, run.shields + 1) : run.shields;
  return { ...next, shields, stage: 'claim', claim: { cardId: claimTarget(h, next), offer: signOffer(h, next, opp) } };
}

/** The player the beaten team wants: one of your best (not the Franchise Player); harder levels take the very best. */
export function claimTarget(h: NbaHistory, run: SurvivalRun, skip: string[] = []): string {
  const open = run.roster.filter(id => id !== run.franchise && !skip.includes(id)).map(id => card(h, id)).sort((a, b) => b.ovr - a.ovr);
  const from = Math.min(open.length, SURVIVAL_LEVELS[run.level].claimFrom);
  const rng = new RNG(run.seed * 59 + run.games.length * 17 + skip.length);
  return open[rng.nextInt(Math.max(1, from))]?.id ?? run.roster.find(id => id !== run.franchise)!;
}

/** Three of the beaten team's players you could sign (from their top six, never someone you already have). */
function signOffer(h: NbaHistory, run: SurvivalRun, opp: HuntTeam): string[] {
  const have = new Set(run.roster.map(id => card(h, id).playerId));
  const options = opp.roster.filter(id => !have.has(card(h, id).playerId)).slice(0, 6);
  const rng = new RNG(run.seed * 43 + run.games.length * 7);
  const out: string[] = [];
  while (out.length < 3 && options.length) out.push(options.splice(rng.nextInt(options.length), 1)[0]);
  return out.sort((a, b) => card(h, b).ovr - card(h, a).ovr);
}

/** Let him go, or spend a Shield to keep him (then they take someone else, and you can't shield again this round). */
export function answerClaim(h: NbaHistory, run: SurvivalRun, useShield: boolean): SurvivalRun {
  if (run.stage !== 'claim' || !run.claim) return run;
  const last = run.games[run.games.length - 1];
  if (useShield && run.shields > 0 && !last.shielded) {
    const kept = run.claim.cardId;
    const other = claimTarget(h, run, [kept]);
    const games = [...run.games.slice(0, -1), { ...last, shielded: kept }];
    return { ...run, shields: run.shields - 1, games, claim: { ...run.claim, cardId: other } };
  }
  const lost = run.claim.cardId;
  const games = [...run.games.slice(0, -1), { ...last, lost }];
  return { ...run, roster: run.roster.filter(id => id !== lost), games, stage: 'sign' };
}

/** Sign one of the three (or nobody, and play a man short). Opens the next round. */
export function signPlayer(h: NbaHistory, run: SurvivalRun, cardId: string | null): SurvivalRun {
  if (run.stage !== 'sign' || !run.claim) return run;
  const last = run.games[run.games.length - 1];
  if (cardId && !run.claim.offer.includes(cardId)) return run;
  const roster = cardId ? [...run.roster, cardId] : run.roster;
  const games = cardId ? [...run.games.slice(0, -1), { ...last, signed: cardId }] : run.games;
  return openRound(h, { ...run, roster, games });
}

// ---------------------------------------------------------------- score and records

export function survivalScore(run: SurvivalRun): number {
  const w = wins(run), bosses = run.games.filter(g => g.won && g.boss).length;
  const margin = run.games.filter(g => g.won).reduce((n, g) => n + Math.min(25, g.us - g.them), 0);
  return Math.round((w * 100 + bosses * 150 + margin * 2) * SURVIVAL_LEVELS[run.level].mult);
}

export function survivalShareText(run: SurvivalRun, site: string): string {
  const w = wins(run), last = run.games.at(-1);
  const strip = run.games.map(g => (g.won ? (g.boss ? '👑' : '🟩') : '🟥')).join('');
  return `Court Vision Survival${run.daily ? ` (Daily ${run.daily})` : ''}: ${w} win${w === 1 ? '' : 's'} on ${SURVIVAL_LEVELS[run.level].name}\n${strip}\n${last && !last.won ? `Knocked out by the ${last.oppName}.` : ''}\nScore ${survivalScore(run).toLocaleString()}. How long can you last? ${site}/#/survival`;
}

export const SURVIVAL_KEY = 'cv-survival-run';
export const SURVIVAL_RECORDS_KEY = 'cv-survival-records';
export interface SurvivalRecords {
  runs: number;
  best: Partial<Record<SurvivalLevel, { wins: number; score: number }>>;
  bossesBeaten: number;
  /** Daily Survival results by day. */
  daily: Record<string, { wins: number; score: number }>;
}

export function loadSurvivalRun(): SurvivalRun | null {
  try { const r = JSON.parse(localStorage.getItem(SURVIVAL_KEY) ?? 'null') as SurvivalRun | null; return r && r.v === 1 && Array.isArray(r.roster) && Array.isArray(r.games) ? r : null; } catch { return null; }
}
export function saveSurvivalRun(r: SurvivalRun | null): void {
  try { if (r) localStorage.setItem(SURVIVAL_KEY, JSON.stringify(r)); else localStorage.removeItem(SURVIVAL_KEY); } catch { /* storage blocked */ }
}
export function loadSurvivalRecords(): SurvivalRecords {
  try {
    const r = JSON.parse(localStorage.getItem(SURVIVAL_RECORDS_KEY) ?? 'null') as SurvivalRecords | null;
    if (r && Number.isFinite(r.runs)) return { runs: r.runs, best: r.best ?? {}, bossesBeaten: r.bossesBeaten ?? 0, daily: r.daily ?? {} };
  } catch { /* fall through */ }
  return { runs: 0, best: {}, bossesBeaten: 0, daily: {} };
}
/** Counts a finished run once. */
export function recordSurvival(run: SurvivalRun): SurvivalRecords {
  const r = loadSurvivalRecords(), w = wins(run), score = survivalScore(run);
  const prev = r.best[run.level];
  const next: SurvivalRecords = {
    runs: r.runs + 1,
    best: { ...r.best, [run.level]: !prev || score > prev.score ? { wins: Math.max(w, prev?.wins ?? 0), score } : { ...prev, wins: Math.max(prev.wins, w) } },
    bossesBeaten: r.bossesBeaten + run.games.filter(g => g.won && g.boss).length,
    daily: run.daily && !r.daily[run.daily] ? { ...r.daily, [run.daily]: { wins: w, score } } : r.daily,
  };
  try { localStorage.setItem(SURVIVAL_RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}

/** The seed of a day's Daily Survival (the same for everyone). */
export function dailySeed(day: string): number {
  let x = 2166136261;
  for (const ch of `survival|${day}`) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return (x >>> 0) % 1_000_000_000;
}
