import type { League, LeagueTeam } from './league';
import type { GameResult, TeamBoxScore } from './boxscore';

/*
 * The chemistry web: a bond between every two teammates, 0-100. It grows a little every game they both play real
 * minutes (more when they both play a lot) and slips when one is buried on the bench while the other plays; a trade
 * or a release breaks it (bonds only exist between players on the same roster). A bond of DUO_BOND or more is a
 * strong duo: when both suit up they read each other a little better on the floor (see duoBoost) and a basket one
 * sets up for the other gets its own callout on the court.
 */

export const DUO_BOND = 60;
/** Decision-making/help-defense points each player of a strong duo gets when both are in uniform. */
export const DUO_BOOST = 1.5;
const MAX_DUOS = 3;
/** Minutes that count as playing together tonight, and the "buried on the bench" line. */
const REAL_MINUTES = 12, BAD_MINUTES = 6;

export const bondKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const split = (key: string) => key.split('|') as [string, string];
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A team's bonds, keeping only pairs who are both still on the roster. */
export function teamBonds(team: LeagueTeam): Record<string, number> {
  const ids = new Set(team.seasons.map(s => s.playerId));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(team.bonds ?? {})) { const [a, b] = split(k); if (ids.has(a) && ids.has(b)) out[k] = v; }
  return out;
}

/** One game's change to a team's bonds, from its box score. Players who didn't dress (injured) are left alone. */
export function bondsAfterGame(team: LeagueTeam, box: TeamBoxScore): Record<string, number> {
  const bonds = teamBonds(team);
  const minutes = new Map(Object.values(box.players).map(l => [l.playerId, l.minutes]));
  const ids = team.seasons.map(s => s.playerId).filter(id => minutes.has(id));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const ma = minutes.get(ids[i]) ?? 0, mb = minutes.get(ids[j]) ?? 0, k = bondKey(ids[i], ids[j]);
    const now = bonds[k] ?? 0;
    let next = now;
    if (ma >= REAL_MINUTES && mb >= REAL_MINUTES) next = now + 1.2 * Math.min(ma, mb) / 36 * (1 - now / 115);
    else if ((ma >= REAL_MINUTES && mb < BAD_MINUTES) || (mb >= REAL_MINUTES && ma < BAD_MINUTES)) next = now - 0.35;
    next = Math.max(0, Math.min(100, next));
    if (next < 1) delete bonds[k]; else bonds[k] = round1(next);
  }
  return bonds;
}

/** Both teams' bonds after a finished game. */
export function applyGameBonds(teams: LeagueTeam[], result: GameResult): LeagueTeam[] {
  return teams.map(t => t.teamId === result.homeBox.teamId ? { ...t, bonds: bondsAfterGame(t, result.homeBox) }
    : t.teamId === result.awayBox.teamId ? { ...t, bonds: bondsAfterGame(t, result.awayBox) } : t);
}

export interface Duo { a: string; b: string; key: string; bond: number }
/** The team's strong duos, strongest first (at most three). */
export function strongDuos(team: LeagueTeam): Duo[] {
  return Object.entries(teamBonds(team)).filter(([, v]) => v >= DUO_BOND).sort((x, y) => y[1] - x[1]).slice(0, MAX_DUOS)
    .map(([key, bond]) => { const [a, b] = split(key); return { a, b, key, bond }; });
}
export const duoKeys = (team: LeagueTeam | undefined) => new Set(team ? strongDuos(team).map(d => d.key) : []);

/** Per-player boost for tonight: each member of a strong duo whose partner also dressed. */
export function duoBoost(team: LeagueTeam, dressedIds: string[]): Record<string, number> {
  const dressed = new Set(dressedIds), out: Record<string, number> = {};
  for (const d of strongDuos(team)) if (dressed.has(d.a) && dressed.has(d.b)) { out[d.a] = (out[d.a] ?? 0) + DUO_BOOST; out[d.b] = (out[d.b] ?? 0) + DUO_BOOST; }
  return out;
}

export type BondLevel = 'Duo' | 'Strong' | 'Growing' | 'New';
export const bondLevel = (v: number): BondLevel => v >= DUO_BOND ? 'Duo' : v >= 35 ? 'Strong' : v >= 12 ? 'Growing' : 'New';

/** Every pair on the team with a bond, strongest first (for the web and its table). */
export function bondList(team: LeagueTeam): Duo[] {
  return Object.entries(teamBonds(team)).sort((x, y) => y[1] - x[1]).map(([key, bond]) => { const [a, b] = split(key); return { a, b, key, bond }; });
}

/** The strongest duo in the league on another team, for "around the league" style mentions. */
export function leagueTopDuo(league: League): (Duo & { teamId: string }) | null {
  let best: (Duo & { teamId: string }) | null = null;
  for (const t of league.teams) { const d = strongDuos(t)[0]; if (d && (!best || d.bond > best.bond)) best = { ...d, teamId: t.teamId }; }
  return best;
}
