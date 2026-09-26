import type { League, LeagueTeam } from './league';
import { computeStandings } from './league';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';

/*
 * The franchise as a business: ticket prices, arena upgrades and jersey sales. Attendance follows winning, fan
 * mood, star power, market and price; stars sell jerseys; upgrades cost money over five seasons and pay back in
 * seats, atmosphere and player development. Only teams with a business plan (yours, once you open it) use this
 * model for their revenue; everyone else keeps the league's standard revenue.
 */

export type Upgrade = 'seats' | 'scoreboard' | 'practice';
export interface BusinessPlan {
  ticketPrice: number;
  arena: Record<Upgrade, number>; // levels 0-3
  /** Upgrades still being paid off: annual payment and seasons left. */
  loans: { upgrade: Upgrade; annual: number; seasonsLeft: number }[];
}

export const HOME_GAMES = 41;
const BASE_CAPACITY = 17_500;
/** Luxury suites, courtside and premium seats: the average seat earns this multiple of the listed price. */
const PREMIUM = 1.95;
const JERSEY_PRICE = 110, JERSEY_SHARE = 0.3;
export const MAX_LEVEL = 3;
export const UPGRADES: Record<Upgrade, { label: string; cost: [number, number, number]; effect: string }> = {
  seats: { label: 'Seating expansion', cost: [30_000_000, 45_000_000, 65_000_000], effect: '+1,000 seats a level' },
  scoreboard: { label: 'Video board & sound', cost: [15_000_000, 25_000_000, 40_000_000], effect: 'Louder building: +4% ticket demand a level; fans warm up faster' },
  practice: { label: 'Practice facility', cost: [25_000_000, 40_000_000, 60_000_000], effect: 'Player morale +2 and development +2% a level' },
};

export function referencePrice(team: Pick<LeagueTeam, 'marketSize'>, winPct: number): number {
  return Math.round(45 + (team.marketSize ?? 50) * 0.5 + winPct * 25);
}
export function defaultBusiness(team: LeagueTeam, winPct = 0.5): BusinessPlan {
  return { ticketPrice: referencePrice(team, winPct), arena: { seats: 0, scoreboard: 0, practice: 0 }, loans: [] };
}
export const businessOf = (team: LeagueTeam, winPct = 0.5): BusinessPlan => team.business ?? defaultBusiness(team, winPct);
export const capacity = (plan: BusinessPlan) => BASE_CAPACITY + plan.arena.seats * 1000;

/** Star power: how much the roster's best players draw (0 = nobody, ~1 = a superstar and a co-star). */
export function starPower(team: LeagueTeam): number {
  const top = team.seasons.map(calculateOverall).sort((a, b) => b - a).slice(0, 3);
  return top.reduce((n, o, i) => n + Math.max(0, o - 68) / (i === 0 ? 14 : 28), 0);
}

export interface Gate { price: number; capacity: number; fill: number; attendance: number; ticketRevenue: number }
/** Tickets for a season at this price. */
export function gate(team: LeagueTeam, winPct: number, fans: number, price = businessOf(team, winPct).ticketPrice): Gate {
  const plan = businessOf(team, winPct);
  const market = ((team.marketSize ?? 50) - 50) / 250;
  const want = 0.6 + (winPct - 0.5) * 0.7 + (fans - 55) / 220 + starPower(team) * 0.08 + market + plan.arena.scoreboard * 0.04;
  const elasticity = Math.pow(price / referencePrice(team, winPct), -1.25);
  const fill = Math.max(0.3, Math.min(1, want * elasticity));
  const cap = capacity(plan);
  const attendance = Math.round(cap * fill);
  return { price, capacity: cap, fill, attendance, ticketRevenue: attendance * price * HOME_GAMES * PREMIUM };
}

export interface JerseySale { playerId: string; units: number; revenue: number }
/** Jersey sales for a season: stars sell, winning and happy fans sell more, a bigger market sells more. */
export function jerseySales(team: LeagueTeam, winPct: number, fans: number): JerseySale[] {
  const custom = team.identity?.logo ? 1.05 : 1; // a crest of your own on the shirt
  const factor = (0.7 + winPct * 0.6) * (0.8 + fans / 250) * (0.6 + (team.marketSize ?? 50) / 125) * custom;
  return team.seasons.map((p: PlayerSeason) => {
    const ppg = p.seasonStats && p.seasonStats.gamesPlayed ? p.seasonStats.points / p.seasonStats.gamesPlayed : 0;
    const units = Math.round((Math.max(0, calculateOverall(p) - 55) ** 2 * 380 + ppg * 1500) * factor);
    return { playerId: p.playerId, units, revenue: units * JERSEY_PRICE * JERSEY_SHARE };
  }).filter(s => s.units > 0).sort((a, b) => b.units - a.units);
}

/** Team gear, caps and everything that isn't a player's jersey. */
export const baseMerch = (team: LeagueTeam, winPct: number) => 22_000_000 * (0.4 + (team.marketSize ?? 50) / 100 * 1.2) * (0.85 + winPct * 0.3);
export const loanPayments = (plan: BusinessPlan) => plan.loans.reduce((n, l) => n + l.annual, 0);

/** Buys the next level of an upgrade, financed over five seasons. */
export function buyUpgrade(team: LeagueTeam, upgrade: Upgrade, winPct = 0.5): LeagueTeam | null {
  const plan = businessOf(team, winPct);
  const level = plan.arena[upgrade];
  if (level >= MAX_LEVEL) return null;
  const cost = UPGRADES[upgrade].cost[level];
  return { ...team, business: { ...plan, arena: { ...plan.arena, [upgrade]: level + 1 }, loans: [...plan.loans, { upgrade, annual: Math.round(cost / 5), seasonsLeft: 5 }] } };
}
export const setTicketPrice = (team: LeagueTeam, price: number, winPct = 0.5): LeagueTeam =>
  ({ ...team, business: { ...businessOf(team, winPct), ticketPrice: Math.max(20, Math.min(300, Math.round(price))) } });

/** A season ends: one loan payment is made on every upgrade. */
export function rollBusinessSeason(team: LeagueTeam): LeagueTeam {
  if (!team.business) return team;
  return { ...team, business: { ...team.business, loans: team.business.loans.map(l => ({ ...l, seasonsLeft: l.seasonsLeft - 1 })).filter(l => l.seasonsLeft > 0) } };
}

/** Fan-mood drift per home game from pricing: gouging sours them, bargains win them over. */
export function priceMoodDrift(team: LeagueTeam, winPct: number): number {
  if (!team.business) return 0;
  const ratio = team.business.ticketPrice / referencePrice(team, winPct);
  return Math.max(-0.6, Math.min(0.3, (1 - ratio) * 0.8)) + team.business.arena.scoreboard * 0.05;
}

/** Share of seats filled for a team's home games, for drawing the crowd. */
export function crowdFill(league: League, teamId: string): number {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return 1;
  const winPct = computeStandings(league).find(r => r.teamId === teamId)?.winPct ?? 0.5;
  return gate(team, winPct, league.press?.fans ?? 55).fill;
}

export interface BusinessRevenue { tickets: number; merch: number; jerseys: number; loans: number }
/** The ticket and merchandise revenue this model produces for a team with a plan. */
export function businessRevenue(team: LeagueTeam, winPct: number, fans: number): BusinessRevenue {
  const jerseys = jerseySales(team, winPct, fans).reduce((n, s) => n + s.revenue, 0);
  return { tickets: gate(team, winPct, fans).ticketRevenue, merch: baseMerch(team, winPct) + jerseys, jerseys, loans: loanPayments(businessOf(team, winPct)) };
}
