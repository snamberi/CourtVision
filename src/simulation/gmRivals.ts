import type { League } from './league';
import type { GMLeagueExtras, TradeProposal } from './gm';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { primaryPosition } from './teamStatus';

/*
 * GM rivals. Three AI general managers get a name, a face and a personality: a trade shark, a hoarder of young
 * players, and an old-school GM who hates analytics. They remember every trade they make with you: fleece one and
 * he holds a grudge (bad enough and he won't take your calls), treat him fairly and he warms up. Grudges fade a little
 * each season. Their agendas (what they want from you) show up on their page and on Deadline Day, and what they say
 * about you shows up in the news.
 */

export type RivalArchetype = 'shark' | 'collector' | 'oldschool';
export const ARCHETYPE: Record<RivalArchetype, { label: string; blurb: string }> = {
  shark: { label: 'The Trade Shark', blurb: 'Always calling, always lowballing. Loves a lopsided deal, as long as he is on the right side of it.' },
  collector: { label: 'The Collector', blurb: 'Hoards young players and draft picks. Will overpay for potential and never gives it back.' },
  oldschool: { label: 'The Old-School GM', blurb: 'Hates analytics. Trusts veterans, big men and the mid-range jumper. "Stats don\'t win rings."' },
};
export interface RivalMemory { season: string; text: string; delta: number }
export interface RivalGM { teamId: string; name: string; age: number; archetype: RivalArchetype; relation: number; memory: RivalMemory[] }
export interface GmRivalsState { userTeamId: string; season: string; rivals: RivalGM[] }

const FIRST = ['Victor', 'Dale', 'Marcus', 'Gordon', 'Ray', 'Stan', 'Lou', 'Frank', 'Hank', 'Mitch', 'Walt', 'Rex', 'Cal', 'Don', 'Bernie', 'Chet'];
const LAST = ['Kessler', 'Vance', 'Holloway', 'Pruitt', 'Castellano', 'Brandt', 'Whitmore', 'Sokol', 'Larkin', 'Dunmore', 'Maddox', 'Greer', 'Fenwick', 'Rourke', 'Tolliver', 'Bassett'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));

/** Picks the three rival GMs (once per league and team you run), and lets grudges cool at a new season. */
export function ensureGmRivals(league: League, userTeamId: string | null): League {
  if (!userTeamId) return league;
  const cur = league.gmRivals;
  if (cur && cur.userTeamId === userTeamId && cur.rivals.every(r => league.teams.some(t => t.teamId === r.teamId) && r.teamId !== userTeamId)) {
    if (cur.season === league.season) return league;
    // A new season: grudges and friendships drift 30% back toward neutral.
    return { ...league, gmRivals: { ...cur, season: league.season ?? '', rivals: cur.rivals.map(r => ({ ...r, relation: clamp(r.relation * 0.7) })) } };
  }
  const others = league.teams.filter(t => t.teamId !== userTeamId).sort((a, b) => hash(`${userTeamId}|${a.teamId}`) - hash(`${userTeamId}|${b.teamId}`));
  const archetypes: RivalArchetype[] = ['shark', 'collector', 'oldschool'];
  const rivals = others.slice(0, 3).map((t, i): RivalGM => {
    const h = hash(`${t.teamId}|gm`);
    return { teamId: t.teamId, name: `${FIRST[h % FIRST.length]} ${LAST[(h >>> 5) % LAST.length]}`, age: 38 + (h >>> 9) % 30, archetype: archetypes[i], relation: 0, memory: [] };
  });
  return { ...league, gmRivals: { userTeamId, season: league.season ?? '', rivals } };
}

export const rivalOf = (league: League, teamId: string) => league.gmRivals?.rivals.find(r => r.teamId === teamId) ?? null;
/** A rival with a deep enough grudge won't take your calls. */
export const REFUSE_AT = -40;
export const rivalRefuses = (league: League, teamId: string) => { const r = rivalOf(league, teamId); return !!r && r.relation <= REFUSE_AT; };
export const relationLabel = (v: number) => v <= REFUSE_AT ? "Won't take your calls" : v <= -15 ? 'Holds a grudge' : v < 15 ? 'Wary' : v < 40 ? 'Cordial' : 'Trusts you';

/**
 * Called when a trade goes through: if it was between you and a rival, he remembers it. `received` is the trade value
 * each side took home (before the trade), so he knows whether he was fleeced.
 */
export function rememberRivalTrade(league: League, proposal: TradeProposal, received: { a: number; b: number }, players: Map<string, PlayerSeason>): League {
  const state = league.gmRivals;
  if (!state) return league;
  const user = state.userTeamId;
  const rivalId = proposal.teamAId === user ? proposal.teamBId : proposal.teamBId === user ? proposal.teamAId : null;
  const rival = rivalId ? state.rivals.find(r => r.teamId === rivalId) : undefined;
  if (!rival) return league;
  const rivalIsA = proposal.teamAId === rival.teamId;
  const got = rivalIsA ? received.a : received.b, gave = rivalIsA ? received.b : received.a;
  const gaveIds = rivalIsA ? proposal.playersFromA : proposal.playersFromB, gotIds = rivalIsA ? proposal.playersFromB : proposal.playersFromA;
  const edge = (got - gave) / Math.max(1, Math.max(got, gave));
  let delta = edge < -0.08 ? -Math.round(12 + Math.min(20, -edge * 40)) : edge > 0.08 ? 4 : 2;
  const gaveYoung = gaveIds.map(id => players.get(id)).filter(p => p && p.age <= 23).length;
  const gotVets = gotIds.map(id => players.get(id)).filter(p => p && p.age >= 30).length;
  if (rival.archetype === 'collector' && gaveYoung) delta -= 6 * gaveYoung;
  if (rival.archetype === 'oldschool' && gotVets) delta += 3 * gotVets;
  if (rival.archetype === 'shark' && edge > 0.08) delta += 4;
  const star = (ids: string[]) => ids.map(id => players.get(id)).filter((p): p is PlayerSeason => !!p).sort((a, b) => calculateOverall(b) - calculateOverall(a))[0]?.playerId;
  const out = star(gaveIds) ?? 'picks', inn = star(gotIds) ?? 'picks';
  const text = delta <= -10 ? `Still bitter about the deal that sent ${out} your way for ${inn}.`
    : delta > 4 ? `Loves the deal that brought him ${inn}.` : `Called the ${inn}-for-${out} trade "fair enough".`;
  const next = { ...rival, relation: clamp(rival.relation + delta), memory: [...rival.memory, { season: league.season ?? '', text, delta }].slice(-12) };
  return { ...league, gmRivals: { ...state, rivals: state.rivals.map(r => r.teamId === rival.teamId ? next : r) } };
}

export interface RivalAgenda { text: string; playerId?: string }
/** What a rival wants from you right now. */
export function rivalAgenda(league: League, extras: GMLeagueExtras, rival: RivalGM): RivalAgenda {
  const mine = league.teams.find(t => t.teamId === league.gmRivals?.userTeamId);
  if (!mine || !mine.seasons.length) return { text: 'Watching and waiting.' };
  const by = (f: (p: PlayerSeason) => number) => [...mine.seasons].sort((a, b) => f(b) - f(a))[0];
  if (rival.archetype === 'shark') {
    const expiring = mine.seasons.filter(p => (extras.contracts[p.playerId]?.yearsRemaining ?? 2) <= 1);
    const p = (expiring.length ? expiring : mine.seasons).sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    return { playerId: p.playerId, text: `Wants ${p.playerId}${expiring.length ? ' before his contract runs out' : ''}, and will open with a lowball.` };
  }
  if (rival.archetype === 'collector') {
    const p = by(p => (p.development?.potential ?? calculateOverall(p)) - p.age * 1.5);
    return { playerId: p.playerId, text: `Has his eye on ${p.playerId} (${p.age}). Would pay a premium in veterans to get him.` };
  }
  const bigs = mine.seasons.filter(p => ['C', 'PF'].includes(primaryPosition(p)) && p.age >= 28);
  const p = (bigs.length ? bigs : mine.seasons.filter(x => x.age >= 28)).sort((a, b) => calculateOverall(b) - calculateOverall(a))[0] ?? by(calculateOverall);
  return { playerId: p.playerId, text: `Wants a "real basketball player": ${p.playerId}. "Forget your spreadsheets."` };
}

/** What a rival says about you, for the news and his page. */
export function rivalQuote(rival: RivalGM): string {
  const v = rival.relation;
  switch (rival.archetype) {
    case 'shark': return v <= -15 ? '"They got lucky once. It won\'t happen again."' : v >= 40 ? '"Smart operator. We do good business."' : '"My phone is always on. Theirs should be too."';
    case 'collector': return v <= -15 ? '"They took our future. We don\'t forget."' : v >= 40 ? '"They get it: you build through youth."' : '"Our young core isn\'t for sale. Theirs might be."';
    case 'oldschool': return v <= -15 ? '"Computer-league GM. Never played the game."' : v >= 40 ? '"Finally, someone who trusts his eyes."' : '"Rings aren\'t won on spreadsheets."';
  }
}

/** News lines from the rivals' memories (what they said after a trade with you). */
export function rivalNews(league: League): { id: string; teamId: string; headline: string; detail: string; season: string }[] {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return (league.gmRivals?.rivals ?? []).flatMap(r => r.memory.map((m, i) => ({
    id: `gmrival:${r.teamId}:${i}:${m.season}`, teamId: r.teamId, season: m.season,
    headline: `${name(r.teamId)} GM ${r.name}: ${m.text}`, detail: `${ARCHETYPE[r.archetype].label}. ${rivalQuote(r)}`,
  })));
}
