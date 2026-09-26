import type { League } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras, TradeProposal } from './gm';
import { executeTrade, validateTrade } from './gm';
import { classifyBuyerSeller, findAITrade, runTradeMarketAI, weakestPositions } from './aiGM';
import { calculateOverall } from './engine/overall';
import { RNG } from './engine/rng';

/*
 * Trade Deadline Day: the game day the deadline falls on becomes an event. The season stops that morning (like the
 * All-Star break) and the day runs on a clock from 9 AM to the 3 PM deadline. Each hour AI teams call you with
 * offers and make deals with each other, rumors heat up or come true, and every trade breaks in the news. When the
 * clock hits 3 PM trading locks; that night's games are the first after the deadline.
 */

export const DEADLINE_OPEN_HOUR = 9;
export const DEADLINE_HOURS = 6; // 9 AM → 3 PM
/** AI-vs-AI deals attempted in each hour (index = the hour just reached): the action builds toward the deadline. */
const FLURRY = [0, 1, 1, 1, 1, 2, 2];
/** Chance an AI team phones you in each hour. */
const CALL_CHANCE = [0.9, 0.55, 0.55, 0.6, 0.65, 0.75, 0.5];
const MAX_OPEN_CALLS = 3;
const BLOCKBUSTER_OVERALL = 72; // the same bar executeTrade uses for a notable deal
/** Chance each hour that a hot rumored player's team works the phones for him. */
const TARGET_CHANCE = 0.3;
/** Rumor-driven deals per team per day: a seller moves a piece or two, not the whole roster. */
const MAX_DEALS_PER_TEAM = 2;

export interface DeadlineRumor {
  id: string;
  kind: 'shopping' | 'buying' | 'wants_out' | 'on_block' | 'your_team';
  teamId: string;
  playerId?: string;
  /** 1 = murmur, 2 = gaining steam, 3 = hot. */
  heat: 1 | 2 | 3;
  text: string;
}

/** A trade made during Deadline Day (by anyone), logged by `executeTrade`. */
export interface DeadlineTrade {
  hour: number;
  teamAId: string;
  teamBId: string;
  playersFromA: string[];
  playersFromB: string[];
  picksFromA?: string[];
  picksFromB?: string[];
  /** Best overall among the players moved, when the deal was made. */
  topOverall: number;
}

export interface DeadlineDayState {
  season: string;
  /** The game day the deadline falls on: trading locks before its games. */
  round: number;
  status: 'upcoming' | 'open' | 'closed';
  /** Hours since 9 AM (0 … DEADLINE_HOURS). */
  hour: number;
  rumors: DeadlineRumor[];
  trades: DeadlineTrade[];
  /** AI teams that phoned you, and when. */
  calls: { hour: number; teamId: string }[];
}

export const tradeDeadlineEnabled = (league: League) => league.rulesSettings?.tradeDeadlineEnabled !== false;

/** The round whose games take the league past the deadline share of the schedule (see isTradeDeadlinePassed). */
export function deadlineRound(league: League): number | null {
  if (!tradeDeadlineEnabled(league) || !league.schedule.length) return null;
  const pct = league.settings.tradeDeadlinePct ?? 0.65;
  const perRound = new Map<number, number>();
  for (const g of league.schedule) perRound.set(g.round, (perRound.get(g.round) ?? 0) + 1);
  let played = 0;
  for (const round of [...perRound.keys()].sort((a, b) => a - b)) {
    played += perRound.get(round)!;
    if (played / league.schedule.length >= pct) return round;
  }
  return null;
}

const thisSeason = (league: League) => {
  const d = league.deadlineDay;
  return d && d.season === (league.season ?? '') ? d : undefined;
};
const nextRound = (league: League) => league.schedule.find(g => !g.played)?.round;

/** Game days until the deadline (0 = today is Deadline Day), or null once it has passed or when there is none. */
export function daysToDeadline(league: League): number | null {
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season' && league.seasonPhase !== 'all_star') return null;
  const d = thisSeason(league);
  if (d?.status === 'closed') return null;
  const round = d?.round ?? deadlineRound(league);
  const next = nextRound(league);
  if (round == null || next == null || next > round) return null;
  const rounds = new Set(league.schedule.filter(g => !g.played && g.round < round).map(g => g.round));
  return rounds.size;
}

/**
 * Puts this season's Deadline Day on the calendar for a league where you run a team. The season then stops on the
 * deadline's game day until the day is played (see `isDeadlineDayBlocking`). Leagues without a controlled team,
 * with the deadline turned off, or already past it are left alone.
 */
export function scheduleDeadlineDay(league: League, controlledTeamId: string | null): League {
  if (!controlledTeamId || (league.seasonPhase ?? 'regular_season') !== 'regular_season' || thisSeason(league)) return league;
  const round = deadlineRound(league);
  const next = nextRound(league);
  if (round == null || next == null || next > round) return league;
  return { ...league, deadlineDay: { season: league.season ?? '', round, status: 'upcoming', hour: 0, rumors: [], trades: [], calls: [] } };
}

/** True while this season's Deadline Day is scheduled or under way and the calendar has reached it. */
export function isDeadlineDayBlocking(league: League): boolean {
  const d = thisSeason(league);
  if (!d || d.status === 'closed' || !tradeDeadlineEnabled(league)) return false;
  const next = nextRound(league);
  return next != null && next >= d.round;
}
/** The season has reached Deadline Day and it hasn't started yet. */
export const isDeadlineDayDue = (league: League) => isDeadlineDayBlocking(league) && thisSeason(league)!.status === 'upcoming';
export const isDeadlineDayOpen = (league: League) => thisSeason(league)?.status === 'open';
/** Trading locked for the season: the deadline passed on the clock. */
export const isDeadlineDayClosed = (league: League) => thisSeason(league)?.status === 'closed';

export function deadlineClock(hour: number): string {
  const h = DEADLINE_OPEN_HOUR + hour;
  return `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;
}

function heatOf(overall: number): 1 | 2 | 3 {
  return overall >= 78 ? 3 : overall >= 70 ? 2 : 1;
}
const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const POSITION_NAME: Record<string, string> = { PG: 'point guard', SG: 'shooting guard', SF: 'wing', PF: 'forward', C: 'big man' };

/** The morning's rumor mill, built from where every team stands. */
export function buildRumors(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number): DeadlineRumor[] {
  const rng = new RNG(seed);
  const pick = <T,>(options: T[]) => options[rng.nextInt(options.length)];
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r]));
  const rumors: DeadlineRumor[] = [];
  const seenPlayers = new Set<string>();

  // Players who asked out come first: everyone knows.
  for (const team of league.teams) {
    for (const p of team.seasons) {
      if (p.morale?.tradeRequest !== league.season) continue;
      seenPlayers.add(p.playerId);
      rumors.push({ id: `out:${p.playerId}`, kind: 'wants_out', teamId: team.teamId, playerId: p.playerId, heat: 3,
        text: pick([`${p.playerId} wants out of ${team.name}, and teams are lining up.`, `${p.playerId}'s camp is pushing ${team.name} for a move before 3 PM.`]) });
    }
  }

  const ai = league.teams.filter(t => t.teamId !== controlledTeamId);
  const sellers = ai.filter(t => classifyBuyerSeller(league, extras, t.teamId) === 'seller');
  const buyers = ai.filter(t => classifyBuyerSeller(league, extras, t.teamId) === 'buyer');

  const shopping = sellers.map(team => {
    const vet = [...team.seasons].filter(s => s.age >= 29 && !seenPlayers.has(s.playerId)).sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    return vet ? { team, vet, ovr: calculateOverall(vet) } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
  for (const { team, vet, ovr } of shopping) {
    seenPlayers.add(vet.playerId);
    const expiring = extras.contracts[vet.playerId]?.yearsRemaining === 1;
    rumors.push({ id: `shop:${vet.playerId}`, kind: 'shopping', teamId: team.teamId, playerId: vet.playerId, heat: heatOf(ovr),
      text: pick([
        `${team.name} are taking calls on ${vet.playerId}${expiring ? ', whose deal runs out this summer' : ''}.`,
        `Rival executives say ${team.name} would move ${vet.playerId} for young talent and picks.`,
        `${vet.playerId} (${vet.age}) is the name to watch in ${possessive(team.name)} front office today.`,
      ]) });
  }

  const hunting = buyers.sort((a, b) => (standings.get(b.teamId)?.winPct ?? 0) - (standings.get(a.teamId)?.winPct ?? 0)).slice(0, 3);
  for (const team of hunting) {
    const need = weakestPositions(team)[0];
    const row = standings.get(team.teamId);
    rumors.push({ id: `buy:${team.teamId}`, kind: 'buying', teamId: team.teamId, heat: row && row.winPct >= 0.62 ? 2 : 1,
      text: pick([
        `${team.name}${row ? ` (${row.wins}-${row.losses})` : ''} want another ${POSITION_NAME[need] ?? 'rotation player'} for the playoff push.`,
        `${team.name} are said to be aggressive buyers, hunting for a ${POSITION_NAME[need] ?? 'rotation player'}.`,
      ]) });
  }

  for (const id of extras.tradeBlock) {
    if (seenPlayers.has(id)) continue;
    const team = ai.find(t => t.seasons.some(s => s.playerId === id));
    if (!team) continue;
    const p = team.seasons.find(s => s.playerId === id)!;
    seenPlayers.add(id);
    rumors.push({ id: `block:${id}`, kind: 'on_block', teamId: team.teamId, playerId: id, heat: heatOf(calculateOverall(p)) === 3 ? 2 : 1,
      text: `${team.name} have made ${id} available.` });
  }

  const mine = controlledTeamId ? league.teams.find(t => t.teamId === controlledTeamId) : undefined;
  if (mine) {
    const lane = classifyBuyerSeller(league, extras, mine.teamId);
    rumors.push({ id: `you:${mine.teamId}`, kind: 'your_team', teamId: mine.teamId, heat: 1,
      text: lane === 'buyer' ? `Around the league, ${mine.name} are seen as buyers. Expect sellers to call.`
        : lane === 'seller' ? `Contenders expect ${mine.name} to sell. Your veterans will draw calls.`
        : `Nobody is sure whether ${mine.name} will buy or sell, so both kinds of teams may call.` });
    const onBlock = mine.seasons.filter(s => extras.tradeBlock.includes(s.playerId)).sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    if (onBlock) rumors.push({ id: `you-block:${onBlock.playerId}`, kind: 'your_team', teamId: mine.teamId, playerId: onBlock.playerId, heat: 2,
      text: `${onBlock.playerId} is on your trade block, and scouts from several teams have been at your games.` });
  }

  return rumors.sort((a, b) => b.heat - a.heat).slice(0, 10);
}

/** An AI team phones you with an offer. Contenders call to buy your veterans; rebuilding teams call to sell theirs. */
export function deadlineCall(league: League, extras: GMLeagueExtras, controlledTeamId: string, seed: number): TradeProposal | null {
  const rng = new RNG(seed);
  const calling = new Set(extras.pendingTradeOffers.flatMap(o => [o.teamAId, o.teamBId]));
  const partners = league.teams.map(t => t.teamId).filter(id => id !== controlledTeamId && !calling.has(id))
    .map(id => ({ id, r: rng.next() })).sort((a, b) => a.r - b.r).map(x => x.id);
  const mine = classifyBuyerSeller(league, extras, controlledTeamId);
  for (const partnerId of partners) {
    const theirs = classifyBuyerSeller(league, extras, partnerId);
    const seller = theirs === 'seller' && mine !== 'seller' ? partnerId
      : theirs === 'buyer' && mine !== 'buyer' ? controlledTeamId
      : null;
    if (!seller) continue;
    const proposal = findAITrade(league, extras, partnerId, controlledTeamId, seller);
    if (proposal && validateTrade(league, extras, proposal).valid) return proposal;
  }
  return null;
}

export interface DeadlineHourResult {
  league: League;
  extras: GMLeagueExtras;
  /** New AI-vs-AI deals this hour. */
  trades: DeadlineTrade[];
  /** Team that phoned you this hour, if any. */
  call: string | null;
}

function withDeadline(league: League, patch: Partial<DeadlineDayState>): League {
  return { ...league, deadlineDay: { ...league.deadlineDay!, ...patch } };
}

/** Calls that no longer work (a player in them has moved, or the money no longer fits) drop off your phone. */
export function pruneOffers(league: League, extras: GMLeagueExtras): GMLeagueExtras {
  const live = extras.pendingTradeOffers.filter(o => validateTrade(league, extras, o).valid);
  return live.length === extras.pendingTradeOffers.length ? extras : { ...extras, pendingTradeOffers: live };
}

/** Deadline Day begins at 9 AM: the rumor mill and the first phone call. */
export function openDeadlineDay(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number): DeadlineHourResult {
  if (!isDeadlineDayDue(league)) return { league, extras, trades: [], call: null };
  const opened = withDeadline(league, { status: 'open', hour: 0, rumors: buildRumors(league, extras, controlledTeamId, seed), trades: [], calls: [] });
  return phoneCall(opened, extras, controlledTeamId, seed + 7, 0);
}

function phoneCall(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number, hour: number): DeadlineHourResult {
  const d = league.deadlineDay!;
  const open = controlledTeamId ? extras.pendingTradeOffers.filter(o => o.teamAId === controlledTeamId || o.teamBId === controlledTeamId).length : 0;
  if (!controlledTeamId || open >= MAX_OPEN_CALLS || new RNG(seed).next() >= CALL_CHANCE[hour]) return { league, extras, trades: [], call: null };
  const offer = deadlineCall(league, extras, controlledTeamId, seed + 1);
  if (!offer) return { league, extras, trades: [], call: null };
  const partner = offer.teamAId === controlledTeamId ? offer.teamBId : offer.teamAId;
  return {
    league: withDeadline(league, { calls: [...d.calls, { hour, teamId: partner }] }),
    extras: { ...extras, pendingTradeOffers: [...extras.pendingTradeOffers, offer] },
    trades: [], call: partner,
  };
}

/**
 * Moves the clock forward one hour: AI teams trade with each other (more often as 3 PM nears) and may call you.
 * At 3 PM the deadline passes: trading locks and any offers still on the table expire.
 */
export function advanceDeadlineHour(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number): DeadlineHourResult {
  const d = thisSeason(league);
  if (!d || d.status !== 'open') return { league, extras, trades: [], call: null };
  const hour = Math.min(DEADLINE_HOURS, d.hour + 1);
  let current = withDeadline(league, { hour });
  const before = current.deadlineDay!.trades.length;
  // Trades are logged into deadlineDay.trades by executeTrade, stamped with the hour set above.
  const market = deadlineMarket(current, extras, controlledTeamId, seed + hour * 101, FLURRY[hour]);
  current = market.league;
  let nextExtras = market.extras;
  const trades = current.deadlineDay!.trades.slice(before);
  let call: string | null = null;
  if (hour < DEADLINE_HOURS) {
    nextExtras = pruneOffers(current, nextExtras);
    const rang = phoneCall(current, nextExtras, controlledTeamId, seed + hour * 131, hour);
    current = rang.league; nextExtras = rang.extras; call = rang.call;
  } else {
    current = withDeadline(current, { status: 'closed' });
    nextExtras = { ...nextExtras, pendingTradeOffers: [] }; // unanswered calls expire with the deadline
  }
  return { league: current, extras: nextExtras, trades, call };
}

/**
 * One hour of AI-vs-AI dealing. The teams in the rumor mill talk first (a rumored seller and a rumored buyer), so
 * rumors tend to come true; any deals left in the hour go to the regular trade market.
 */
function deadlineMarket(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number, maxTrades: number): { league: League; extras: GMLeagueExtras } {
  if (maxTrades <= 0) return { league, extras };
  const rng = new RNG(seed);
  const rumors = league.deadlineDay!.rumors;
  const unique = (ids: string[]) => [...new Set(ids)].filter(id => id !== controlledTeamId);
  const sellers = unique(rumors.filter(r => r.kind === 'shopping' || r.kind === 'wants_out' || r.kind === 'on_block').map(r => r.teamId));
  const buyers = unique(rumors.filter(r => r.kind === 'buying').map(r => r.teamId));
  const pairs = sellers.flatMap(s => buyers.filter(b => b !== s).map(b => ({ s, b, r: rng.next() }))).sort((x, y) => x.r - y.r);
  let current = league, currentExtras = extras, made = 0;
  const deals = (id: string) => current.deadlineDay!.trades.filter(t => t.teamAId === id || t.teamBId === id).length;
  const tryDeal = (seller: string, buyer: string, target?: string) => {
    const proposal = findAITrade(current, currentExtras, seller, buyer, seller, target);
    if (!proposal || !validateTrade(current, currentExtras, proposal).valid) return false;
    ({ league: current, extras: currentExtras } = executeTrade(current, currentExtras, proposal));
    made++;
    return true;
  };
  // The hottest names first: a player who asked out, or a seller's best veteran, can headline the day.
  const targets = rumors.filter(r => r.playerId && r.heat >= 2 && r.teamId !== controlledTeamId && (r.kind === 'wants_out' || r.kind === 'shopping'));
  for (const r of targets) {
    if (made >= maxTrades) break;
    if (rng.next() >= TARGET_CHANCE || deals(r.teamId) >= MAX_DEALS_PER_TEAM) continue;
    if (!current.teams.find(t => t.teamId === r.teamId)?.seasons.some(s => s.playerId === r.playerId)) continue; // already moved
    const suitors = buyers.filter(b => b !== r.teamId && deals(b) < MAX_DEALS_PER_TEAM).map(b => ({ b, k: rng.next() })).sort((x, y) => x.k - y.k);
    for (const { b } of suitors) if (tryDeal(r.teamId, b, r.playerId)) break;
  }
  for (const { s, b } of pairs) {
    if (made >= maxTrades) break;
    if (rng.next() < 0.5 || deals(s) >= MAX_DEALS_PER_TEAM || deals(b) >= MAX_DEALS_PER_TEAM) continue; // not every pair talks every hour
    tryDeal(s, b);
  }
  if (made >= maxTrades) return { league: current, extras: currentExtras };
  const market = runTradeMarketAI(current, currentExtras, controlledTeamId, seed + 1, maxTrades - made);
  return { league: market.league, extras: market.extras };
}

/** Plays the rest of the day to the 3 PM deadline. */
export function runToDeadline(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number): DeadlineHourResult {
  let result: DeadlineHourResult = { league, extras, trades: [], call: null };
  const trades: DeadlineTrade[] = [];
  for (let guard = 0; guard <= DEADLINE_HOURS && isDeadlineDayOpen(result.league); guard++) {
    result = advanceDeadlineHour(result.league, result.extras, controlledTeamId, seed);
    trades.push(...result.trades);
  }
  return { ...result, trades };
}

/** Logs a trade into Deadline Day when it happens during the day. Called from executeTrade. */
export function logDeadlineTrade(league: League, proposal: TradeProposal, topOverall: number): League {
  const d = thisSeason(league);
  if (!d || d.status !== 'open') return league;
  const trade: DeadlineTrade = {
    hour: d.hour, teamAId: proposal.teamAId, teamBId: proposal.teamBId,
    playersFromA: [...proposal.playersFromA], playersFromB: [...proposal.playersFromB],
    ...(proposal.picksFromA?.length ? { picksFromA: [...proposal.picksFromA] } : {}),
    ...(proposal.picksFromB?.length ? { picksFromB: [...proposal.picksFromB] } : {}),
    topOverall,
  };
  return withDeadline(league, { trades: [...d.trades, trade] });
}

export const isBlockbuster = (trade: DeadlineTrade) => trade.topOverall >= BLOCKBUSTER_OVERALL;

/** "A send X and a 2027 first to B for Y" */
export function describeDeadlineTrade(trade: DeadlineTrade, teamName: (id: string) => string): string {
  const assets = (players: string[], picks?: string[]) => {
    const list = [...players, ...(picks ?? []).map(pickName)];
    return list.length ? joinList(list) : 'future considerations';
  };
  return `${teamName(trade.teamAId)} send ${assets(trade.playersFromA, trade.picksFromA)} to ${teamName(trade.teamBId)} for ${assets(trade.playersFromB, trade.picksFromB)}`;
}
function pickName(id: string): string {
  const m = /^(\d{4})-R([12])-/.exec(id);
  return m ? `a ${m[1]} ${m[2] === '1' ? 'first' : 'second'}` : 'a draft pick';
}
function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** Whether a rumor came true today, and how. */
export function rumorOutcome(rumor: DeadlineRumor, trades: DeadlineTrade[], teamName: (id: string) => string): string | null {
  if (rumor.playerId) {
    const t = trades.find(x => x.playersFromA.includes(rumor.playerId!) || x.playersFromB.includes(rumor.playerId!));
    if (t) return `Dealt to ${teamName(t.playersFromA.includes(rumor.playerId) ? t.teamBId : t.teamAId)} at ${deadlineClock(t.hour)}`;
    return null;
  }
  if (rumor.kind === 'buying') {
    const t = trades.find(x => x.teamAId === rumor.teamId || x.teamBId === rumor.teamId);
    if (t) return `Landed ${joinList(t.teamAId === rumor.teamId ? t.playersFromB : t.playersFromA) || 'a pick'} at ${deadlineClock(t.hour)}`;
  }
  return null;
}

/** Deadline Day news for the feed: every deal as it broke, and the recap once the deadline passed. `order` is relative to the day. */
export interface DeadlineNewsItem { id: string; teamId: string | null; headline: string; detail?: string; order: number; big: boolean }
export function deadlineNews(league: League): DeadlineNewsItem[] {
  const d = league.deadlineDay;
  if (!d || d.status === 'upcoming') return [];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const items: DeadlineNewsItem[] = d.trades.map((t, i) => ({
    id: `deadline:${i}`, teamId: t.teamAId,
    headline: `${isBlockbuster(t) ? 'BLOCKBUSTER' : 'DEADLINE DEAL'}: ${describeDeadlineTrade(t, name)}.`,
    detail: `Broke at ${deadlineClock(t.hour)} on Deadline Day.`, order: i * 0.001, big: isBlockbuster(t),
  }));
  if (d.status === 'closed') {
    const big = d.trades.filter(isBlockbuster).length;
    items.push({ id: 'deadline:recap', teamId: null,
      headline: d.trades.length ? `The trade deadline has passed: ${d.trades.length} deal${d.trades.length === 1 ? '' : 's'} on Deadline Day${big ? `, ${big} of them blockbusters` : ''}.` : 'The trade deadline passed quietly: no deals on Deadline Day.',
      detail: 'Rosters are locked until the season ends.', order: 0.2, big: false });
  }
  return items;
}
