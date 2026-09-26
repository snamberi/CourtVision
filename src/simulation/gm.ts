import { formatSeasonYear } from './calendar';
import { withGrudge } from './personality';
import { recordRivalryTrade } from './rivalry';
import { closeStint } from './stints';
import { packageValue, pickAssetValue, teamDirection, tradeAssetValue, type TeamDirection } from './tradeValue';
import { compressElitePotential } from './engine/potential';
import type { PlayerId, PlayerSeason, TeamId } from './types';
import type { League, LeagueTeam } from './league';
import { simulateFullRound } from './league';
import { RNG } from './engine/rng';
import { generatePlayer } from './leagueGenerator';
import { computeStandings } from './league';
import { calculateOverall } from './engine/overall';
import { generatePlayerOrigin } from './names';
import { collectPlayerIds, withUniquePlayerId } from './playerIds';
import { appendHistoryEvent } from './playerHistory';
import { isDeadlineDayClosed, logDeadlineTrade, tradeDeadlineEnabled } from './deadlineDay';

// ---- Contracts ----
export interface Contract {
  playerId: PlayerId;
  teamId: TeamId;
  annualSalary: number;
  yearsRemaining: number;
  playerOption: boolean;
  teamOption: boolean;
}

export interface SalaryCapSettings {
  salaryCap: number;
  luxuryTaxLine: number;
  luxuryTaxMultiplier: number; // penalty rate applied to payroll above the luxury tax line (display/GM-flavor for now)
  hardCapEnabled: boolean; // when true, a team can never exceed the cap at all (even via trades), overriding luxuryTaxLine as ceiling
  enforceCapOnTrades: boolean; // sandbox mode can disable this to allow "invalid" trades
  minSalary: number; // league-minimum contract, offered to any free agent regardless of quality
  maxSalaryPctOfCap: number; // a true max contract is this fraction of the cap
  minRosterSize: number; // a team below this must sign someone before it can waive anyone else
  maxRosterSize: number; // a team at this cap cannot sign or trade for another player
}

export const DEFAULT_CAP_SETTINGS: SalaryCapSettings = {
  salaryCap: 140_000_000,
  luxuryTaxLine: 170_000_000,
  luxuryTaxMultiplier: 1.5,
  hardCapEnabled: false,
  enforceCapOnTrades: true,
  minSalary: 1_150_000,
  maxSalaryPctOfCap: 0.30,
  minRosterSize: 10,
  maxRosterSize: 18,
};

/** Whether this team has room to add another player under the league's roster-size rules. */
export function hasRosterRoom(team: LeagueTeam, cap: SalaryCapSettings): boolean {
  return team.seasons.length < cap.maxRosterSize;
}

/** Whether this team can afford to lose a player without dropping below the roster minimum. */
export function canDropPlayer(team: LeagueTeam, cap: SalaryCapSettings): boolean {
  return team.seasons.length > cap.minRosterSize;
}

// ---- Trade difficulty (spec-inspired: young high-potential players are harder to trade for) ----
export type TradeDifficulty = 'easy' | 'normal' | 'hard';

export interface TradeSettings {
  difficulty: TradeDifficulty;
  showValues?: boolean;
}

export const DEFAULT_TRADE_SETTINGS: TradeSettings = { difficulty: 'normal', showValues: false };

/** Convenience defaults for the new calendar/trade-block flags, spread into any GMLeagueExtras literal. */
export const DEFAULT_GM_FLAGS = {
  draftDayOpen: false, freeAgencyOpen: false, tradeBlock: [] as string[],
  draftPickIndex: 0, pendingTradeOffers: [] as TradeProposal[], freeAgencyDaysRemaining: 0,
};


/**
 * Basketball trade value combining current ability, age, and upside. Younger
 * players with a large gap between current Overall and Potential carry a
 * "youth premium" — the same overall rating is worth noticeably more at 21
 * than at 33, which is what makes trading for young high-potential players
 * harder than trading for veterans of similar current ability.
 */
export function computeTradeValue(season: PlayerSeason): number {
  const overall = calculateOverall(season);
  const potentialGap = Math.max(0, season.development.potential - overall);

  let youthMultiplier: number;
  if (season.age <= 22) youthMultiplier = 1.6;
  else if (season.age <= 27) youthMultiplier = 1.15;
  else if (season.age <= 31) youthMultiplier = 0.85;
  else youthMultiplier = 0.55;

  const upsidePremium = potentialGap * youthMultiplier * 0.8;
  return overall + upsidePremium;
}

export interface GMLeagueExtras {
  contracts: Record<PlayerId, Contract>;
  freeAgents: PlayerSeason[];
  capSettings: SalaryCapSettings;
  draftClass: DraftProspect[];
  tradeSettings: TradeSettings;
  draftDayOpen: boolean; // drafting is only allowed while true (spec-inspired: "Draft Day" is an event, not anytime)
  freeAgencyOpen: boolean; // signing free agents only allowed while true
  tradeBlock: PlayerId[]; // players any team has marked as available for trade discussion
  draftPickIndex: number; // whose turn it is in the draft order, incremented on every successful pick (by anyone)
  pendingTradeOffers: TradeProposal[]; // AI-generated offers targeting the controlled team, awaiting accept/decline
  freeAgencyDaysRemaining: number; // counts down during the 30-day free agency window in the season-flow lifecycle; 0 when not in that window
  teamPersonalities?: Record<TeamId, 'aggressive' | 'conservative' | 'balanced'>; // AI front-office archetype per team; absent teams default to 'balanced'
  draftOrder?: TeamId[]; // this draft's determined pick order (post-lottery), set once when the draft class is generated
  draftPicksMade?: { pickNumber: number; teamId: string; playerId: string }[]; // history of this draft's picks so far, most recent last
  watchList?: PlayerId[]; // players the user is tracking (trade targets, prospects, rivals), independent of roster
  futurePicks?: FutureDraftPick[]; // tradeable draft-pick futures ledger (this year + several years out), see below
  picksOnBlock?: string[]; // FutureDraftPick ids any team has marked as available for trade discussion
  draftWorkouts?: Record<TeamId, PlayerId[]>; // pre-draft workout invites per team (see scouting.ts); stale ids are ignored
  /** This offseason's contract talks with agents, keyed `${teamId}|${playerId}` (see agents.ts). */
  negotiations?: Record<string, import('./agents').Negotiation>;
}

// ---- Draft pick trading (futures ledger) ----

/** A single round of a single future draft year, as a tradeable asset. Independent of `draftOrder`, which is only the CURRENT draft's already-resolved pick sequence. */
export interface FutureDraftPick {
  id: string; // `${year}-R${round}-${originalTeamId}`, stable and unique
  year: number;
  round: 1 | 2;
  originalTeamId: TeamId; // whichever team's record actually determines where this pick lands
  currentOwnerTeamId: TeamId; // who gets to use it (or trade it again) - starts equal to originalTeamId
  protection: PickProtection | null;
}

/** "Top-N protected": if the original team's own record would land the pick within the top N of its round, the pick stays home this year instead of conveying, and the trade partner gets nothing for it that year (a real common NBA deal term). */
export interface PickProtection {
  topN: number;
  label: string;
}

export const PICK_PROTECTION_OPTIONS: PickProtection[] = [
  { topN: 4, label: 'Top-4 Protected' },
  { topN: 8, label: 'Top-8 Protected' },
  { topN: 10, label: 'Top-10 Protected' },
  { topN: 14, label: 'Lottery Protected (Top-14)' },
];

/** How many draft years ahead of the current one stay tradeable at once - matches real front-office practice (you can't trade picks indefinitely far out). */
export const FUTURE_PICK_WINDOW_YEARS = 5;

/** Builds a fresh ledger of tradeable future picks: 2 rounds x every team x `yearsAhead` draft years, all starting with their original owner. */
export function generateFutureDraftPicks(teamIds: TeamId[], startYear: number, yearsAhead = FUTURE_PICK_WINDOW_YEARS): FutureDraftPick[] {
  const picks: FutureDraftPick[] = [];
  for (let i = 0; i < yearsAhead; i++) {
    const year = startYear + i;
    for (const teamId of teamIds) {
      for (const round of [1, 2] as const) {
        picks.push({ id: `${year}-R${round}-${teamId}`, year, round, originalTeamId: teamId, currentOwnerTeamId: teamId, protection: null });
      }
    }
  }
  return picks;
}

/** Picks a given team currently has the right to trade away (whether originally theirs or already acquired from someone else). */
export function tradeableFuturePicks(extras: GMLeagueExtras, teamId: TeamId): FutureDraftPick[] {
  return (extras.futurePicks ?? []).filter((p) => p.currentOwnerTeamId === teamId);
}

/** Only the team that still owns its OWN original pick can attach protection to it when trading it away (matches real practice - you protect your own unresolved pick, not one you already acquired from someone else). */
export function canProtectPick(pick: FutureDraftPick): boolean {
  return pick.currentOwnerTeamId === pick.originalTeamId;
}

export function setPickProtection(extras: GMLeagueExtras, pickId: string, protection: PickProtection | null): GMLeagueExtras {
  return { ...extras, futurePicks: (extras.futurePicks ?? []).map((p) => (p.id === pickId ? { ...p, protection } : p)) };
}

export function togglePickOnBlock(extras: GMLeagueExtras, pickId: string): GMLeagueExtras {
  const onBlock = extras.picksOnBlock ?? [];
  return { ...extras, picksOnBlock: onBlock.includes(pickId) ? onBlock.filter((id) => id !== pickId) : [...onBlock, pickId] };
}

/**
 * Rough tradeable value of a future pick, years before its actual draft slot is known. Uses the
 * original team's CURRENT record as the best available proxy for how good/bad the pick will be,
 * discounted further out (more uncertainty), with protection reducing the receiving team's expected return.
 */
export function computeFutureDraftPickValue(pick: FutureDraftPick, league: League, currentYear: number): number {
  const winPct = computeStandings(league).find((r) => r.teamId === pick.originalTeamId)?.winPct ?? 0.5;
  const situationalMultiplier = 1.3 - winPct * 0.6; // worst team now -> 1.3x, best team now -> 0.7x
  const base = pick.round === 1 ? 65 : 22; // treat as a roughly-average slot in its round since the exact position is still unknown
  const yearsOut = Math.max(0, pick.year - currentYear);
  const uncertaintyDiscount = Math.max(0.4, 1 - yearsOut * 0.12); // further out = worth less, floors at 40%
  const protectionPremium = pick.protection ? Math.max(0.45, 1 - pick.protection.topN * 0.035) : 1;
  return Math.round(base * situationalMultiplier * uncertaintyDiscount * protectionPremium);
}

/**
 * Reconciles a freshly built standings-order draft order (each slot nominally belonging to
 * whichever team earned that record) with the futures ledger: any slot whose pick has been
 * traded away gets swapped to its current owner, unless protection is set and the original
 * team's actual slot falls inside the protected range - in which case the pick stays home this
 * year (the trade partner gets nothing for it this cycle) and that's reported back so the season
 * summary can mention it.
 */
export function resolveTradedPicksIntoOrder(
  order: TeamId[], // length 2*teamCount; index < teamCount = round 1, the rest = round 2
  year: number,
  futurePicks: FutureDraftPick[],
): { order: TeamId[]; protectionsTriggered: { originalTeamId: TeamId; round: 1 | 2 }[] } {
  const teamCount = order.length / 2;
  const resolved = [...order];
  const protectionsTriggered: { originalTeamId: TeamId; round: 1 | 2 }[] = [];
  for (let i = 0; i < resolved.length; i++) {
    const round: 1 | 2 = i < teamCount ? 1 : 2;
    const rank = (i % teamCount) + 1; // 1-indexed slot within its round
    const originalTeamId = resolved[i];
    const pick = futurePicks.find((p) => p.year === year && p.round === round && p.originalTeamId === originalTeamId);
    if (!pick || pick.currentOwnerTeamId === originalTeamId) continue; // never traded - nothing to resolve
    if (pick.protection && rank <= pick.protection.topN) {
      protectionsTriggered.push({ originalTeamId, round });
      continue; // protection triggered: stays with the original team this year
    }
    resolved[i] = pick.currentOwnerTeamId;
  }
  return { order: resolved, protectionsTriggered };
}

/** Called once a draft year's order has been resolved: that year is done (no longer tradeable), so drop it and extend the ledger with a fresh year so the trading window stays a constant length. */
export function rollFutureDraftPicksForward(
  futurePicks: FutureDraftPick[],
  teamIds: TeamId[],
  resolvedYear: number,
  yearsAhead = FUTURE_PICK_WINDOW_YEARS,
): FutureDraftPick[] {
  const remaining = futurePicks.filter((p) => p.year !== resolvedYear);
  const newYear = resolvedYear + yearsAhead;
  if (remaining.some((p) => p.year === newYear)) return remaining;
  return [...remaining, ...generateFutureDraftPicks(teamIds, newYear, 1)];
}

export function teamPayroll(contracts: Record<PlayerId, Contract>, team: LeagueTeam): number {
  return team.seasons.reduce((sum, s) => sum + (contracts[s.playerId]?.annualSalary ?? 0), 0);
}

export function capSpaceRemaining(contracts: Record<PlayerId, Contract>, team: LeagueTeam, cap: SalaryCapSettings): number {
  return cap.salaryCap - teamPayroll(contracts, team);
}

// ---- Trades ----
export interface TradeProposal {
  teamAId: TeamId;
  teamBId: TeamId;
  playersFromA: PlayerId[];
  playersFromB: PlayerId[];
  picksFromA?: string[]; // FutureDraftPick ids
  picksFromB?: string[];
  currentPicksFromA?: number[]; // zero-based slots in the open draft
  currentPicksFromB?: number[];
}

export interface TradeValidation {
  valid: boolean;
  reasons: string[];
}

/**
 * Roughly proportional to season completion; defaults to true once ~65% of the schedule has been played, tunable via
 * league.settings.tradeDeadlinePct. Also true once this season's Deadline Day clock has hit 3 PM, and never when the
 * league rules turn the deadline off.
 */
export function isTradeDeadlinePassed(league: League): boolean {
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season' || league.schedule.length === 0 || !tradeDeadlineEnabled(league)) return false;
  if (isDeadlineDayClosed(league)) return true;
  const threshold = league.settings.tradeDeadlinePct ?? 0.65;
  const played = league.schedule.filter((g) => g.played).length;
  return played / league.schedule.length >= threshold;
}

/** Simulates games in schedule order until the trade deadline threshold is hit (or the season runs out first). */
export function simulateUntilTradeDeadline(league: League, seedBase = 1): League {
  let current = league;
  while (current.schedule.some((g) => !g.played) && !isTradeDeadlinePassed(current)) {
    const next = simulateFullRound(current, seedBase);
    if (next === current) break; // blocked (All-Star break pending) - stop instead of spinning forever
    current = next;
  }
  return current;
}

/** In single-team-controlled modes, only the controlled team's GM actions are allowed. Sandbox/no-controlled-team play allows everything. */
export function canManageTeam(controlledTeamId: string | null, teamId: string): boolean {
  return controlledTeamId == null || controlledTeamId === teamId;
}

/**
 * Validates a trade against basic real-world constraints (both teams roster the
 * players they're sending, incoming salary roughly matches outgoing salary within
 * a 25% band when cap enforcement is on). Sandbox mode / enforceCapOnTrades=false
 * allows the user to force through an "invalid" trade if they want to experiment.
 */
export function validateTradeAssets(league: League, extras: GMLeagueExtras, proposal: TradeProposal): TradeValidation {
  const reasons: string[] = [];
  const a = league.teams.find(t => t.teamId === proposal.teamAId);
  const b = league.teams.find(t => t.teamId === proposal.teamBId);
  if (!a || !b || a === b) return { valid: false, reasons: ['Choose two different teams.'] };
  const order = currentDraftOrder(league, extras);
  for (const [team, players, futures, slots] of [
    [a, proposal.playersFromA, proposal.picksFromA ?? [], proposal.currentPicksFromA ?? []],
    [b, proposal.playersFromB, proposal.picksFromB ?? [], proposal.currentPicksFromB ?? []],
  ] as const) {
    if (!players.length && !futures.length && !slots.length) reasons.push(`${team.name} must include something in the deal to avoid a value mismatch.`);
    if ([players, futures, slots].some(ids => new Set<string | number>(ids).size !== ids.length)) reasons.push('An asset cannot be offered twice.');
    if (players.some(id => !team.seasons.some(p => p.playerId === id))) reasons.push(`${team.name} no longer owns an offered player.`);
    if (futures.some(id => !extras.futurePicks?.some(p => p.id === id && p.currentOwnerTeamId === team.teamId))) reasons.push(`${team.name} does not currently own an offered future pick.`);
    if (slots.some(slot => !extras.draftDayOpen || !Number.isInteger(slot) || slot < extras.draftPickIndex || slot >= order.length || order[slot] !== team.teamId || extras.draftPicksMade?.some(p => p.pickNumber === slot))) reasons.push(`${team.name} cannot trade a used or unowned draft pick.`);
  }
  return { valid: reasons.length === 0, reasons };
}

export function tradePackageValue(league: League, extras: GMLeagueExtras, teamId: string, players: string[], futures: string[] = [], slots: number[] = []): number {
  const team = league.teams.find(t => t.teamId === teamId);
  const year = parseInt((league.season ?? '2026').slice(0, 4), 10);
  return players.reduce((total, id) => { const p = team?.seasons.find(s => s.playerId === id); return total + (p ? computeTradeValue(p) : 0); }, 0)
    + futures.reduce((total, id) => { const p = extras.futurePicks?.find(s => s.id === id); return total + (p ? computeFutureDraftPickValue(p, league, year) : 0); }, 0)
    + slots.reduce((total, slot) => total + computeDraftPickValue(slot, currentDraftOrder(league, extras), league), 0);
}

export function validateTrade(league: League, extras: GMLeagueExtras, proposal: TradeProposal): TradeValidation {
  const assets = validateTradeAssets(league, extras, proposal);
  if (!league.teams.some(t => t.teamId === proposal.teamAId) || !league.teams.some(t => t.teamId === proposal.teamBId) || proposal.teamAId === proposal.teamBId) return assets;
  const reasons: string[] = [...assets.reasons];
  const a = league.teams.find(t => t.teamId === proposal.teamAId)!;
  const b = league.teams.find(t => t.teamId === proposal.teamBId)!;
  if (isTradeDeadlinePassed(league)) reasons.push('The trade deadline has passed for this season.');
  for (const [team, outgoing, incoming] of [[a, proposal.playersFromA, proposal.playersFromB], [b, proposal.playersFromB, proposal.playersFromA]] as const) {
    const count = team.seasons.length - outgoing.length + incoming.length;
    // Offseason transactions may temporarily cross the roster limits. Coaches trim/fill before games.
    if ((league.seasonPhase ?? 'regular_season') === 'regular_season' && incoming.length !== outgoing.length) {
      if (count < extras.capSettings.minRosterSize && count < team.seasons.length) reasons.push(`${team.name} would fall below the ${extras.capSettings.minRosterSize}-player minimum.`);
      if (count > extras.capSettings.maxRosterSize && count > team.seasons.length) reasons.push(`${team.name} would be above the ${extras.capSettings.maxRosterSize}-player maximum.`);
    }
    const salaryOut = outgoing.reduce((sum, id) => sum + (extras.contracts[id]?.annualSalary ?? 0), 0);
    const salaryIn = incoming.reduce((sum, id) => sum + (extras.contracts[id]?.annualSalary ?? 0), 0);
    const payroll = teamPayroll(extras.contracts, team) - salaryOut + salaryIn;
    if (extras.capSettings.hardCapEnabled && payroll > extras.capSettings.salaryCap && salaryIn > salaryOut) reasons.push(`${team.name} would exceed the hard cap.`);
    else if (extras.capSettings.enforceCapOnTrades && payroll > extras.capSettings.salaryCap && salaryIn > salaryOut * 1.25 + extras.capSettings.minSalary) reasons.push(`${team.name} needs salary matching or cap space for the incoming contracts.`);
  }
  // Each front office judges the deal from its own situation (see tradeValue.ts): win-win trades are possible,
  // but nobody accepts a package worth clearly less to them than what they give up.
  const sides = evaluateTradeSides(league, extras, proposal);
  const tolerance = TRADE_TOLERANCE_BY_DIFFICULTY[extras.tradeSettings.difficulty] ?? 0.12;
  for (const side of [sides.a, sides.b]) {
    if (side.give <= 0 && side.receive <= 0) continue;
    if (side.receive < side.give * (1 - tolerance)) {
      const name = side.teamId === a.teamId ? a.name : b.name;
      reasons.push(`${name} would lose too much value (${side.direction === 'contender' ? 'a contender wants help now' : side.direction === 'rebuilding' ? 'a rebuilding team wants youth and picks' : 'they want a fair return'}). Add a player or a pick for them.${extras.tradeSettings.showValues ? ` Their view: receive ${Math.round(side.receive)} vs give ${Math.round(side.give)}.` : ''}`);
    }
  }
  return { valid: reasons.length === 0, reasons };
}

const TRADE_TOLERANCE_BY_DIFFICULTY: Record<TradeDifficulty, number> = { easy: 0.3, normal: 0.12, hard: 0.04 };
export interface TradeSideView { teamId: string; direction: TeamDirection; give: number; receive: number }
/** Both sides' valuations of a proposal, each from its own team's perspective. */
export function evaluateTradeSides(league: League, extras: GMLeagueExtras, proposal: TradeProposal): { a: TradeSideView; b: TradeSideView } {
  const order = currentDraftOrder(league, extras);
  const year = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const players = (teamId: string, ids: string[]) => ids.map(id => league.teams.find(t => t.teamId === teamId)?.seasons.find(s => s.playerId === id)).filter((p): p is PlayerSeason => !!p);
  const picks = (viewer: string, futures: string[] = [], slots: number[] = []) =>
    futures.reduce((n, id) => { const pk = extras.futurePicks?.find(x => x.id === id); return n + (pk ? pickAssetValue(computeFutureDraftPickValue(pk, league, year), league, viewer) : 0); }, 0)
    + slots.reduce((n, slot) => n + pickAssetValue(computeDraftPickValue(slot, order, league), league, viewer), 0);
  const view = (me: string, other: string, out: string[], inc: string[], outF?: string[], outS?: number[], inF?: string[], inS?: number[]): TradeSideView => ({
    teamId: me, direction: teamDirection(league, me),
    give: players(me, out).reduce((n, p) => n + tradeAssetValue(p, league, extras, me), 0) + picks(me, outF, outS),
    receive: packageValue(players(other, inc).map(p => tradeAssetValue(p, league, extras, me)), out.length) + picks(me, inF, inS),
  });
  return {
    a: view(proposal.teamAId, proposal.teamBId, proposal.playersFromA, proposal.playersFromB, proposal.picksFromA, proposal.currentPicksFromA, proposal.picksFromB, proposal.currentPicksFromB),
    b: view(proposal.teamBId, proposal.teamAId, proposal.playersFromB, proposal.playersFromA, proposal.picksFromB, proposal.currentPicksFromB, proposal.picksFromA, proposal.currentPicksFromA),
  };
}

/** Executes a trade unconditionally — call validateTrade first unless sandbox mode intentionally allows an invalid trade. */
export function executeTrade(league: League, extras: GMLeagueExtras, proposal: TradeProposal): { league: League; extras: GMLeagueExtras } {
  if (!validateTradeAssets(league, extras, proposal).valid) return { league, extras };
  const teamAName = league.teams.find((t) => t.teamId === proposal.teamAId)?.name ?? proposal.teamAId;
  const teamBName = league.teams.find((t) => t.teamId === proposal.teamBId)?.name ?? proposal.teamBId;
  const teams = league.teams.map((t) => {
    if (t.teamId === proposal.teamAId) {
      const remaining = t.seasons.filter((s) => !proposal.playersFromA.includes(s.playerId));
      const incoming = league.teams.find((o) => o.teamId === proposal.teamBId)!.seasons.filter((s) => proposal.playersFromB.includes(s.playerId));
      return { ...t, seasons: [...remaining, ...incoming.map((s) => appendHistoryEvent(withGrudge({ ...closeStint(s, proposal.teamBId), teamId: t.teamId }, proposal.teamBId, league.season), 'traded', `Traded from ${teamBName} to ${teamAName}`, t.teamId))] };
    }
    if (t.teamId === proposal.teamBId) {
      const remaining = t.seasons.filter((s) => !proposal.playersFromB.includes(s.playerId));
      const incoming = league.teams.find((o) => o.teamId === proposal.teamAId)!.seasons.filter((s) => proposal.playersFromA.includes(s.playerId));
      return { ...t, seasons: [...remaining, ...incoming.map((s) => appendHistoryEvent(withGrudge({ ...closeStint(s, proposal.teamAId), teamId: t.teamId }, proposal.teamAId, league.season), 'traded', `Traded from ${teamAName} to ${teamBName}`, t.teamId))] };
    }
    return t;
  });

  const contracts = { ...extras.contracts };
  for (const pid of proposal.playersFromA) if (contracts[pid]) contracts[pid] = { ...contracts[pid], teamId: proposal.teamBId };
  for (const pid of proposal.playersFromB) if (contracts[pid]) contracts[pid] = { ...contracts[pid], teamId: proposal.teamAId };

  const picksFromA = proposal.picksFromA ?? [];
  const picksFromB = proposal.picksFromB ?? [];
  const futurePicks = (extras.futurePicks ?? []).map((p) => {
    if (picksFromA.includes(p.id)) return { ...p, currentOwnerTeamId: proposal.teamBId };
    if (picksFromB.includes(p.id)) return { ...p, currentOwnerTeamId: proposal.teamAId };
    return p;
  });
  const picksOnBlock = (extras.picksOnBlock ?? []).filter((id) => !picksFromA.includes(id) && !picksFromB.includes(id));

  const draftOrder = currentDraftOrder(league, extras).map((owner, slot) =>
    proposal.currentPicksFromA?.includes(slot) ? proposal.teamBId : proposal.currentPicksFromB?.includes(slot) ? proposal.teamAId : owner);
  const movedPlayers = new Set([...proposal.playersFromA, ...proposal.playersFromB]);
  const topOverall = Math.max(0, ...league.teams.flatMap(t => t.seasons.filter(s => movedPlayers.has(s.playerId)).map(calculateOverall)));
  const notable = topOverall >= 72;
  const logged = logDeadlineTrade({ ...league, teams }, proposal, topOverall);
  return { league: recordRivalryTrade(logged, proposal.teamAId, proposal.teamBId, notable), extras: { ...extras, contracts, futurePicks, picksOnBlock,
    draftOrder: extras.draftDayOpen ? draftOrder : extras.draftOrder,
    tradeBlock: extras.tradeBlock.filter(id => !movedPlayers.has(id)),
  } };
}

// ---- Free agency ----
export function signFreeAgent(
  league: League,
  extras: GMLeagueExtras,
  playerId: PlayerId,
  teamId: TeamId,
  contract: Omit<Contract, 'playerId' | 'teamId'>,
  emergencyRosterSigning = false,
): { league: League; extras: GMLeagueExtras } {
  const player = extras.freeAgents.find((s) => s.playerId === playerId);
  if (!player) return { league, extras };
  // The general market has to be open to sign someone else's free agent, but a team can always exercise
  // its exclusive re-signing rights on a player who most recently played for it (the resign_waive phase).
  const emergency = emergencyRosterSigning && (league.seasonPhase ?? 'regular_season') === 'regular_season' && (league.teams.find(t => t.teamId === teamId)?.seasons.length ?? Infinity) < extras.capSettings.minRosterSize;
  if (!extras.freeAgencyOpen && !emergency && priorTeamId(player) !== teamId) return { league, extras };
  const signingTeam = league.teams.find((t) => t.teamId === teamId);
  if (!signingTeam || !hasRosterRoom(signingTeam, extras.capSettings)) return { league, extras }; // roster is full

  if (extras.capSettings.hardCapEnabled && teamPayroll(extras.contracts, signingTeam) + contract.annualSalary > extras.capSettings.salaryCap) return { league, extras };
  const teamName = league.teams.find((t) => t.teamId === teamId)?.name ?? teamId;
  // Anything he played this season before joining belongs to his previous team (covers players waived before stints existed).
  const previousTeam = priorTeamId(player);
  const signed = appendHistoryEvent(
    { ...(previousTeam && previousTeam !== teamId ? closeStint(player, previousTeam) : player), teamId },
    'signed',
    `Signed with ${teamName} — $${(contract.annualSalary / 1_000_000).toFixed(1)}M/yr for ${contract.yearsRemaining} yr(s)`,
    teamId,
  );
  const teams = league.teams.map((t) => (t.teamId === teamId ? { ...t, seasons: [...t.seasons, signed] } : t));
  const freeAgents = extras.freeAgents.filter((s) => s.playerId !== playerId);
  const contracts = { ...extras.contracts, [playerId]: { playerId, teamId, ...contract } };

  return { league: { ...league, teams }, extras: { ...extras, freeAgents, contracts } };
}

/**
 * Waives a player to free agency. `requestingTeamId` is the team performing the
 * waive — pass the app's controlled-team id here (or leave undefined in
 * sandbox/no-restriction play). A team can only waive its own players.
 */
export function waiveToFreeAgency(
  league: League,
  extras: GMLeagueExtras,
  playerId: PlayerId,
  teamId: TeamId,
  requestingTeamId?: string | null,
): { league: League; extras: GMLeagueExtras } {
  if (requestingTeamId !== undefined && !canManageTeam(requestingTeamId, teamId)) return { league, extras };
  const team = league.teams.find((t) => t.teamId === teamId);
  const player = team?.seasons.find((s) => s.playerId === playerId);
  if (!team || !player) return { league, extras };
  if (!canDropPlayer(team, extras.capSettings)) return { league, extras }; // would drop below the roster minimum

  const teams = league.teams.map((t) => (t.teamId === teamId ? { ...t, seasons: t.seasons.filter((s) => s.playerId !== playerId) } : t));
  const waived = appendHistoryEvent(withGrudge({ ...closeStint(player, team.teamId), teamId: null }, team.teamId, league.season), 'waived', `Waived by ${team.name}`, team.teamId);
  const freeAgents = [...extras.freeAgents, waived];
  const contracts = { ...extras.contracts };
  delete contracts[playerId];

  return { league: { ...league, teams }, extras: { ...extras, freeAgents, contracts } };
}

/**
 * Directly edits an existing contract's terms (used by the sandbox player editor's "Contract" panel).
 * Also logs a `resigned` history event on the player's season so the change shows up in their history.
 * `newAnnualSalary`/`newYearsRemaining` are optional — pass only what changed.
 */
export function updateContractDirect(
  league: League,
  extras: GMLeagueExtras,
  playerId: PlayerId,
  patch: { annualSalary?: number; yearsRemaining?: number; playerOption?: boolean; teamOption?: boolean },
): { league: League; extras: GMLeagueExtras } {
  const existing = extras.contracts[playerId];
  if (!existing) return { league, extras };
  const updated: Contract = { ...existing, ...patch };
  const contracts = { ...extras.contracts, [playerId]: updated };

  const parts: string[] = [];
  if (patch.annualSalary !== undefined && patch.annualSalary !== existing.annualSalary) parts.push(`salary → $${(patch.annualSalary / 1_000_000).toFixed(2)}M/yr`);
  if (patch.yearsRemaining !== undefined && patch.yearsRemaining !== existing.yearsRemaining) parts.push(`years remaining → ${patch.yearsRemaining}`);
  if (patch.playerOption !== undefined && patch.playerOption !== existing.playerOption) parts.push(`player option → ${patch.playerOption ? 'on' : 'off'}`);
  if (patch.teamOption !== undefined && patch.teamOption !== existing.teamOption) parts.push(`team option → ${patch.teamOption ? 'on' : 'off'}`);
  const description = parts.length > 0 ? `Contract edited: ${parts.join(', ')}` : 'Contract edited';

  const teams = league.teams.map((t) => ({
    ...t,
    seasons: t.seasons.map((s) => (s.playerId === playerId ? appendHistoryEvent(s, 'resigned', description, t.teamId) : s)),
  }));

  return { league: { ...league, teams }, extras: { ...extras, contracts } };
}

/**
 * Renames a player, updating the primary key (`playerId`) everywhere it's referenced: the roster it's
 * on (or free agency), its contract, and any active injury record. `firstName`/`lastName` are stored
 * for display purposes; `playerId` is derived from them since the rest of the app keys off it directly.
 */
export function renamePlayer(
  league: League,
  extras: GMLeagueExtras,
  oldPlayerId: PlayerId,
  firstName: string,
  lastName: string,
): { league: League; extras: GMLeagueExtras; newPlayerId: PlayerId; error?: string } {
  const newPlayerId = `${firstName} ${lastName}`.trim();
  if (!newPlayerId || newPlayerId === oldPlayerId) return { league, extras, newPlayerId: oldPlayerId };
  // Ids are names, so renaming onto an existing player's name would merge the two into one person
  // (one of them would effectively vanish). Refuse instead.
  if (collectPlayerIds(league, extras).has(newPlayerId)) {
    return { league, extras, newPlayerId: oldPlayerId, error: `A player named "${newPlayerId}" already exists in this universe. Pick a different name.` };
  }

  const rename = (s: PlayerSeason): PlayerSeason =>
    s.playerId === oldPlayerId
      ? appendHistoryEvent({ ...s, playerId: newPlayerId, firstName, lastName }, 'renamed', `Renamed from "${oldPlayerId}" to "${newPlayerId}"`, s.teamId)
      : s;

  const teams = league.teams.map((t) => ({ ...t, seasons: t.seasons.map(rename) }));
  const freeAgents = extras.freeAgents.map(rename);

  const contracts = { ...extras.contracts };
  if (contracts[oldPlayerId]) {
    contracts[newPlayerId] = { ...contracts[oldPlayerId], playerId: newPlayerId };
    delete contracts[oldPlayerId];
  }

  let injuries = league.injuries;
  if (injuries && injuries[oldPlayerId]) {
    injuries = { ...injuries, [newPlayerId]: { ...injuries[oldPlayerId], playerId: newPlayerId } };
    delete injuries[oldPlayerId];
  }

  // Every other place that remembers a player by id has to follow the rename, or that player silently drops out of it.
  const swap = (id: string) => (id === oldPlayerId ? newPlayerId : id);
  const nextExtras: GMLeagueExtras = {
    ...extras,
    freeAgents,
    contracts,
    tradeBlock: extras.tradeBlock.map(swap),
    watchList: extras.watchList?.map(swap),
    draftPicksMade: extras.draftPicksMade?.map((p) => ({ ...p, playerId: swap(p.playerId) })),
  };

  return { league: { ...league, teams, injuries }, extras: nextExtras, newPlayerId };
}

/**
 * Sandbox-only direct roster reassignment (not a trade — no return value, no cap check). Moves a player
 * to a different team's roster instantly, logging the move in their history. Intended for the "Sandbox"
 * identity editor, not normal league play.
 */
export function movePlayerToTeam(league: League, extras: GMLeagueExtras, playerId: PlayerId, newTeamId: TeamId): { league: League; extras: GMLeagueExtras } {
  const fromTeam = league.teams.find((t) => t.seasons.some((s) => s.playerId === playerId));
  const toTeam = league.teams.find((t) => t.teamId === newTeamId);
  if (!toTeam || fromTeam?.teamId === newTeamId) return { league, extras };

  const player = fromTeam?.seasons.find((s) => s.playerId === playerId) ?? extras.freeAgents.find((s) => s.playerId === playerId);
  if (!player) return { league, extras };

  const leaving = fromTeam?.teamId ?? priorTeamId(player);
  const moved = appendHistoryEvent({ ...(leaving ? closeStint(player, leaving) : player), teamId: newTeamId }, 'moved', `Moved to ${toTeam.name} (sandbox)`, newTeamId);
  const teams = league.teams.map((t) => {
    if (t.teamId === fromTeam?.teamId) return { ...t, seasons: t.seasons.filter((s) => s.playerId !== playerId) };
    if (t.teamId === newTeamId) return { ...t, seasons: [...t.seasons, moved] };
    return t;
  });
  const freeAgents = extras.freeAgents.filter((s) => s.playerId !== playerId);
  const contracts = extras.contracts[playerId] ? { ...extras.contracts, [playerId]: { ...extras.contracts[playerId], teamId: newTeamId } } : extras.contracts;

  return { league: { ...league, teams }, extras: { ...extras, freeAgents, contracts } };
}

/** A player's ballpark contract demand in free agency, scaled between the league minimum and a true
 * max contract by overall rating. Not a hard price — teams can still offer more or less at signing. */
export function computeAskingSalary(overall: number, capSettings: SalaryCapSettings): number {
  const t = Math.max(0, Math.min(1, (overall - 45) / 45)); // 45 OVR -> bottom of the scale, 90+ OVR -> near max
  const max = capSettings.salaryCap * capSettings.maxSalaryPctOfCap;
  return Math.round(capSettings.minSalary + (max - capSettings.minSalary) * Math.pow(t, 1.8));
}

/** The team a free agent most recently played for, read off their history log (waived/expired entries
 * carry the team they left) — used to grant "exclusive re-signing rights" before the open market. */
export function priorTeamId(season: PlayerSeason): TeamId | null {
  const events = season.history ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].teamId) return events[i].teamId!;
  }
  return null;
}

export function toggleWatchList(extras: GMLeagueExtras, playerId: PlayerId): GMLeagueExtras {
  const onList = (extras.watchList ?? []).includes(playerId);
  return { ...extras, watchList: onList ? (extras.watchList ?? []).filter((id) => id !== playerId) : [...(extras.watchList ?? []), playerId] };
}

export function toggleTradeBlock(extras: GMLeagueExtras, playerId: PlayerId): GMLeagueExtras {
  const onBlock = extras.tradeBlock.includes(playerId);
  return { ...extras, tradeBlock: onBlock ? extras.tradeBlock.filter((id) => id !== playerId) : [...extras.tradeBlock, playerId] };
}

// ---- Draft ----
export interface DraftProspect {
  playerId: PlayerId;
  trueSeason: PlayerSeason; // the prospect's actual generated attributes
  scoutedPotential: number; // what the user SEES — noisy version of trueSeason.development.potential
  scoutingAccuracy: number; // 0-1, higher = scoutedPotential closer to true potential
}

/** Generates a draft class of prospects with true (hidden) ratings and a scouted (noisy) potential display. Prospects are built with the same archetype-based generator as regular league players, so they arrive with real varied positions, tendencies, and attribute spreads instead of a flat stat bump. */
export function generateDraftClass(count: number, seed: number, draftYear: string, existingNames: Iterable<string> = []): DraftProspect[] {
  const rng = new RNG(seed);
  const prospects: DraftProspect[] = [];
  // Player ids ARE names, so a prospect must never share a name with anyone already in the universe
  // (rostered, free agent, retired, or still in a previous class) or the two would be treated as one player.
  const usedNames = new Set<string>(existingNames);
  for (let i = 0; i < count; i++) {
    const origin = generatePlayerOrigin(rng, usedNames);
    const age = 19 + rng.nextInt(4); // 19-22
    const season = generatePlayer(origin.name, draftYear, null, age, rng.nextInt(1000), rng, { origin, prospect: true });
    // Prospects skew toward higher upside than the league average rookie, on top of the archetype's own potential roll.
    // Prospects carry a little extra upside, but franchise-changing ceilings stay rare.
    season.development.potential = Math.max(calculateOverall(season), Math.min(99, Math.round(compressElitePotential(season.development.potential + 2 + rng.nextInt(6)))));
    const scoutingAccuracy = 0.5 + rng.next() * 0.4;
    const noise = (rng.next() * 2 - 1) * (1 - scoutingAccuracy) * 30;
    prospects.push({
      playerId: origin.name,
      trueSeason: season,
      scoutedPotential: Math.max(40, Math.min(99, Math.round(season.development.potential + noise))),
      scoutingAccuracy,
    });
  }
  return prospects;
}

/** Picks a realistic draft class size: two full rounds (2x team count) plus a handful of extra
 * fringe/undrafted prospects who spill into free agency once the draft ends — capped at 74 total. */
export function pickDraftClassSize(teamCount: number, rng: RNG): number {
  return Math.min(74, teamCount * 2 + rng.nextInt(15)); // e.g. 30 teams -> 60-74 prospects
}

/** Draft order: worst record picks first (standard lottery-less ordering; a real lottery can be layered on top later). */
export function draftOrderFromStandings(league: League): TeamId[] {
  const standings = computeStandings(league);
  return [...standings].sort((a, b) => a.winPct - b.winPct).map((r) => r.teamId);
}

/**
 * A simplified NBA-style draft lottery: the worst-record teams (up to 14 of
 * them) go into a weighted lottery for the top 4 picks - the worse the
 * record, the better the odds, but no team is guaranteed a top pick. Every
 * other pick (5th onward) falls back to reverse-standings order among
 * whoever didn't land a top-4 slot. Deterministic given the same seed.
 */
export function draftOrderWithLottery(league: League, seed = Date.now()): TeamId[] {
  const standings = [...computeStandings(league)].sort((a, b) => a.winPct - b.winPct); // worst record first
  const lotteryPoolSize = Math.min(14, standings.length);
  const lotteryPool = standings.slice(0, lotteryPoolSize).map((r) => r.teamId);
  const rest = standings.slice(lotteryPoolSize).map((r) => r.teamId);
  if (lotteryPool.length === 0) return rest;

  const rng = new RNG(seed);
  const remainingPool = [...lotteryPool];
  const remainingWeights = lotteryPool.map((_, i) => lotteryPoolSize - i); // worst team = highest weight
  const numLotteryPicks = Math.min(4, lotteryPoolSize);
  const top: TeamId[] = [];

  for (let i = 0; i < numLotteryPicks; i++) {
    const totalWeight = remainingWeights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * totalWeight;
    let idx = remainingWeights.length - 1;
    for (let j = 0; j < remainingWeights.length; j++) {
      roll -= remainingWeights[j];
      if (roll <= 0) { idx = j; break; }
    }
    top.push(remainingPool[idx]);
    remainingPool.splice(idx, 1);
    remainingWeights.splice(idx, 1);
  }

  return [...top, ...remainingPool, ...rest];
}

/**
 * A real two-round draft order: round 1 uses the lottery (worse records get better odds at the very top
 * picks), round 2 is plain reverse-standings with no lottery — exactly like the real NBA draft. The
 * returned array's length is always `2 * teamCount`; `draftPickIndex` cycles straight through it.
 */
export function buildTwoRoundDraftOrder(league: League, seed = Date.now()): TeamId[] {
  const round1 = draftOrderWithLottery(league, seed);
  const round2 = draftOrderFromStandings(league);
  return [...round1, ...round2];
}

/** The current two-round order, preserving valid ownership from older saves. */
export function currentDraftOrder(league: League, extras: GMLeagueExtras): TeamId[] {
  const owners = new Set(league.teams.map(t => t.teamId));
  if (extras.draftOrder?.length === owners.size * 2 && extras.draftOrder.every(id => owners.has(id))) return extras.draftOrder;
  const round = draftOrderFromStandings(league);
  const fallback = [...round, ...round];
  // Preserve already-traded slots, repair legacy one-round orders, and discard phantom third rounds.
  return fallback.map((owner, i) => league.teams.some(t => t.teamId === extras.draftOrder?.[i]) ? extras.draftOrder![i] : owner);
}

export function computeDraftPickValue(pickNumber: number, order: TeamId[], league: League): number {
  const n = league.teams.length;
  if (!n || pickNumber < 0 || pickNumber >= Math.min(n * 2, order.length)) return 0;
  const rank = (pickNumber % n) / Math.max(1, n - 1);
  // Known slots keep their worth after changing owners; the scale matches player trade values.
  return Math.round(pickNumber < n ? 35 + 90 * Math.pow(1 - rank, 1.8) : 8 + 23 * Math.pow(1 - rank, 1.4));
}

/** The rookie scale: salary by draft slot. First-round length follows League Rules (default 4 years, 1–5);
 * second-rounders sign two-year deals near the minimum. */
export function rookieContract(pickNumber: number, teamCount: number, cap: SalaryCapSettings, firstRoundYears = 4): Omit<Contract, 'playerId' | 'teamId'> {
  const firstRound = pickNumber < teamCount;
  const rank = (pickNumber % Math.max(1, teamCount)) / Math.max(1, teamCount - 1);
  const salary = firstRound ? cap.salaryCap * (0.018 + 0.062 * Math.pow(1 - rank, 1.6)) : cap.minSalary * (1.05 + 0.45 * (1 - rank));
  const years = firstRound ? Math.max(1, Math.min(5, Math.round(firstRoundYears) || 4)) : 2;
  return { annualSalary: Math.max(cap.minSalary, Math.round(salary / 10_000) * 10_000), yearsRemaining: years, playerOption: false, teamOption: true };
}

export function draftProspect(
  league: League,
  extras: GMLeagueExtras,
  prospectId: PlayerId,
  teamId: TeamId,
): { league: League; extras: GMLeagueExtras } {
  const order = currentDraftOrder(league, extras);
  if (!extras.draftDayOpen || !Number.isInteger(extras.draftPickIndex) || extras.draftPickIndex < 0 || extras.draftPickIndex >= order.length || order[extras.draftPickIndex] !== teamId) return { league, extras };
  const prospect = extras.draftClass.find((p) => p.playerId === prospectId);
  if (!prospect) return { league, extras };

  // Safety net: if this prospect's name is somehow already taken (e.g. a class imported from an older save),
  // give them a unique id instead of letting two players collapse into one.
  const takenIds = collectPlayerIds(league, { ...extras, draftClass: [] });
  const prospectSeason = withUniquePlayerId(prospect.trueSeason, takenIds);
  const draftedId = prospectSeason.playerId;

  const teamName = league.teams.find((t) => t.teamId === teamId)?.name ?? teamId;
  const pickNumber = extras.draftPickIndex; // 0-indexed internally; display as +1 overall pick
  const teamCount = league.teams.length;
  const round = pickNumber < teamCount ? 1 : 2;
  const drafted: PlayerSeason = appendHistoryEvent(
    {
      ...prospectSeason,
      teamId,
      draftYear: league.season,
      draftRound: round,
      draftPick: pickNumber + 1,
      draftTeamId: teamId,
    },
    'drafted',
    `Drafted by ${teamName} — Round ${round}, Pick ${pickNumber + 1} (${formatSeasonYear(league.season)})`,
    teamId,
  );
  const teams = league.teams.map((t) => (t.teamId === teamId ? { ...t, seasons: [...t.seasons, drafted] } : t));
  const draftClass = extras.draftClass.filter((p) => p.playerId !== prospectId);
  const contracts = {
    ...extras.contracts,
    [draftedId]: { playerId: draftedId, teamId, ...rookieContract(pickNumber, teamCount, extras.capSettings, league.rulesSettings?.rookieContractLengthYears) },
  };
  const draftPicksMade = [...(extras.draftPicksMade ?? []), { pickNumber: extras.draftPickIndex, teamId, playerId: draftedId }];

  const result = { league: { ...league, teams }, extras: { ...extras, draftOrder: order, draftClass, contracts, draftPickIndex: pickNumber + 1, draftPicksMade } };
  return result.extras.draftPickIndex >= order.length || draftClass.length === 0 ? finalizeDraftDay(result.league, result.extras) : result;
}

/**
 * Ends the draft: any prospect who went unpicked (the class is intentionally a bit larger than the real
 * number of picks available) becomes an immediately available free agent instead of just vanishing.
 */
export function finalizeDraftDay(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras } {
  if (extras.draftClass.length === 0 && !extras.draftDayOpen) return { league, extras };
  const takenIds = collectPlayerIds(league, { ...extras, draftClass: [] });
  const undrafted = extras.draftClass.map((p) => appendHistoryEvent({ ...withUniquePlayerId(p.trueSeason, takenIds), teamId: null }, 'created', 'Went undrafted — entered free agency', null));
  return {
    league,
    extras: { ...extras, draftClass: [], draftDayOpen: false, freeAgents: [...extras.freeAgents, ...undrafted] },
  };
}

/**
 * Swaps which team owns two picks in the current draft (both identified by
 * overall pick number, 0-indexed). A simplified but real trade of draft
 * capital - scoped to picks within the draft that's currently in progress,
 * not a futures-pick ledger across seasons.
 */
export function swapDraftPicks(extras: GMLeagueExtras, pickNumberA: number, pickNumberB: number): GMLeagueExtras {
  if (!extras.draftOrder || extras.draftOrder.length === 0) return extras;
  const order = [...extras.draftOrder];
  const len = order.length;
  if (![pickNumberA, pickNumberB].every(p => Number.isInteger(p) && p >= extras.draftPickIndex && p < len)) return extras;
  const posA = pickNumberA;
  const posB = pickNumberB;
  [order[posA], order[posB]] = [order[posB], order[posA]];
  return { ...extras, draftOrder: order };
}
