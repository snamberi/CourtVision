import { pressMood } from './press';
import type { League, LeagueTeam } from './league';
import { computeStandings, expenseEffects } from './league';
import type { GMLeagueExtras } from './gm';
import { computeAskingSalary } from './gm';
import type { PlayerMorale, PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { appendHistoryEvent } from './playerHistory';

/* Player personalities and morale.
 * Traits are derived from the player (stable hash + mental ratings), so old saves need no migration.
 * Morale is a snapshot taken at each league AI pass; its consequences:
 *   - an unhappy, established player asks for a trade (news, history, the AI shops him, chemistry dips);
 *   - an unhappy player won't re-sign with his team, and every player remembers teams that traded or waived him;
 *   - teammates clash or mesh, which moves team chemistry over the season. */

function hashUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export type PersonalityType = 'Leader' | 'Hothead' | 'Star Ego' | 'Mercenary' | 'Competitor' | 'Loyal' | 'Professional';
export const PERSONALITY_BLURB: Record<PersonalityType, string> = {
  Leader: 'Sets the tone in the locker room and brings young players along.',
  Hothead: 'Plays with fire. Clashes easily, especially with other short fuses.',
  'Star Ego': 'Needs the ball and the spotlight. Minutes and shots matter most.',
  Mercenary: 'Follows the money. Contract value drives his mood.',
  Competitor: 'Only cares about winning. Losing wears on him fast.',
  Loyal: 'Values stability. Happy to stay, slow to forgive a team that moves him.',
  Professional: 'Even-keeled. Does the job wherever he is.',
};
export interface Personality { ego: number; loyalty: number; winning: number; greed: number; leadership: number; temper: number; type: PersonalityType }

export function personalityOf(p: PlayerSeason): Personality {
  const t = (k: string) => Math.round(50 + hashUnit(`${p.playerId}|${k}`) * 42);
  const overall = calculateOverall(p);
  const ego = clamp(t('ego') + (overall - 65) * 0.6 - (p.age <= 21 ? 8 : 0));
  const loyalty = t('loyalty'), winning = clamp(t('win') + (p.age >= 30 ? 8 : 0)), greed = t('greed');
  const leadership = clamp(p.attributes.mental.leadership * 0.8 + (p.age >= 28 ? 12 : 0) + hashUnit(`${p.playerId}|lead`) * 6);
  const temper = clamp(100 - p.attributes.mental.composure + hashUnit(`${p.playerId}|temper`) * 12);
  const type: PersonalityType = leadership >= 78 ? 'Leader' : temper >= 70 ? 'Hothead' : ego >= 78 ? 'Star Ego' : greed >= 80 ? 'Mercenary'
    : winning >= 78 ? 'Competitor' : loyalty >= 78 ? 'Loyal' : 'Professional';
  return { ego, loyalty, winning, greed, leadership, temper, type };
}

export interface LockerLink { a: string; b: string; kind: 'clash' | 'mesh'; reason: string }
/** Who gets along and who doesn't on one roster. */
export function lockerRoom(team: LeagueTeam): { links: LockerLink[]; chemistryDelta: number } {
  const players = team.seasons.map(p => ({ p, per: personalityOf(p), ovr: calculateOverall(p) }));
  const links: LockerLink[] = [];
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const x = players[i], y = players[j];
    if (x.per.ego >= 75 && y.per.ego >= 75 && x.ovr >= 70 && y.ovr >= 70) links.push({ a: x.p.playerId, b: y.p.playerId, kind: 'clash', reason: 'Two alphas who both want the last shot' });
    else if (x.per.type === 'Hothead' && y.per.type === 'Hothead') links.push({ a: x.p.playerId, b: y.p.playerId, kind: 'clash', reason: 'Two short fuses in one locker room' });
    else if (x.per.type === 'Competitor' && y.per.type === 'Competitor') links.push({ a: x.p.playerId, b: y.p.playerId, kind: 'mesh', reason: 'Push each other every practice' });
  }
  for (const l of players.filter(x => x.per.type === 'Leader' && x.ovr >= 60)) {
    const mentees = players.filter(x => x !== l && (x.p.age <= 23 || x.per.type === 'Hothead')).sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    for (const m of mentees) links.push({ a: l.p.playerId, b: m.p.playerId, kind: 'mesh', reason: m.per.type === 'Hothead' ? 'Keeps him in check' : 'Mentors the young player' });
  }
  const delta = links.reduce((n, l) => n + (l.kind === 'mesh' ? 1.5 : -2.5), 0);
  return { links, chemistryDelta: clamp(delta, -6, 6) };
}

export interface MoraleFactor { label: string; delta: number }
export interface MoraleView { score: number; label: string; factors: MoraleFactor[]; personality: Personality }
export const moraleLabel = (score: number) => score >= 80 ? 'Thrilled' : score >= 65 ? 'Happy' : score >= 45 ? 'Content' : score >= 30 ? 'Frustrated' : 'Unhappy';
const EXPECTED_MPG = [34, 33, 31, 29, 27, 22, 19, 16, 12, 9];

interface TeamContext { winPct: number | null; rank: Map<string, number>; links: LockerLink[] }
function teamContext(league: League, team: LeagueTeam, standings = computeStandings(league)): TeamContext {
  const row = standings.find(r => r.teamId === team.teamId);
  const games = row ? row.wins + row.losses : 0;
  const rank = new Map([...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).map((p, i) => [p.playerId, i]));
  return { winPct: games >= 8 ? row!.winPct : null, rank, links: lockerRoom(team).links };
}

/** Current morale for a rostered player, with the reasons behind it. */
export function playerMorale(p: PlayerSeason, team: LeagueTeam, league: League, extras: GMLeagueExtras, ctx = teamContext(league, team)): MoraleView {
  const per = personalityOf(p);
  const factors: MoraleFactor[] = [];
  const add = (label: string, delta: number) => { const d = Math.round(delta); if (d !== 0) factors.push({ label, delta: d }); };
  const stats = p.seasonStats;
  const mpg = stats && stats.gamesPlayed >= 5 ? stats.minutes / stats.gamesPlayed : p.minutes.target;
  const rank = ctx.rank.get(p.playerId) ?? 9;
  const expected = EXPECTED_MPG[rank] ?? 4;
  const egoWeight = 0.6 + per.ego / 100 - (p.age <= 22 ? 0.3 : 0);
  // Stars expect big minutes and complain loudly; the end of the bench knows its place.
  const role = clamp((mpg - expected) / Math.max(8, expected) * 30 * egoWeight, rank < 5 ? -25 : rank < 10 ? -15 : -5, 10);
  add(role < 0 ? `Wants more minutes (${mpg.toFixed(0)} vs ${expected} expected)` : 'Happy with his role', role);
  if (ctx.winPct != null) add(ctx.winPct >= 0.5 ? 'Winning team' : 'Tired of losing', clamp((ctx.winPct - 0.5) * 60 * (0.4 + per.winning / 100), -24, 15));
  const contract = extras.contracts[p.playerId];
  if (contract) {
    const asking = computeAskingSalary(calculateOverall(p), extras.capSettings);
    const ratio = (contract.annualSalary - asking) / Math.max(1, asking);
    add(ratio < 0 ? 'Feels underpaid' : 'Well paid', clamp(ratio * 15 * (0.4 + per.greed / 100), -10, 5));
  }
  const trust = p.training?.morale?.trust;
  if (trust != null) add(trust >= 50 ? 'Trusts the coach' : "Doesn't trust the coach", (trust - 50) * 0.25);
  add('Facilities', expenseEffects(team.expenseLevels).moodBonus * 1.5);
  add('What the coach said to the press', pressMood(league, p.playerId));
  add('Practice facility', (team.business?.arena.practice ?? 0) * 2);
  for (const l of ctx.links.filter(l => l.a === p.playerId || l.b === p.playerId)) {
    const other = l.a === p.playerId ? l.b : l.a;
    add(`${l.kind === 'clash' ? 'Clashes with' : 'Gets along with'} ${other}`, l.kind === 'clash' ? -6 : 4);
  }
  const score = Math.round(clamp(57 + factors.reduce((n, f) => n + f.delta, 0)));
  return { score, label: moraleLabel(score), factors: factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), personality: per };
}

export interface MoraleEvent { teamId: string; playerId: string; kind: 'trade_request' | 'withdrawn'; text: string }
const REQUEST_BELOW = 36, WITHDRAW_AT = 52;

/**
 * Refreshes every rostered player's morale snapshot during the regular season and applies consequences.
 * Deterministic; safe to call repeatedly (a request is only filed once per season).
 */
export function refreshLeagueMorale(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; events: MoraleEvent[] } {
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return { league, extras, events: [] };
  const season = league.season ?? '';
  const standings = computeStandings(league);
  const events: MoraleEvent[] = [];
  let tradeBlock = extras.tradeBlock;
  const teams = league.teams.map(team => {
    const ctx = teamContext(league, team, standings);
    const row = standings.find(r => r.teamId === team.teamId);
    const teamGames = row ? row.wins + row.losses : 0;
    let changed = false, requests = 0, moraleSum = 0;
    const seasons = team.seasons.map(p => {
      const view = playerMorale(p, team, league, extras, ctx);
      const prev = p.morale?.season === season && p.morale.teamId === team.teamId ? p.morale : undefined;
      let next: PlayerMorale = { ...p.morale, score: view.score, season, teamId: team.teamId, games: teamGames, tradeRequest: prev?.tradeRequest };
      if (view.score >= 75 && teamGames >= 40 && !(next.fondOf ?? []).includes(team.teamId)) next = { ...next, fondOf: [...(next.fondOf ?? []), team.teamId] };
      let out: PlayerSeason = { ...p, morale: next };
      const established = calculateOverall(p) >= 60 && teamGames >= 15;
      if (!next.tradeRequest && established && view.score < REQUEST_BELOW) {
        const why = view.factors.find(f => f.delta < 0)?.label.toLowerCase() ?? 'unhappy with his situation';
        out = appendHistoryEvent({ ...out, morale: { ...next, tradeRequest: season } }, 'trade_request', `Requested a trade from ${team.name} (${why})`, team.teamId);
        events.push({ teamId: team.teamId, playerId: p.playerId, kind: 'trade_request', text: `${p.playerId} has asked ${team.name} for a trade: ${why}.` });
        if (!tradeBlock.includes(p.playerId)) tradeBlock = [...tradeBlock, p.playerId];
      } else if (next.tradeRequest && view.score >= WITHDRAW_AT) {
        out = { ...out, morale: { ...next, tradeRequest: undefined } };
        events.push({ teamId: team.teamId, playerId: p.playerId, kind: 'withdrawn', text: `${p.playerId} is happy again and has withdrawn his trade request.` });
      }
      if (out.morale?.tradeRequest) requests++;
      moraleSum += view.score;
      changed = true;
      return out;
    });
    if (!changed) return team;
    // Locker-room chemistry drifts with clashes, mentoring, average mood and open trade requests, paced per game played.
    const lastGames = Math.max(0, ...team.seasons.map(p => p.morale?.season === season ? p.morale.games : 0));
    const dGames = Math.max(0, teamGames - lastGames);
    const avg = seasons.length ? moraleSum / seasons.length : 60;
    const target = clamp(lockerRoom(team).chemistryDelta + (avg - 60) / 5 - requests * 2, -8, 8);
    const chemistry = dGames > 0 ? Math.round(clamp((team.chemistry ?? 70) + target * 0.02 * dGames) * 10) / 10 : team.chemistry;
    return { ...team, seasons, chemistry };
  });
  return { league: { ...league, teams }, extras: tradeBlock === extras.tradeBlock ? extras : { ...extras, tradeBlock }, events };
}

/** Adds a grudge when a team moves a player who didn't ask to leave. */
export function withGrudge(p: PlayerSeason, fromTeamId: string, season: string | undefined): PlayerSeason {
  if (p.morale?.tradeRequest) return { ...p, morale: { ...p.morale, tradeRequest: undefined } };
  const per = personalityOf(p);
  if ((p.morale?.score ?? 60) < 45 || per.loyalty < 45) return p;
  const grudges = [...new Set([...(p.morale?.grudges ?? []), fromTeamId])];
  return { ...p, morale: { score: p.morale?.score ?? 60, season: p.morale?.season ?? season ?? '', teamId: p.morale?.teamId ?? fromTeamId, games: p.morale?.games ?? 0, ...p.morale, grudges } };
}

/** How a player's history and personality change what a team must pay him. Positive = more expensive. */
export function moraleContractAdjustment(p: PlayerSeason, teamId: string, isPriorTeam: boolean): { premium: number; refuses?: string; notes: string[] } {
  const per = personalityOf(p), m = p.morale, notes: string[] = [];
  let premium = (per.greed - 50) / 500;
  if (per.greed >= 80) notes.push('mercenary');
  if (isPriorTeam && m) {
    if (m.tradeRequest || m.score < REQUEST_BELOW) return { premium, refuses: `${p.playerId} won't re-sign. He wants out after an unhappy season.`, notes };
    if (m.score < 50) { premium += 0.2; notes.push('unhappy season'); }
    else if (m.score >= 75 && per.loyalty >= 55) { premium -= 0.12; notes.push('hometown discount'); }
  }
  if (m?.grudges?.includes(teamId)) {
    if (per.temper >= 70) return { premium, refuses: `${p.playerId} hasn't forgiven this front office for moving him.`, notes };
    premium += 0.2; notes.push('remembers being moved');
  } else if (!isPriorTeam && m?.fondOf?.includes(teamId)) { premium -= 0.08; notes.push('fond memories'); }
  return { premium, notes };
}
