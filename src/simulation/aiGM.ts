import { midseasonCarousel } from './coachingCarousel';
import { enforceSticky } from './sticky';
import { applyHistoricalDeadline } from '../history/realRollover';
import type { PlayerSeason } from './types';
import type { League, LeagueTeam } from './league';
import { signingDecision, strengthRanking } from './freeAgentDecision';
import { pickAssetValue, tradeAssetValue } from './tradeValue';
import { computeStandings } from './league';
import type { PositionSuitability } from './types';
import { primaryPosition } from './teamStatus';
import { calculateOverall } from './engine/overall';
import { perceivedPotential } from './scouting';
import { refreshLeagueMorale, type MoraleEvent } from './personality';
import { RNG } from './engine/rng';
import {
  type GMLeagueExtras, type TradeProposal, type DraftProspect,
  computeTradeValue, tradePackageValue, validateTrade, validateTradeAssets, executeTrade, evaluateTradeSides, signFreeAgent, draftProspect, currentDraftOrder,
  isTradeDeadlinePassed, capSpaceRemaining, finalizeDraftDay, tradeableFuturePicks, computeFutureDraftPickValue, waiveToFreeAgency,
} from './gm';
import { computeTeamFinances } from './finances';
import { ownerLean, ownerSpendFactor } from './ownerDials';

export type GMPersonality = 'aggressive' | 'conservative' | 'balanced';

/** Deterministically assigns each team a front-office personality that colors how its AI GM behaves in trades and free agency. */
export function assignGMPersonalities(teamIds: string[], seed: number): Record<string, GMPersonality> {
  const rng = new RNG(seed);
  const result: Record<string, GMPersonality> = {};
  for (const id of teamIds) {
    const roll = rng.next();
    result[id] = roll < 0.3 ? 'aggressive' : roll < 0.6 ? 'conservative' : 'balanced';
  }
  return result;
}

function personalityOf(extras: GMLeagueExtras, teamId: string): GMPersonality {
  return extras.teamPersonalities?.[teamId] ?? 'balanced';
}

const TARGET_ROSTER_SIZE = 13;
/** With cap room, a team keeps adding real depth (someone who would crack its top ten) up to this many players. */
const DEPTH_ROSTER_SIZE = 15;
const MIN_ROSTER_SIZE = 8;
const QUALITY_OVERALL_THRESHOLD = 60;
const POSITIONS: (keyof PositionSuitability)[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const NEED_BONUS = 12; // added to a player's effective value when they fill a team's thinnest position

/** How many "quality" (overall >= 60) rostered players a team has at each position. */
function positionalDepth(team: LeagueTeam): Record<keyof PositionSuitability, number> {
  const counts: Record<keyof PositionSuitability, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  for (const s of team.seasons) {
    if (calculateOverall(s) >= QUALITY_OVERALL_THRESHOLD) counts[primaryPosition(s)]++;
  }
  return counts;
}

/** The position(s) a team is thinnest at (fewest quality players), used to steer AI signings/trades toward addressing real gaps. */
export function weakestPositions(team: LeagueTeam): (keyof PositionSuitability)[] {
  const counts = positionalDepth(team);
  const min = Math.min(...POSITIONS.map((p) => counts[p]));
  return POSITIONS.filter((p) => counts[p] === min);
}

/** Teams the AI is allowed to act for — everyone except whichever team the person is controlling. */
function aiTeamIds(league: League, controlledTeamId: string | null): string[] {
  // Online leagues: the other friends' teams are run by people, so the AI never signs or trades for them.
  const humans = new Set(league.online?.humans ?? []);
  return league.teams.map((t) => t.teamId).filter((id) => id !== controlledTeamId && !humans.has(id));
}

export interface FreeAgencySigning { teamId: string; teamName: string; playerId: string }

/**
 * Fills out thin AI rosters from the free-agent pool: any AI team under
 * TARGET_ROSTER_SIZE signs the best-fit free agent it has cap room for —
 * "best-fit" weights trade value by whether the player fills the team's
 * thinnest position — up to a few signings per call so a single "advance the
 * season" click doesn't drain the entire FA pool in one go.
 */
export function runFreeAgencyAI(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
  seed = 1,
  maxSigningsTotal = 6,
): { league: League; extras: GMLeagueExtras; signings: FreeAgencySigning[] } {
  if (!extras.freeAgencyOpen) return { league, extras, signings: [] };
  const rng = new RNG(seed);
  let currentLeague = league;
  let currentExtras = extras;
  const signings: FreeAgencySigning[] = [];

  const ranking = strengthRanking(league);
  // Historical rosters: AI teams only sign to reach the league minimum (their real rosters arrive each season).
  const locked = !!league.historical?.forceRosters;
  const fillTo = locked ? (league.rosterLimits?.minRosterSize ?? TARGET_ROSTER_SIZE) : TARGET_ROSTER_SIZE;
  // Teams shop in a different order every day, so the same front offices don't always get first call.
  const candidateTeamIds = aiTeamIds(league, controlledTeamId)
    .filter((id) => (currentLeague.teams.find((t) => t.teamId === id)?.seasons.length ?? 0) < (locked ? fillTo : DEPTH_ROSTER_SIZE))
    .map((id) => ({ id, r: rng.next() })).sort((a, b) => a.r - b.r).map((x) => x.id);

  for (const teamId of candidateTeamIds) {
    if (signings.length >= maxSigningsTotal) break;
    const team = currentLeague.teams.find((t) => t.teamId === teamId);
    if (!team) continue;
    if (currentExtras.freeAgents.length === 0) break;

    const space = capSpaceRemaining(currentExtras.contracts, team, currentExtras.capSettings);
    // A full-enough roster only adds with real cap room, and only someone who would crack its top ten.
    const filling = team.seasons.length < fillTo;
    if (!filling && (locked || space < currentExtras.capSettings.minSalary * 2)) continue;
    const depthLine = filling ? -Infinity : ([...team.seasons].map(calculateOverall).sort((a, b) => b - a)[9] ?? 0) + 1;
    const personality = personalityOf(currentExtras, teamId);
    const aggressiveness = ruleMultiplier(league.rulesSettings?.aiFreeAgentAggressiveness); // 0.5x-1.5x, 1.0x at the default 50
    const winPct = computeStandings(league).find((r) => r.teamId === teamId)?.winPct ?? 0.5;
    const finances = computeTeamFinances(team, currentExtras.contracts, currentExtras.capSettings, league.rulesSettings, winPct);
    // An owner's budget (Owner's Box) makes his GM spend more or less than the market alone would.
    const marketFactor = (0.5 + finances.spendingWillingness / 100) * ownerSpendFactor(league, teamId); // big-market/thriving teams are more willing to spend; small-market/strained teams are more cautious
    const cushion = (personality === 'aggressive' ? 500_000 : personality === 'conservative' ? 6_000_000 : 2_000_000) / (aggressiveness * marketFactor);
    const priceMultiplier = (personality === 'aggressive' ? 1.15 : personality === 'conservative' ? 0.85 : 1) * aggressiveness * marketFactor;
    const need = weakestPositions(team);
    const affordable = currentExtras.freeAgents
      .filter((p) => calculateOverall(p) > depthLine)
      .filter(() => !currentExtras.capSettings.enforceCapOnTrades || space >= cushion || filling)
      .sort((a, b) => {
        const scoreA = computeTradeValue(a) + (need.includes(primaryPosition(a)) ? NEED_BONUS : 0);
        const scoreB = computeTradeValue(b) + (need.includes(primaryPosition(b)) ? NEED_BONUS : 0);
        return scoreB - scoreA;
      });
    // Free agents choose too, under the same rules as everyone (signingDecision): skip anyone who refuses this team,
    // wants more than it can pay, or doesn't fit under the cap. The team's own free agents are Bird-rights re-signings.
    const budget = Math.max(2_000_000, space);
    let pick: (typeof affordable)[number] | undefined, annualSalary = 0;
    const yearsRemaining = 1 + rng.nextInt(3);
    for (const candidate of affordable) {
      const offer = Math.max(1_500_000, Math.min(Math.round(computeTradeValue(candidate) * 250_000 * priceMultiplier), budget));
      const quote = signingDecision(currentLeague, currentExtras, candidate, teamId, undefined, { ranking });
      if (quote.refuses) continue;
      // Depth signings pay the asking price; filling a thin roster a team pays up to its own valuation.
      const salary = filling ? Math.max(offer, quote.required) : quote.required;
      if (quote.path === 'market' && salary > budget) continue;
      if (!signingDecision(currentLeague, currentExtras, candidate, teamId, { annualSalary: salary, yearsRemaining }, { ranking }).accepted) continue;
      pick = candidate; annualSalary = salary; break;
    }
    if (!pick) continue;

    const { league: nextLeague, extras: nextExtras } = signFreeAgent(currentLeague, currentExtras, pick.playerId, teamId, {
      annualSalary, yearsRemaining, playerOption: false, teamOption: false,
    });
    if (nextLeague === currentLeague) continue;
    currentLeague = nextLeague;
    currentExtras = nextExtras;
    signings.push({ teamId, teamName: team.name, playerId: pick.playerId });
  }

  // Stars don't sit in free agency: teams with a clear upgrade go after them even with a full roster.
  const chase = runStarChaseAI(currentLeague, currentExtras, controlledTeamId, seed + 7, Math.max(0, maxSigningsTotal - signings.length));
  return { league: chase.league, extras: chase.extras, signings: [...signings, ...chase.signings] };
}

/** Free agents at or above this share of the league's best ratings are "stars" every team will call about. */
const STAR_PERCENTILE = 0.85;
/** A payroll below this share of the cap is under the salary floor: that team has to spend (like the NBA's 90%). */
export const SALARY_FLOOR = 0.9;
/** A free agent must be this much more valuable than the player a team would cut before it makes the swap. */
const UPGRADE_MARGIN = 6;

/**
 * How much a team wants to keep a player, for deciding whom to cut: value, minus underperformance (a player
 * producing far below his rating over a real sample), with long or big contracts protected (cutting them is costly).
 */
export function keepScore(p: PlayerSeason, salary = 0): number {
  const s = p.seasonStats;
  let score = computeTradeValue(p);
  if (s && s.minutes >= 150) {
    // Production per 36 minutes against what his rating should produce in them.
    const per36 = ((s.points + (s.oreb + s.dreb) * 1.2 + s.ast * 1.5 + s.stl * 2 + s.blk * 2 - s.tov) / s.minutes) * 36;
    const expected = Math.max(0, calculateOverall(p) - 40) * 1.3;
    score -= Math.max(0, expected - per36) * 0.5;
  }
  return score + Math.max(0, salary - 4_000_000) / 1_000_000;
}

/**
 * AI teams pursue the best free agents: for each star (and any free agent who is a clear upgrade), the teams that
 * can afford him and would get better make offers; the best fit that he accepts signs him, and if its roster is
 * full it waives its weakest, cheapest-to-cut player (usually one underperforming his rating) to make room.
 */
export function runStarChaseAI(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed = 1, maxMoves = 4): { league: League; extras: GMLeagueExtras; signings: FreeAgencySigning[] } {
  if (!extras.freeAgencyOpen || maxMoves <= 0 || !extras.freeAgents.length || league.historical?.forceRosters) return { league, extras, signings: [] };
  const rng = new RNG(seed);
  const ratings = league.teams.flatMap(t => t.seasons.map(calculateOverall)).sort((a, b) => a - b);
  const starLine = ratings[Math.floor(ratings.length * STAR_PERCENTILE)] ?? 70;
  const maxRoster = league.rosterLimits?.maxRosterSize ?? 15;
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r.winPct]));
  const ranking = strengthRanking(league);
  let current = { league, extras };
  const signings: FreeAgencySigning[] = [];
  const targets = [...extras.freeAgents].sort((a, b) => computeTradeValue(b) - computeTradeValue(a)).slice(0, 8);

  for (const fa of targets) {
    if (signings.length >= maxMoves) break;
    if (!current.extras.freeAgents.some(f => f.playerId === fa.playerId)) continue;
    const star = calculateOverall(fa) >= starLine;
    const value = computeTradeValue(fa);
    type Bid = { teamId: string; salary: number; years: number; cut?: string; score: number };
    const bids: Bid[] = [];
    for (const teamId of aiTeamIds(current.league, controlledTeamId)) {
      const team = current.league.teams.find(t => t.teamId === teamId)!;
      const full = team.seasons.length >= maxRoster;
      // Who would go: the lowest keep score among players outside the top eight of the rotation.
      const top8 = new Set([...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 8).map(p => p.playerId));
      const cut = team.seasons.filter(p => !top8.has(p.playerId))
        .map(p => ({ p, k: keepScore(p, current.extras.contracts[p.playerId]?.annualSalary) }))
        .sort((a, b) => a.k - b.k)[0];
      const worst = team.seasons.map(p => computeTradeValue(p)).sort((a, b) => a - b)[Math.min(7, team.seasons.length - 1)] ?? 0;
      // Only a real upgrade on the rotation's back end (or a star) is worth the chase.
      if (!star && value < worst + UPGRADE_MARGIN) continue;
      if (full && (!cut || value < cut.k + UPGRADE_MARGIN)) continue;
      const personality = personalityOf(current.extras, teamId);
      const years = star ? 2 + rng.nextInt(3) : 1 + rng.nextInt(2);
      // Teams under the salary floor have money they must spend: they bid harder, up to their cap room.
      const cap = current.extras.capSettings;
      const room = capSpaceRemaining(current.extras.contracts, team, cap);
      const underFloor = cap.salaryCap - room < cap.salaryCap * SALARY_FLOOR;
      const offerBase = Math.round(value * 250_000 * (personality === 'aggressive' ? 1.2 : personality === 'conservative' ? 0.95 : 1.08) * (star ? 1.15 : 1) * (underFloor ? 1.2 : 1));
      const quote = signingDecision(current.league, current.extras, fa, teamId, undefined, { ranking });
      if (quote.refuses) continue;
      const salary = Math.max(quote.required, underFloor ? Math.min(offerBase, Math.max(quote.required, room)) : offerBase);
      if (!signingDecision(current.league, current.extras, fa, teamId, { annualSalary: salary, yearsRemaining: years }, { ranking }).accepted) continue;
      const winPct = standings.get(teamId) ?? 0.5;
      const need = weakestPositions(team).includes(primaryPosition(fa)) ? NEED_BONUS : 0;
      // The player chooses: the money first, then a winner and a role (he doesn't just join the best team every time).
      bids.push({ teamId, salary, years, cut: full ? cut!.p.playerId : undefined, score: salary / 1_000_000 + winPct * 12 + need * 0.5 + (value - worst) * 0.5 + rng.next() * 4 });
    }
    const best = bids.sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    let next = current;
    if (best.cut) {
      const waived = waiveToFreeAgency(next.league, next.extras, best.cut, best.teamId);
      if (waived.league === next.league) continue;
      next = waived;
    }
    const signed = signFreeAgent(next.league, next.extras, fa.playerId, best.teamId, { annualSalary: best.salary, yearsRemaining: best.years, playerOption: false, teamOption: false });
    if (signed.league === next.league) continue;
    current = signed;
    signings.push({ teamId: best.teamId, teamName: current.league.teams.find(t => t.teamId === best.teamId)?.name ?? best.teamId, playerId: fa.playerId });
  }
  return { ...current, signings };
}

/** Maps a 0-100 league-rules slider to a 0.5x-1.5x multiplier, centered on 1.0x at the default of 50 —
 * so an untouched slider reproduces today's behavior exactly, and pushing it changes things smoothly. */
function ruleMultiplier(value: number | undefined): number {
  return 0.5 + (value ?? 50) / 100;
}

/** Contenders (buyers) look to add proven vets; bottom-of-the-standings teams (sellers) look to shed vets for youth. Personality widens or narrows how decisive a team is about picking a lane; the league-wide aiWinNowTendency/aiRebuildingTendency sliders shift both thresholds up or down for every AI team at once. */
export function classifyBuyerSeller(league: League, extras: GMLeagueExtras, teamId: string): 'buyer' | 'seller' | 'neutral' {
  const row = computeStandings(league).find((r) => r.teamId === teamId);
  if (!row) return 'neutral';
  const personality = personalityOf(extras, teamId);
  let buyerThreshold = personality === 'aggressive' ? 0.50 : personality === 'conservative' ? 0.60 : 0.55;
  let sellerThreshold = personality === 'aggressive' ? 0.45 : personality === 'conservative' ? 0.35 : 0.40;
  const rules = league.rulesSettings;
  buyerThreshold -= ((rules?.aiWinNowTendency ?? 50) - 50) * 0.0015; // more win-now -> easier to qualify as a buyer
  sellerThreshold += ((rules?.aiRebuildingTendency ?? 50) - 50) * 0.0015; // more rebuild-minded -> easier to qualify as a seller
  // An owner's goal (Owner's Box) pushes his GM to buy or sell.
  const lean = ownerLean(league, teamId);
  buyerThreshold += lean.buyer; sellerThreshold -= lean.seller;
  if (row.winPct >= buyerThreshold) return 'buyer';
  if (row.winPct <= sellerThreshold) return 'seller';
  return 'neutral';
}

/**
 * Looks for a single mutually-sensible veteran-for-youth swap between two
 * specific teams; returns null if nothing reasonable is found. Both sides of
 * the swap are steered toward the receiving team's thinnest position, so a
 * team stacked at one spot doesn't just keep hoarding value there. When the
 * player-for-player value gap is too lopsided to clear the trade-value
 * check, a future draft pick from the lighter side is added as a sweetener
 * (rough valuation - see computeFutureDraftPickValue) rather than the offer
 * simply failing outright.
 */
export function findAITrade(league: League, extras: GMLeagueExtras, teamAId: string, teamBId: string, sellerId?: string, targetPlayerId?: string): TradeProposal | null {
  const teamA = league.teams.find((t) => t.teamId === teamAId);
  const teamB = league.teams.find((t) => t.teamId === teamBId);
  if (!teamA || !teamB || teamA.seasons.length <= MIN_ROSTER_SIZE || teamB.seasons.length <= MIN_ROSTER_SIZE) return null;

  let seller = teamA, buyer = teamB;
  if (sellerId === teamAId || sellerId === teamBId) {
    // The caller already knows who is selling (Deadline Day calls to a team that could go either way).
    seller = sellerId === teamAId ? teamA : teamB;
    buyer = sellerId === teamAId ? teamB : teamA;
  } else {
    const classA = classifyBuyerSeller(league, extras, teamAId);
    const classB = classifyBuyerSeller(league, extras, teamBId);
    if (classA === 'seller' && classB === 'buyer') { seller = teamA; buyer = teamB; }
    else if (classB === 'seller' && classA === 'buyer') { seller = teamB; buyer = teamA; }
    else return null; // no clear buyer/seller relationship between this pair right now
  }

  // Values are seen through each front office's own situation (tradeValue.ts): the buyer wants help now,
  // the seller wants youth and picks. A deal is proposed only if both can come out ahead.
  const buyerNeed = weakestPositions(buyer);
  const needBoost = (p: PlayerSeason, need: string[]) => need.includes(primaryPosition(p)) ? 1.15 : 1;
  // The buyer only calls about a real upgrade to its rotation, and never gives up its top five for him.
  const byRating = [...buyer.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const buyerCore = new Set(byRating.slice(0, 5).map(p => p.playerId));
  const rotationLine = calculateOverall(byRating[Math.min(6, byRating.length - 1)]);
  // A named target (a Deadline Day rumor, your trade block) is shopped whatever his age; otherwise the seller moves veterans.
  const named = targetPlayerId ? seller.seasons.find((s) => s.playerId === targetPlayerId) : undefined;
  const vets = named ? [named] : [...seller.seasons]
    .filter((s) => s.age >= 28 && calculateOverall(s) >= rotationLine + 3)
    .sort((a, b) => tradeAssetValue(b, league, extras, buyer.teamId) * needBoost(b, buyerNeed) - tradeAssetValue(a, league, extras, buyer.teamId) * needBoost(a, buyerNeed))
    .slice(0, 3);
  const currentYear = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const top8 = (team: LeagueTeam, out: string[], inc: PlayerSeason[]) => [...team.seasons.filter(p => !out.includes(p.playerId)), ...inc]
    .map(calculateOverall).sort((a, b) => b - a).slice(0, 8).reduce((n, v) => n + v, 0);

  for (const sellerVet of vets) {
    if (named && calculateOverall(sellerVet) < rotationLine) return null;
    const vetToSeller = tradeAssetValue(sellerVet, league, extras, seller.teamId);
    const gapPosition = primaryPosition(sellerVet);
    const buyerYoung = [...buyer.seasons]
      .filter((s) => s.age <= 25 && !buyerCore.has(s.playerId))
      .sort((a, b) => {
        const distA = Math.abs(tradeAssetValue(a, league, extras, seller.teamId) - vetToSeller) * (primaryPosition(a) === gapPosition ? 0.8 : 1);
        const distB = Math.abs(tradeAssetValue(b, league, extras, seller.teamId) - vetToSeller) * (primaryPosition(b) === gapPosition ? 0.8 : 1);
        return distA - distB;
      })[0];
    const fromBuyer = buyerYoung ? [buyerYoung.playerId] : [];
    const proposal: TradeProposal = seller.teamId === teamAId
      ? { teamAId: seller.teamId, teamBId: buyer.teamId, playersFromA: [sellerVet.playerId], playersFromB: fromBuyer }
      : { teamAId: buyer.teamId, teamBId: seller.teamId, playersFromA: fromBuyer, playersFromB: [sellerVet.playerId] };

    // Close any shortfall with the pick (from the side that owes) whose value best matches it.
    const sides = evaluateTradeSides(league, extras, proposal);
    for (const side of [sides.a, sides.b]) {
      const shortfall = side.give - side.receive;
      if (shortfall <= side.give * 0.05 && (side.give > 0 || side.receive > 0)) continue;
      const payer = side.teamId === proposal.teamAId ? proposal.teamBId : proposal.teamAId;
      const options = tradeableFuturePicks(extras, payer).map(pick => ({ pick, value: pickAssetValue(computeFutureDraftPickValue(pick, league, currentYear), league, side.teamId) }));
      if (!options.length) break;
      // Closest match that covers most of the gap; otherwise the best pick they have (validation decides if it's enough).
      const covering = options.filter(o => o.value >= shortfall * 0.6).sort((x, y) => Math.abs(x.value - shortfall) - Math.abs(y.value - shortfall));
      const choice = covering[0] ?? options.sort((x, y) => y.value - x.value)[0];
      if (payer === proposal.teamAId) proposal.picksFromA = [...(proposal.picksFromA ?? []), choice.pick.id];
      else proposal.picksFromB = [...(proposal.picksFromB ?? []), choice.pick.id];
      break;
    }
    if (!proposal.playersFromA.length && !proposal.picksFromA?.length) continue;
    if (!proposal.playersFromB.length && !proposal.picksFromB?.length) continue;
    // The buyer has to come out better today: its best eight improve.
    if (top8(buyer, fromBuyer, [sellerVet]) <= top8(buyer, [], [])) continue;
    return proposal;
  }
  return null;
}

export interface ExecutedAITrade {
  teamAId: string; teamAName: string; teamBId: string; teamBName: string;
  playersFromA: string[]; playersFromB: string[];
  picksFromA?: string[]; picksFromB?: string[];
}

/** Runs a handful of AI-vs-AI trade attempts (never involving the controlled team) and executes any that pass validateTrade. The league-wide tradeAIAggressiveness slider scales how many attempts/completions happen per call — higher means a livelier trade market. */
/** The least an AI team gets back in neutral value, as a share of what it gives up, in AI-to-AI trades. */
export const AI_TRADE_NEUTRAL_FLOOR = 0.6;
/** Whether a player has already been traded this season (from his own history). */
function tradedThisSeason(league: League, playerId: string): boolean {
  const p = league.teams.flatMap(t => t.seasons).find(s => s.playerId === playerId);
  return !!p?.history?.some(e => e.type === 'traded' && e.season === league.season);
}

export const MAX_AI_TRADE_ARRIVALS = 2;
/** How many players a team has taken in by trade this season (from their own history). */
function tradeArrivals(league: League, teamId: string): number {
  const team = league.teams.find(t => t.teamId === teamId);
  return team?.seasons.filter(p => p.history?.some(e => e.type === 'traded' && e.season === league.season && e.teamId === teamId)).length ?? 0;
}

export function runTradeMarketAI(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
  seed = 1,
  maxTrades = 2,
): { league: League; extras: GMLeagueExtras; trades: ExecutedAITrade[] } {
  if (isTradeDeadlinePassed(league)) return { league, extras, trades: [] };
  // Historical rosters: AI teams keep their real rosters (trades with you still happen through offers).
  if (league.historical?.forceRosters) return { league, extras, trades: [] };
  const rng = new RNG(seed);
  const ids = aiTeamIds(league, controlledTeamId);
  if (ids.length < 2) return { league, extras, trades: [] };

  const aggressiveness = ruleMultiplier(league.rulesSettings?.tradeAIAggressiveness); // 0.5x-1.5x, 1.0x at the default 50
  const effectiveMaxTrades = Math.max(1, Math.round(maxTrades * aggressiveness));

  let currentLeague = league;
  let currentExtras = extras;
  const trades: ExecutedAITrade[] = [];
  const attempts = Math.round(Math.min(20, ids.length * 3) * aggressiveness);

  for (let attempt = 0; attempt < attempts && trades.length < effectiveMaxTrades; attempt++) {
    const a = ids[rng.nextInt(ids.length)];
    const b = ids[rng.nextInt(ids.length)];
    if (a === b) continue;
    const proposal = findAITrade(currentLeague, currentExtras, a, b);
    if (!proposal) continue;
    const validation = validateTrade(currentLeague, currentExtras, proposal);
    if (!validation.valid) continue;
    // Sanity floor: each side values the deal from its own situation, but no AI-to-AI deal may be lopsided on neutral
    // value (a star for spare parts), and nobody is flipped twice in a season.
    const give = (team: string, players: string[], picks?: string[]) => tradePackageValue(currentLeague, currentExtras, team, players, picks ?? []);
    const va = give(proposal.teamAId, proposal.playersFromA, proposal.picksFromA), vb = give(proposal.teamBId, proposal.playersFromB, proposal.picksFromB);
    if (Math.min(va, vb) < Math.max(va, vb) * AI_TRADE_NEUTRAL_FLOOR) continue;
    if ([...proposal.playersFromA, ...proposal.playersFromB].some(id => tradedThisSeason(currentLeague, id))) continue;
    // Two trade arrivals a season is plenty for any AI front office (no contender stacks deal after deal).
    if ([proposal.teamAId, proposal.teamBId].some(id => tradeArrivals(currentLeague, id) >= MAX_AI_TRADE_ARRIVALS)) continue;

    const teamAName = currentLeague.teams.find((t) => t.teamId === proposal.teamAId)!.name;
    const teamBName = currentLeague.teams.find((t) => t.teamId === proposal.teamBId)!.name;
    const { league: nextLeague, extras: nextExtras } = executeTrade(currentLeague, currentExtras, proposal);
    currentLeague = nextLeague;
    currentExtras = nextExtras;
    trades.push({
      teamAId: proposal.teamAId, teamAName, teamBId: proposal.teamBId, teamBName,
      playersFromA: proposal.playersFromA, playersFromB: proposal.playersFromB,
      picksFromA: proposal.picksFromA, picksFromB: proposal.picksFromB,
    });
  }

  return { league: currentLeague, extras: currentExtras, trades };
}

/**
 * Has one AI team draw up a proposal aimed at the user's team (buyer/seller
 * logic same as AI-vs-AI, just with the controlled team standing in for
 * whichever side of the swap it classifies as). Never executed automatically —
 * it's added to `pendingTradeOffers` for the person to accept or decline.
 */
export function generateTradeOfferForControlledTeam(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
  seed = 1,
): TradeProposal | null {
  if (!controlledTeamId || isTradeDeadlinePassed(league)) return null;
  const rng = new RNG(seed);
  const partners = aiTeamIds(league, controlledTeamId);
  const shuffled = [...partners].sort(() => rng.next() - 0.5);
  const declined = new Set(extras.declinedOffers ?? []);
  const fresh = (p: TradeProposal | null): p is TradeProposal => !!p && !declined.has(offerKey(league, p)) && validateTrade(league, extras, p).valid;
  // Players you put on the block get calls first: a team that wants him makes you an offer for him.
  const mine = league.teams.find(t => t.teamId === controlledTeamId);
  const onBlock = extras.tradeBlock.filter(id => mine?.seasons.some(p => p.playerId === id && !p.stick));
  for (const target of onBlock) {
    for (const partnerId of shuffled) {
      const proposal = findAITrade(league, extras, controlledTeamId, partnerId, controlledTeamId, target);
      if (fresh(proposal)) return { ...proposal, note: `${league.teams.find(t => t.teamId === partnerId)?.name ?? partnerId} are calling about ${target} on your trade block.` };
    }
  }
  // Otherwise the phone rings about half the weeks: a contender calls about one of your veterans, or a rebuilding
  // team offers you one of theirs (whatever your own record, unless you are clearly on the same side).
  if (rng.next() < 0.45) return null;
  const mineClass = classifyBuyerSeller(league, extras, controlledTeamId);
  for (const partnerId of shuffled) {
    const theirs = classifyBuyerSeller(league, extras, partnerId);
    const proposal = theirs === 'buyer' && mineClass !== 'buyer' ? findAITrade(league, extras, controlledTeamId, partnerId, controlledTeamId)
      : theirs === 'seller' && mineClass !== 'seller' ? findAITrade(league, extras, controlledTeamId, partnerId, partnerId)
      : null;
    if (fresh(proposal)) return proposal;
  }
  return null;
}

/** Identifies an offer by the players who move, so a declined deal isn't pitched again this season with a different pick. */
export function offerKey(league: League, p: TradeProposal): string {
  const side = (players: string[]) => [...players].sort().join('+');
  return `${league.season}|${p.teamAId}:${side(p.playersFromA)}|${p.teamBId}:${side(p.playersFromB)}`;
}

export interface DraftAIPick { teamId: string; teamName: string; playerId: string }

/** Whichever team is on the clock right now, cycling through the standings-based order for as many rounds as the draft class allows. */
export function teamOnTheClock(league: League, extras: GMLeagueExtras): string | null {
  const order = currentDraftOrder(league, extras);
  if (order.length === 0 || extras.draftClass.length === 0) return null;
  if (extras.draftPickIndex >= order.length) return null; // draft is over — no picks left, regardless of leftover class size
  return extras.draftDayOpen ? order[extras.draftPickIndex] : null;
}

/** Picks the best remaining prospect for the given team, weighting scouted potential toward whichever
 * position that team is currently thinnest at — mirrors how the free-agency and trade AI already avoid
 * blindly stacking the position they already have quality depth at (this was the one place that didn't). */
function bestAvailableProspect(league: League, extras: GMLeagueExtras, team?: LeagueTeam | null): DraftProspect | null {
  if (extras.draftClass.length === 0) return null;
  // Historical rosters: a team takes the player it really drafted, else the next real pick still on the board.
  if (league.historical?.forceRosters) {
    const real = extras.draftClass.filter(p => p.trueSeason.draftPick != null && p.trueSeason.draftYear === league.season);
    const ours = real.filter(p => team && p.trueSeason.draftTeamId === team.teamId).sort((a, b) => a.trueSeason.draftPick! - b.trueSeason.draftPick!)[0];
    const next = [...real].sort((a, b) => a.trueSeason.draftPick! - b.trueSeason.draftPick!)[0];
    if (ours ?? next) return (ours ?? next)!;
  }
  const need = team ? weakestPositions(team) : [];
  // Each front office drafts from its own scouting read, so a bigger scouting budget finds the real gems.
  const score = (p: DraftProspect) => perceivedPotential(p, league, extras, team?.teamId ?? null) * 0.8 + calculateOverall(p.trueSeason) * 0.2
    + (need.includes(primaryPosition(p.trueSeason)) ? NEED_BONUS : 0);
  return [...extras.draftClass].map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || a.p.playerId.localeCompare(b.p.playerId))[0].p;
}

/** Drafts the single best remaining prospect for whichever team is currently on the clock, regardless of who controls them. Used by "Sim One Pick" in the draft UI. Auto-finalizes the draft (undrafted prospects -> free agency) once every real pick has been made. */
export function draftOnePick(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; pick: DraftAIPick | null } {
  if (!extras.draftDayOpen) return { league, extras, pick: null };
  const order = currentDraftOrder(league, extras);
  if (extras.draftPickIndex >= order.length) {
    const finalized = finalizeDraftDay(league, extras);
    return { league: finalized.league, extras: finalized.extras, pick: null };
  }
  const onClock = teamOnTheClock(league, extras);
  const onClockTeam = onClock ? league.teams.find((t) => t.teamId === onClock) : null;
  const prospect = bestAvailableProspect(league, extras, onClockTeam);
  if (!onClock || !prospect) return { league, extras, pick: null };
  const team = onClockTeam!;
  const { league: nextLeague, extras: nextExtras } = draftProspect(league, extras, prospect.playerId, onClock);
  return { league: nextLeague, extras: nextExtras, pick: { teamId: onClock, teamName: team.name, playerId: prospect.playerId } };
}

/** Drafts every remaining pick in the class, best-available each time, regardless of who controls each team. Used by "To End of Draft". */
export function simEntireDraft(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; picks: DraftAIPick[] } {
  let currentLeague = league;
  let currentExtras = extras;
  const picks: DraftAIPick[] = [];
  while (currentExtras.draftDayOpen && currentExtras.draftClass.length > 0) {
    const step = draftOnePick(currentLeague, currentExtras);
    currentLeague = step.league;
    currentExtras = step.extras;
    if (!step.pick) break; // either nothing to draft, or the draft just finalized (leftover class -> free agency)
    picks.push(step.pick);
  }
  // Covers the exact-match case too (class size == number of real picks): the loop above exits the
  // instant draftClass empties out from drafting, without ever calling finalize — do it here so
  // draftDayOpen always ends up false once every pick has actually been made.
  if (currentExtras.draftDayOpen) {
    const finalized = finalizeDraftDay(currentLeague, currentExtras);
    currentLeague = finalized.league;
    currentExtras = finalized.extras;
  }
  return { league: currentLeague, extras: currentExtras, picks };
}

/**
 * Auto-drafts for every AI team currently on the clock, stopping the instant
 * it would be the controlled team's turn (or the draft class runs out). In
 * sandbox play (no controlled team), stops after one full round so a single
 * click doesn't silently draft the whole class.
 */
export function autoDraftAIPicksUntilUserTurn(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
): { league: League; extras: GMLeagueExtras; picks: DraftAIPick[] } {
  if (!extras.draftDayOpen) return { league, extras, picks: [] };
  const order = currentDraftOrder(league, extras);
  let currentLeague = league;
  let currentExtras = extras;
  const picks: DraftAIPick[] = [];
  const roundCap = controlledTeamId ? Infinity : league.teams.length;

  while (picks.length < roundCap) {
    const onClock = teamOnTheClock(currentLeague, currentExtras);
    if (!onClock || onClock === controlledTeamId || currentExtras.draftClass.length === 0) break;
    const team = currentLeague.teams.find((t) => t.teamId === onClock)!;
    const prospect = bestAvailableProspect(currentLeague, currentExtras, team);
    if (!prospect) break;
    const { league: nextLeague, extras: nextExtras } = draftProspect(currentLeague, currentExtras, prospect.playerId, onClock);
    currentLeague = nextLeague;
    currentExtras = nextExtras;
    picks.push({ teamId: onClock, teamName: team.name, playerId: prospect.playerId });
  }
  if (currentExtras.draftPickIndex >= order.length && currentExtras.draftDayOpen) {
    const finalized = finalizeDraftDay(currentLeague, currentExtras);
    currentLeague = finalized.league;
    currentExtras = finalized.extras;
  }

  return { league: currentLeague, extras: currentExtras, picks };
}

export interface LeagueAIPassResult {
  league: League;
  extras: GMLeagueExtras;
  signings: FreeAgencySigning[];
  trades: ExecutedAITrade[];
  newOfferGenerated: boolean;
  moraleEvents: MoraleEvent[];
}

/**
 * The single entry point wired into "advance the calendar" actions in the UI:
 * runs a free-agency pass, an AI-vs-AI trade market pass, and — if the person
 * doesn't already have a pending offer sitting in their inbox — tries to
 * generate one new incoming trade offer for them to consider.
 */
export function runLeagueAIPass(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
  seed = 1,
): LeagueAIPassResult {
  // A struggling AI team may change coaches mid-season (the coaching carousel).
  const mood = refreshLeagueMorale(midseasonCarousel(league, controlledTeamId, seed + 3), extras);
  const fa = runFreeAgencyAI(mood.league, mood.extras, controlledTeamId, seed);
  const trade = runTradeMarketAI(fa.league, fa.extras, controlledTeamId, seed + 1);

  // An offer whose players or picks have since moved (another trade, a release) is withdrawn.
  let finalExtras = { ...trade.extras, pendingTradeOffers: trade.extras.pendingTradeOffers.filter(o => validateTradeAssets(trade.league, trade.extras, o).valid) };
  let newOfferGenerated = false;
  if (controlledTeamId && finalExtras.pendingTradeOffers.length === 0) {
    const offer = generateTradeOfferForControlledTeam(trade.league, finalExtras, controlledTeamId, seed + 2);
    if (offer) {
      finalExtras = { ...finalExtras, pendingTradeOffers: [...finalExtras.pendingTradeOffers, offer] };
      newOfferGenerated = true;
    }
  }

  // Historical rosters: once the deadline passes, the real mid-season moves happen.
  const real = isTradeDeadlinePassed(trade.league) ? applyHistoricalDeadline(trade.league, finalExtras, controlledTeamId) : { league: trade.league, extras: finalExtras };
  const settled = enforceSticky(real.league, real.extras);
  return { league: settled.league, extras: settled.extras, signings: fa.signings, trades: trade.trades, newOfferGenerated, moraleEvents: mood.events };
}
