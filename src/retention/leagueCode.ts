import { SCENARIOS } from '../simulation/rebuildChallenge';
import { TWISTS } from './weekly';
import type { TradeDifficulty } from '../simulation/gm';

/*
 * League codes: a short code holds everything needed to build the same starting league again (the kind, the season,
 * the options and the seed), plus the team, so a friend who types it on the main menu gets the identical rosters,
 * generated players, draft classes and schedule. Game results still differ: every game is simulated fresh.
 *
 *   G2025-4-K3M9QX-BOS-7   random league, 2025-26, options, seed, team, check digit
 *   H2016-9-4K2J9Z-LAL-Q   real NBA history from 2016-17
 *   BBULLS99-2-1ZZ0KQ-CHI-3  a Rebuild scenario (and its weekly twist)
 */

export type LeagueKind = 'random' | 'history' | 'rebuild';
export interface LeagueOrigin {
  kind: LeagueKind; seed: number; difficulty: TradeDifficulty;
  /** Random and history: the start year. */
  year?: number;
  /** History options. */
  realDevelopment?: boolean; forceRosters?: boolean; allPlayers?: boolean;
  /** Rebuild: the scenario, and the weekly twist if it was the Rebuild of the Week. */
  scenario?: string; twist?: string;
}

const DIFFS: TradeDifficulty[] = ['easy', 'normal', 'hard'];
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const check = (body: string) => ALPHABET[[...body].reduce((h, c, i) => (h * 31 + c.charCodeAt(0) * (i + 1)) % 1_000_003, 7) % 32];
const toB32 = (n: number) => { let s = ''; do { s = ALPHABET[n % 32] + s; n = Math.floor(n / 32); } while (n > 0); return s; };
const fromB32 = (s: string) => [...s].reduce((n, c) => { const v = ALPHABET.indexOf(c); if (v < 0) throw new Error('bad'); return n * 32 + v; }, 0);

export function encodeLeagueCode(o: LeagueOrigin, teamId?: string | null): string {
  const d = Math.max(0, DIFFS.indexOf(o.difficulty));
  let head: string, opts: number;
  if (o.kind === 'rebuild') {
    head = `B${(o.scenario ?? '').toUpperCase()}`;
    opts = d + 3 * (o.twist ? Math.max(0, TWISTS.findIndex(t => t.id === o.twist)) + 1 : 0);
  } else {
    head = `${o.kind === 'random' ? 'G' : 'H'}${o.year ?? ''}`;
    opts = d + 3 * ((o.realDevelopment ? 1 : 0) + (o.forceRosters ? 2 : 0) + (o.allPlayers ? 4 : 0));
  }
  const body = [head, toB32(opts), toB32(o.seed), ...(teamId ? [teamId.toUpperCase().replace(/[^A-Z0-9]/g, '')] : [])].join('-');
  return `${body}-${check(body)}`;
}

export interface DecodedCode { origin: LeagueOrigin; teamId: string | null }
/** Reads a code (any case, spaces and O/I/L typos forgiven). Throws a readable error for anything else. */
export function decodeLeagueCode(raw: string): DecodedCode {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
  const parts = code.split('-');
  if (parts.length < 4 || parts.length > 5) throw new Error('That is not a Court Vision league code.');
  // The number parts use Crockford base32, which has no O, I or L: read those as 0 and 1.
  const fix = (s: string) => s.replace(/O/g, '0').replace(/[IL]/g, '1');
  const sum = fix(parts.pop()!);
  parts[1] = fix(parts[1]); parts[2] = fix(parts[2]);
  if (check(parts.join('-')) !== sum) throw new Error('This code has a typo: check it and try again.');
  const [head, optsRaw, seedRaw, team] = parts;
  let opts: number, seed: number;
  try { opts = fromB32(optsRaw); seed = fromB32(seedRaw); } catch { throw new Error('This code has a typo: check it and try again.'); }
  const difficulty = DIFFS[opts % 3];
  const rest = Math.floor(opts / 3);
  const teamId = team ?? null;
  if (head.startsWith('B')) {
    const scenario = SCENARIOS.find(s => s.id.toUpperCase() === head.slice(1));
    if (!scenario) throw new Error('This code is for a Rebuild scenario this version of the game does not have.');
    const twist = rest ? TWISTS[rest - 1]?.id : undefined;
    return { origin: { kind: 'rebuild', seed, difficulty, scenario: scenario.id, ...(twist ? { twist } : {}) }, teamId };
  }
  const kind: LeagueKind | null = head[0] === 'G' ? 'random' : head[0] === 'H' ? 'history' : null;
  const year = Number(head.slice(1));
  if (!kind || !Number.isInteger(year) || year < 1946 || year > 2100) throw new Error('That is not a Court Vision league code.');
  return { origin: { kind, seed, difficulty, year, ...(kind === 'history' ? { realDevelopment: !!(rest & 1), forceRosters: !!(rest & 2), allPlayers: !!(rest & 4) } : {}) }, teamId };
}

/** One line describing what a code starts. */
export function describeOrigin(o: LeagueOrigin, teamName?: string): string {
  const team = teamName ? ` as ${teamName}` : '';
  if (o.kind === 'rebuild') {
    const sc = SCENARIOS.find(s => s.id === o.scenario);
    const tw = TWISTS.find(t => t.id === o.twist);
    return `Rebuild Challenge: ${sc?.title ?? o.scenario}${tw && tw.id !== 'standard' ? ` (${tw.label})` : ''}${team}`;
  }
  const season = `${o.year}-${String((o.year ?? 0) + 1).slice(2)}`;
  return o.kind === 'random' ? `Random league, ${season}${team}` : `Real NBA history from ${season}${team}${o.forceRosters ? ', historical rosters' : ''}`;
}
