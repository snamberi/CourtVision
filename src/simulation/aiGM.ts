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
  computeTradeValue, validateTrade, executeTrade, evaluateTradeSides, signFreeAgent, draftProspect, currentDraftOrder,
  isTradeDeadlinePassed, capSpaceRemaining, finalizeDraftDay, tradeableFuturePicks, computeFutureDraftPickValue,
} from './gm';
import { computeTeamFinances } from './finances';

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

const TARGET_ROSTER_SIZE = 12;
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
  return league.teams.map((t) => t.teamId).filter((id) => id !== controlledTeamId);
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
  const candidateTeamIds = aiTeamIds(league, controlledTeamId)
    .filter((id) => (currentLeague.teams.find((t) => t.teamId === id)?.seasons.length ?? 0) < TARGET_ROSTER_SIZE);

  for (const teamId of candidateTeamIds) {
    if (signings.length >= maxSigningsTotal) break;
    const team = currentLeague.teams.find((t) => t.teamId === teamId);
    if (!team || team.seasons.length >= TARGET_ROSTER_SIZE) continue;
    if (currentExtras.freeAgents.length === 0) break;

    const space = capSpaceRemaining(currentExtras.contracts, team, currentExtras.capSettings);
    const personality = personalityOf(currentExtras, teamId);
    const aggressiveness = ruleMultiplier(league.rulesSettings?.aiFreeAgentAggressiveness); // 0.5x-1.5x, 1.0x at the default 50
    const winPct = computeStandings(league).find((r) => r.teamId === teamId)?.winPct ?? 0.5;
    const finances = computeTeamFinances(team, currentExtras.contracts, currentExtras.capSettings, league.rulesSettings, winPct);
    const marketFactor = 0.5 + finances.spendingWillingness / 100; // big-market/thriving teams are more willing to spend; small-market/strained teams are more cautious
    const cushion = (personality === 'aggressive' ? 500_000 : personality === 'conservative' ? 6_000_000 : 2_000_000) / (aggressiveness * marketFactor);
    const priceMultiplier = (personality === 'aggressive' ? 1.15 : personality === 'conservative' ? 0.85 : 1) * aggressiveness * marketFactor;
    const need = weakestPositions(team);
    const affordable = currentExtras.freeAgents
      .filter(() => !currentExtras.capSettings.enforceCapOnTrades || space >= cushion)
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
      const salary = Math.max(offer, quote.required);
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

  return { league: currentLeague, extras: currentExtras, signings };
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
  // A named target (a Deadline Day rumor) is shopped whatever his age; otherwise the seller moves a veteran.
  const sellerVet = targetPlayerId ? seller.seasons.find((s) => s.playerId === targetPlayerId) : [...seller.seasons]
    .filter((s) => s.age >= 29)
    .sort((a, b) => tradeAssetValue(b, league, extras, buyer.teamId) * needBoost(b, buyerNeed) - tradeAssetValue(a, league, extras, buyer.teamId) * needBoost(a, buyerNeed))[0];
  if (!sellerVet) return null;
  const vetToSeller = tradeAssetValue(sellerVet, league, extras, seller.teamId);
  const gapPosition = primaryPosition(sellerVet);
  const buyerYoung = [...buyer.seasons]
    .filter((s) => s.age <= 25)
    .sort((a, b) => {
      const distA = Math.abs(tradeAssetValue(a, league, extras, seller.teamId) - vetToSeller) * (primaryPosition(a) === gapPosition ? 0.8 : 1);
      const distB = Math.abs(tradeAssetValue(b, league, extras, seller.teamId) - vetToSeller) * (primaryPosition(b) === gapPosition ? 0.8 : 1);
      return distA - distB;
    })[0];
  if (!buyerYoung) return null;

  const currentYear = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const proposal: TradeProposal = seller.teamId === teamAId
    ? { teamAId: seller.teamId, teamBId: buyer.teamId, playersFromA: [sellerVet.playerId], playersFromB: [buyerYoung.playerId] }
    : { teamAId: buyer.teamId, teamBId: seller.teamId, playersFromA: [buyerYoung.playerId], playersFromB: [sellerVet.playerId] };

  // Close any shortfall with the pick (from the side that owes) whose value best matches it.
  const sides = evaluateTradeSides(league, extras, proposal);
  for (const side of [sides.a, sides.b]) {
    const shortfall = side.give - side.receive;
    if (shortfall <= side.give * 0.05) continue;
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
  return proposal;
}

export interface ExecutedAITrade {
  teamAId: string; teamAName: string; teamBId: string; teamBName: string;
  playersFromA: string[]; playersFromB: string[];
  picksFromA?: string[]; picksFromB?: string[];
}

/** Runs a handful of AI-vs-AI trade attempts (never involving the controlled team) and executes any that pass validateTrade. The league-wide tradeAIAggressiveness slider scales how many attempts/completions happen per call — higher means a livelier trade market. */
export function runTradeMarketAI(
  league: League,
  extras: GMLeagueExtras,
  controlledTeamId: string | null,
  seed = 1,
  maxTrades = 2,
): { league: League; extras: GMLeagueExtras; trades: ExecutedAITrade[] } {
  if (isTradeDeadlinePassed(league)) return { league, extras, trades: [] };
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
  for (const partnerId of shuffled) {
    const proposal = findAITrade(league, extras, controlledTeamId, partnerId);
    if (!proposal) continue;
    if (validateTrade(league, extras, proposal).valid) return proposal;
  }
  return null;
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
  const mood = refreshLeagueMorale(league, extras);
  const fa = runFreeAgencyAI(mood.league, mood.extras, controlledTeamId, seed);
  const trade = runTradeMarketAI(fa.league, fa.extras, controlledTeamId, seed + 1);

  let finalExtras = trade.extras;
  let newOfferGenerated = false;
  if (controlledTeamId && finalExtras.pendingTradeOffers.length === 0) {
    const offer = generateTradeOfferForControlledTeam(trade.league, finalExtras, controlledTeamId, seed + 2);
    if (offer) {
      finalExtras = { ...finalExtras, pendingTradeOffers: [...finalExtras.pendingTradeOffers, offer] };
      newOfferGenerated = true;
    }
  }

  return { league: trade.league, extras: finalExtras, signings: fa.signings, trades: trade.trades, newOfferGenerated, moraleEvents: mood.events };
}
