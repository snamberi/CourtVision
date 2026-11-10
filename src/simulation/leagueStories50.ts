import type { League, RetiredPlayerRecord } from './league';
import type { GMLeagueExtras, TradeProposal, DraftProspect } from './gm';
import type { PlayerSeason } from './types';
import type { GameResult } from './boxscore';
import type { CoachIdentity } from './coaching';
import { calculateOverall } from './engine/overall';
import { scoutingReport, type ScoutingReport } from './scouting';
import { gameLog } from './logPacking';
import { getPlayerAwardsHistory } from './leagueAnalytics';

export interface TradeAsset50 { id: string; kind: 'player' | 'pick'; label: string }
export interface TradeReceipt50 { id: string; season: string; date?: string; teamA: string; teamB: string; fromA: TradeAsset50[]; fromB: TradeAsset50[] }
export interface DraftReceipt50 { playerId: string; season: string; teamId: string; pick: number; round: number; assetId: string; overall: number; report: ScoutingReport }
export interface DuoSeason50 { a: string; b: string; season: string; teamId: string; games: number; wins: number; playoffGames: number; playoffWins: number; assists: number; points: number; bestPoints: number; bestGame: string; champion: boolean }
export interface PickRollover50 { from: string; to?: string; owner: string; note: string }
export interface Stories50 { pickRollovers?: PickRollover50[]; trades: TradeReceipt50[]; drafts: DraftReceipt50[]; duos: DuoSeason50[] }
export const stories50 = (league: League): Stories50 => league.stories50 ?? { trades: [], drafts: [], duos: [] };
export function currentPickAsset(league: League, extras: GMLeagueExtras, slot: number): string { return extras.draftAssetIds?.[slot] ?? `${league.season ?? 'draft'}-slot-${slot}`; }
export function recordTrade50(before: League, after: League, extras: GMLeagueExtras, p: TradeProposal): League {
  const s = stories50(before), names = new Map(before.teams.map(t => [t.teamId, t.name]));
  const assets = (players: string[], futures: string[] = [], slots: number[] = []): TradeAsset50[] => [
    ...players.map(id => ({ id, kind: 'player' as const, label: id })), ...futures.map(id => { const pick = extras.futurePicks?.find(x => x.id === id); return { id, kind: 'pick' as const, label: pick ? `${pick.year} R${pick.round} · ${names.get(pick.originalTeamId) ?? pick.originalTeamId}${pick.protection ? ` (${pick.protection.label})` : ''}` : id }; }),
    ...slots.map(slot => ({ id: currentPickAsset(before, extras, slot), kind: 'pick' as const, label: `${before.season} pick #${slot + 1}` })) ];
  const receipt: TradeReceipt50 = { id: `${before.season}:${s.trades.length}`, season: before.season ?? '', date: before.calendarDate, teamA: p.teamAId, teamB: p.teamBId,
    fromA: assets(p.playersFromA, p.picksFromA, p.currentPicksFromA), fromB: assets(p.playersFromB, p.picksFromB, p.currentPicksFromB) };
  return { ...after, stories50: { ...s, trades: [...s.trades, receipt] } };
}
export function recordDraft50(before: League, after: League, extras: GMLeagueExtras, prospect: DraftProspect, playerId: string, teamId: string, slot: number): League {
  const s = stories50(before);
  const receipt: DraftReceipt50 = { playerId, teamId, season: before.season ?? '', pick: slot + 1, round: slot < before.teams.length ? 1 : 2,
    assetId: currentPickAsset(before, extras, slot), overall: calculateOverall(prospect.trueSeason), report: scoutingReport(prospect, before, extras, teamId) };
  return { ...after, stories50: { ...s, drafts: [...s.drafts, receipt] } };
}
export interface TradeTree50 { asset: TradeAsset50; drafted?: DraftReceipt50; exchanged?: TradeReceipt50; children: TradeTree50[]; stopped?: boolean; note?: string }
export function tradeTree50(league: League, trade: TradeReceipt50, teamId: string): TradeTree50[] {
  const all = stories50(league), start = all.trades.findIndex(t => t.id === trade.id);
  const follow = (asset: TradeAsset50, after: number, seen: Set<string>, depth: number): TradeTree50 => {
    const ids = new Set([asset.id]); let resolvedId=asset.id, note='';
    if (asset.kind === 'pick') for (let n=0;n<20;n++) { const rollover=all.pickRollovers?.find(p=>p.from===resolvedId && p.owner===teamId); if (!rollover) break; note += `${rollover.note} `; if (!rollover.to) return { asset, children: [], stopped: true, note }; resolvedId=rollover.to; if (ids.has(resolvedId)) break; ids.add(resolvedId); }
    const draft = asset.kind === 'pick' ? all.drafts.find(d => d.assetId === resolvedId) : undefined;
    if (draft) ids.add(draft.playerId);
    const index = all.trades.findIndex((t, i) => i > after && (t.teamA === teamId ? t.fromA : t.teamB === teamId ? t.fromB : []).some(a => ids.has(a.id)));
    const exchanged = index >= 0 ? all.trades[index] : undefined;
    const node: TradeTree50 = { asset, drafted: draft, exchanged, children: [], note };
    if (!exchanged) return node;
    if (depth >= 12 || seen.has(exchanged.id)) return { ...node, stopped: true };
    const next = new Set([...seen, exchanged.id]);
    node.children = (exchanged.teamA === teamId ? exchanged.fromB : exchanged.fromA).map(a => follow(a, index, next, depth + 1)); return node;
  };
  return (trade.teamA === teamId ? trade.fromB : trade.fromA).map(a => follow(a, start, new Set([trade.id]), 0));
}
export function allStoryPlayers(league: League, extras?: GMLeagueExtras): PlayerSeason[] {
  const map = new Map<string, PlayerSeason>();
  for (const r of league.retiredPlayers ?? []) if (r.finalSeasonData) map.set(r.playerId, r.finalSeasonData);
  for (const p of [...(extras?.freeAgents ?? []), ...league.teams.flatMap(t => t.seasons)]) map.set(p.playerId, p);
  return [...map.values()];
}
export function playerAfterDraft(league: League, receipt: DraftReceipt50, extras?: GMLeagueExtras) {
  const p = allStoryPlayers(league, extras).find(x => x.playerId === receipt.playerId);
  const awards = p ? getPlayerAwardsHistory(league, p.playerId, p) : [];
  return { player: p, peak: p ? Math.max(calculateOverall(p), ...(p.careerHistory ?? []).map(y => y.overall)) : null,
    awards, seasons: p?.careerHistory?.length ?? 0, retired: league.retiredPlayers?.some(r => r.playerId === receipt.playerId) ?? false };
}
export function seasonDuos50(league: League): DuoSeason50[] {
  const rows = new Map<string, DuoSeason50>();
  const add = (result: GameResult, id: string, playoffs: boolean) => {
    const assisted = new Map<string, number>();
    for (const e of gameLog(result)) if (e.playback?.shotMade && e.playback.assistId && e.playback.shooterId) {
      const key = [e.playback.assistId, e.playback.shooterId].sort().join('|'); assisted.set(key, (assisted.get(key) ?? 0) + 1);
    }
    for (const [box, won] of [[result.homeBox, result.homeScore > result.awayScore], [result.awayBox, result.awayScore > result.homeScore]] as const) {
      const players = Object.values(box.players).filter(p => p.minutes > 0).sort((a, b) => a.playerId.localeCompare(b.playerId));
      for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j], pair = `${a.playerId}|${b.playerId}`, key = `${box.teamId}|${pair}`, points = a.points + b.points;
        const titleRoster = league.teams.find(t => t.teamId === league.playoffBracket?.championTeamId)?.seasons;
        const champion = league.playoffBracket?.championTeamId === box.teamId && !!titleRoster?.some(p => p.playerId === a.playerId) && !!titleRoster?.some(p => p.playerId === b.playerId);
        const r = rows.get(key) ?? { a: a.playerId, b: b.playerId, season: league.season ?? '', teamId: box.teamId, games: 0, wins: 0, playoffGames: 0, playoffWins: 0, assists: 0, points: 0, bestPoints: 0, bestGame: '', champion };
        r.games++; r.wins += Number(won); r.playoffGames += Number(playoffs); r.playoffWins += Number(playoffs && won); r.assists += assisted.get(pair) ?? 0; r.points += points;
        if (points > r.bestPoints) { r.bestPoints = points; r.bestGame = id; } rows.set(key, r);
      }
    }
  };
  for (const g of league.schedule) if (g.played && g.result) add(g.result, g.id, false);
  for (const s of league.playoffBracket?.rounds.flat() ?? []) s.games.forEach((g, i) => add(g, `${s.id}:${i}`, true));
  return [...rows.values()];
}
export function archiveDuos50(league: League): Stories50 {
  const s = stories50(league); return { ...s, duos: [...s.duos.filter(d => d.season !== league.season), ...seasonDuos50(league)] };
}
export function retiredCoach50(record: RetiredPlayerRecord, season: string): CoachIdentity | null {
  const p = record.finalSeasonData; if (!p) return null;
  const years = Math.max(0, parseInt(season) - parseInt(record.finalSeason));
  if (record.finalAge + years > 75) return null;
  const cap = (n: number) => Math.max(25, Math.min(95, Math.round(n)));
  const traits = { offense: cap((p.attributes.offense.threePoint + p.attributes.offense.passing + p.attributes.offense.offensiveIQ) / 3),
    defense: cap((p.attributes.defense.defensiveIQ + p.attributes.defense.perimeterDefense + p.attributes.defense.interiorDefense) / 3),
    development: cap((p.development.workEthic + p.attributes.mental.leadership) / 2), motivation: cap(p.attributes.mental.leadership),
    rotationMgmt: cap(p.attributes.offense.decisionMaking), discipline: cap(p.development.workEthic) };
  return { coachId: p.playerId, formerPlayerId: p.playerId, age: record.finalAge + years, rating: Math.round(Object.values(traits).reduce((a, b) => a + b, 0) / 6),
    hiredSeason: season, careerWins: 0, careerLosses: 0, championships: 0, contract: { annualSalary: 1_500_000, yearsRemaining: 2 }, traits,
    relationships: {}, playingStyle: { threePointFrequency: (p.tendencies.shot.aboveBreak3 + p.tendencies.shot.catchAndShoot3) / 2, paceTendency: p.attributes.physical.speed, postFrequency: p.tendencies.shot.postShot } };
}
export function inviteRetiredCoach50(league: League, playerId: string): League {
  const record = league.retiredPlayers?.find(r => r.playerId === playerId); if (!record) throw new Error('Choose a retired player.');
  const used = new Set([...(league.staffMarket ?? []).map(c => c.coachId), ...league.teams.flatMap(t => [t.coachIdentity, ...Object.values(t.staff ?? {})].filter((c): c is CoachIdentity => !!c).map(c => c.coachId))]);
  if (used.has(playerId)) throw new Error('This player is already coaching or on the staff market.');
  const coach = retiredCoach50(record, league.season ?? '2026'); if (!coach) throw new Error('This retiree has no available playing record or is over 75.');
  return { ...league, staffMarket: [...(league.staffMarket ?? []), coach] };
}
export function formerPlayers50(league: League, extras: GMLeagueExtras, teamId: string) {
  return allStoryPlayers(league, extras).filter(p => p.teamId !== teamId && (p.draftTeamId === teamId || p.careerHistory?.some(y => y.teamId === teamId || y.stints?.some(s => s.teamId === teamId)) || p.history?.some(h => h.teamId === teamId && ['signed', 'drafted', 'traded', 'moved'].includes(h.type))))
    .map(p => ({ player: p, team: league.retiredPlayers?.some(r => r.playerId === p.playerId) ? 'Retired' : league.teams.find(t => t.teamId === p.teamId)?.name ?? 'Free agent',
      awards: getPlayerAwardsHistory(league, p.playerId, p), revenge: league.schedule.filter(g => g.played && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId)).flatMap(g => { const box = g.homeTeamId === teamId ? g.result!.awayBox : g.result!.homeBox; const line = box.players[p.playerId]; return line?.minutes > 0 ? [{ gameId: g.id, points: line.points, rebounds: line.oreb + line.dreb, assists: line.ast }] : []; }) }));
}
export interface Promise50 { id: string; playerId: string; teamId: string; kind: 'starter' | 'touches' | 'contend'; season: string; games: number; keptGames: number; target: number; status: 'active' | 'kept' | 'broken' | 'ended' }
export function makePromise50(league: League, teamId: string, playerId: string, kind: Promise50['kind'], actor: string | null): League {
  if (!league.settings.sandboxMode && actor !== teamId) throw new Error('You can only make promises to your own players.');
  const team = league.teams.find(t => t.teamId === teamId); if (!team?.seasons.some(p => p.playerId === playerId)) throw new Error('Choose a player on this team.');
  const list = league.promises50 ?? [];
  if (list.some(p => p.playerId === playerId && p.status === 'active')) throw new Error('Resolve this player’s current promise first.');
  const p: Promise50 = { id: `${league.season}:${playerId}:${list.length}`, playerId, teamId, kind, season: league.season ?? '', games: 0, keptGames: 0, target: kind === 'contend' ? .6 : kind === 'touches' ? 16 : 26, status: 'active' };
  return { ...league, promises50: [...list, p] };
}
export function settlePromises50(league: League, result: GameResult): League {
  let teams = league.teams;
  const promises = (league.promises50 ?? []).map(p => {
    if (p.status !== 'active' || ![result.homeTeamId, result.awayTeamId].includes(p.teamId)) return p;
    if (!league.teams.find(t => t.teamId === p.teamId)?.seasons.some(s => s.playerId === p.playerId)) return { ...p, status: 'ended' as const };
    const box = result.homeTeamId === p.teamId ? result.homeBox : result.awayBox;
    const line = box.players[p.playerId]; if (!line || line.minutes === 0) return p;
    const won = result.homeTeamId === p.teamId ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
    const success = p.kind === 'contend' ? won : p.kind === 'touches' ? line.fga >= p.target : line.minutes >= p.target;
    const games = p.games + 1, keptGames = p.keptGames + Number(success);
    const status: Promise50['status'] = games < 10 ? 'active' : keptGames >= (p.kind === 'contend' ? 6 : 7) ? 'kept' : 'broken';
    if (status !== 'active') teams = teams.map(t => t.teamId !== p.teamId ? t : { ...t, seasons: t.seasons.map(s => s.playerId !== p.playerId ? s : { ...s,
      promiseTeam50: p.teamId, promiseTrust50: Math.max(-3, Math.min(3, (s.promiseTeam50 === p.teamId ? s.promiseTrust50 ?? 0 : 0) + (status === 'kept' ? 1 : -1))),
      morale: s.morale ? { ...s.morale, score: Math.max(0, Math.min(100, s.morale.score + (status === 'kept' ? 8 : -12))), ...(status === 'broken' && s.promiseTeam50 === p.teamId && (s.promiseTrust50 ?? 0) <= -1 ? { tradeRequest: league.season } : {}) } : s.morale }) });
    return { ...p, games, keptGames, status };
  });
  return league.promises50 ? { ...league, teams, promises50: promises } : league;
}
