import type { League, LeagueTeam } from './league';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { emptyStatLine } from './boxscore';
import { getRotationOrder, primaryPosition } from './teamStatus';

export interface RotationChange {
  playerId: string;
  fromMinutes: number;
  toMinutes: number;
  reason: string;
}
export interface RotationReview {
  season: string;
  gamesReviewed: number;
  windowGames: number;
  changes: RotationChange[];
  summary: string;
}
export const rotationReviewInterval = (team: LeagueTeam) => Math.max(5, Math.min(10, Math.round(team.coach?.rotationReviewInterval ?? 7)));

function systemFit(s: PlayerSeason, team: LeagueTeam): number {
  const { offense: o, defense: d } = s.attributes;
  const system = team.coach?.offensiveSystem;
  const attack = system === 'pace-space' ? (o.threePoint + s.attributes.physical.speed) / 2
    : system === 'post' ? (o.postControl + o.closeShot) / 2
    : system === 'motion' ? (o.passing + o.catchAndShoot) / 2
    : system === 'pick-roll' ? (o.passing + o.ballHandling + o.finishing) / 3 : o.offensiveIQ;
  const defense = team.coach?.defensiveScheme === 'zone' ? d.interiorDefense
    : team.coach?.defensiveScheme === 'pressure' ? d.steal
    : team.coach?.defensiveScheme === 'switch' ? (d.perimeterDefense + d.interiorDefense) / 2 : d.defensiveIQ;
  return (attack + defense) / 2;
}

/** Review only completed regular-season boxes, never aggregate playoff stats or guessed age/ratings-only form. */
/** Minutes a coach gives each spot on a talent-ranked depth chart (1st best player first). */
const MINUTES_BY_TALENT_RANK = [34, 33, 31, 29, 27, 22, 19, 16, 12, 9];

/**
 * Talent check that runs after every game: a player who is among the team's eight best by Overall but is buried
 * (outside the rotation, or given far fewer minutes than his rank earns) is moved up and given fitting minutes.
 * Players joining a new team (signings, trades, draft) otherwise keep their old minutes target and can sit all season,
 * because the regular review only promotes players with recent minutes. Manual minutes plans are never touched.
 */
export function ensureTalentInRotation(team: LeagueTeam, injuries?: League['injuries']): LeagueTeam {
  if (team.coach?.rotationPolicy?.mode === 'fixed' || team.coach?.autoRotation === false) return team;
  const healthy = team.seasons.filter(s => !((injuries?.[s.playerId]?.gamesRemaining ?? 0) > 0));
  const ranked = [...healthy].sort((a, b) => calculateOverall(b) - calculateOverall(a) || a.playerId.localeCompare(b.playerId));
  const depth = Math.max(5, Math.min(team.seasons.length, team.coach?.rotationDepth ?? 10));
  let order = getRotationOrder(team);
  const changes: RotationChange[] = [];
  const targets = new Map(team.seasons.map(s => [s.playerId, s.minutes.target]));
  ranked.slice(0, 8).forEach((p, rank) => {
    if (p.minutes.mode !== 'AI' || p.minutes.baselineTarget != null || p.rotationRole === 'bench') return;
    const fair = MINUTES_BY_TALENT_RANK[rank];
    const index = order.indexOf(p.playerId);
    const buried = index >= depth || index > rank + 4;
    const underused = p.minutes.target < fair - 10;
    if (!buried && !underused) return;
    if (buried) { order = order.filter(id => id !== p.playerId); order.splice(Math.min(rank, order.length), 0, p.playerId); }
    const target = Math.max(p.minutes.target, fair - 4);
    changes.push({ playerId: p.playerId, fromMinutes: p.minutes.target, toMinutes: target, reason: 'Too good to sit: moved into the rotation on talent.' });
    targets.set(p.playerId, target);
  });
  if (!changes.length) return team;
  return {
    ...team, rotationOrder: order,
    seasons: team.seasons.map(s => targets.get(s.playerId) !== s.minutes.target ? { ...s, minutes: { ...s.minutes, target: targets.get(s.playerId)! } } : s),
    rotationReview: team.rotationReview ? { ...team.rotationReview, changes: [...changes, ...team.rotationReview.changes].slice(0, 20) } : team.rotationReview,
  };
}

export function reviewTeamRotation(rawTeam: LeagueTeam, league: League): LeagueTeam {
  if (rawTeam.coach?.rotationPolicy?.mode === 'fixed' || rawTeam.coach?.autoRotation === false || (league.seasonPhase ?? 'regular_season') !== 'regular_season') return rawTeam;
  const team = ensureTalentInRotation(rawTeam, league.injuries);
  const games = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === team.teamId || g.awayTeamId === team.teamId));
  const cadence = rotationReviewInterval(team);
  const season = league.season ?? team.seasons[0]?.season ?? '';
  const previous = team.rotationReview?.season === season ? team.rotationReview.gamesReviewed : 0;
  if (games.length - previous < cadence) return team;
  const recent = games.slice(-cadence);
  const gameMinutes = league.settings.era.numberOfQuarters * league.settings.era.quarterLengthMinutes;
  const metrics = new Map(team.seasons.map(s => {
    const totals = emptyStatLine(s.playerId);
    let appearances = 0;
    for (const g of recent) {
      const box = g.result!.homeTeamId === team.teamId ? g.result!.homeBox : g.result!.awayBox;
      const line = box.players[s.playerId];
      if (!line || line.minutes <= 0) continue;
      appearances++;
      for (const key of ['minutes', 'points', 'ast', 'oreb', 'dreb', 'stl', 'blk', 'tov', 'fga', 'fta'] as const) totals[key] += line[key];
    }
    const reliable = appearances >= 3 && totals.minutes >= gameMinutes;
    const production = totals.minutes > 0 ? (totals.points + .7 * (totals.oreb + totals.dreb) + totals.ast + totals.stl + totals.blk - 1.3 * totals.tov) * 36 / totals.minutes : 0;
    const ts = totals.fga + .44 * totals.fta > 0 ? totals.points / (2 * (totals.fga + .44 * totals.fta)) : .5;
    const workload = appearances ? totals.minutes / appearances / gameMinutes : 0;
    // Workload is a fatigue proxy from actual minutes, with stamina-dependent tolerance.
    const fatigue = league.settings.fatigueEnabled ? Math.max(0, workload - (.55 + s.attributes.physical.stamina / 400)) * 35 : 0;
    const confidence = Math.min(1, totals.minutes / (gameMinutes * 2));
    const developmentBonus = team.coach?.rotationPolicy?.mode==='development' && s.age<=24 ? 2 : 0;
    const score = developmentBonus + calculateOverall(s) * .14 + systemFit(s, team) * .05 + confidence * (production * .55 + Math.max(-4, Math.min(4, (ts - .52) * 14))) - fatigue;
    const injured = (league.injuries?.[s.playerId]?.gamesRemaining ?? 0) > 0;
    return [s.playerId, { score, fatigue, reliable, eligible: reliable && !injured && s.minutes.mode === 'AI' && s.minutes.baselineTarget == null && !team.coach?.rotationPolicy?.starters.includes(s.playerId) }];
  }));
  const order = getRotationOrder(team);
  const byId = new Map(team.seasons.map(s => [s.playerId, s]));
  // Match the engine's explicit starter/bench precedence before changing the depth chart.
  order.sort((a, b) => {
    const rank = (id: string) => byId.get(id)?.rotationRole === 'starter' ? -1 : byId.get(id)?.rotationRole === 'bench' ? 1 : 0;
    return rank(a) - rank(b);
  });
  const oldStarters = new Set(order.slice(0, 5));
  const explanations = new Map<string, string>();
  const benches = order.slice(5).filter(id => metrics.get(id)?.eligible).sort((a, b) => metrics.get(b)!.score - metrics.get(a)!.score);
  for (const challenger of team.coach?.rotationPolicy?.allowStarterChanges === false ? [] : benches) {
    const candidate = byId.get(challenger)!;
    const replaceable = order.slice(0, 5).filter(id => {
      const starter = byId.get(id)!;
      return metrics.get(id)?.eligible && (primaryPosition(starter) === primaryPosition(candidate) || candidate.positions[primaryPosition(starter)] >= 60);
    }).sort((a, b) => metrics.get(a)!.score - metrics.get(b)!.score);
    const incumbent = replaceable[0];
    if (incumbent && metrics.get(challenger)!.score > metrics.get(incumbent)!.score + 3 && metrics.get(challenger)!.fatigue < 3) {
      const a = order.indexOf(challenger), b = order.indexOf(incumbent);
      [order[a], order[b]] = [order[b], order[a]];
      explanations.set(challenger, 'Promoted after strong bench performances and a good fit in the starting lineup.');
      explanations.set(incumbent, 'Moved to the bench after a teammate outperformed this role over the review window.');
      break; // Limit churn: at most one starting-lineup change per review.
    }
  }
  const targets = new Map(team.seasons.map(s => [s.playerId, s.minutes.target]));
  const depth = Math.max(5, Math.min(team.seasons.length, team.coach?.rotationDepth ?? 10));
  const movable = order.slice(0, depth).filter(id => metrics.get(id)?.eligible);
  const ranked = [...movable].sort((a, b) => metrics.get(b)!.score - metrics.get(a)!.score);
  // Transfer small amounts instead of resetting everyone's minutes; retain the full budget and manual plans.
  const used = new Set<string>();
  for (const recipient of ranked) {
    if (used.has(recipient) || metrics.get(recipient)!.fatigue >= 3) continue;
    const donor = [...ranked].reverse().find(id => !used.has(id) && id !== recipient && metrics.get(recipient)!.score > metrics.get(id)!.score + 2);
    if (!donor) continue;
    const receiver = byId.get(recipient)!, giver = byId.get(donor)!;
    const amount = Math.max(0, Math.min(3, (receiver.minutes.max ?? gameMinutes * .85) - targets.get(recipient)!, targets.get(donor)! - (giver.minutes.min ?? 6)));
    if (amount < .5) continue;
    targets.set(recipient, Math.round((targets.get(recipient)! + amount) * 10) / 10);
    targets.set(donor, Math.round((targets.get(donor)! - amount) * 10) / 10);
    used.add(recipient); used.add(donor);
    if (!explanations.has(recipient)) explanations.set(recipient, 'Earned more minutes through recent production, efficiency and team fit.');
    if (!explanations.has(donor)) explanations.set(donor, metrics.get(donor)!.fatigue >= 3 ? 'Minutes reduced to ease fatigue after a heavy recent workload.' : 'Minutes trimmed after less effective recent performances.');
  }
  const starters = new Set(order.slice(0, 5));
  const changes: RotationChange[] = [];
  const seasons = team.seasons.map(s => {
    const reason = explanations.get(s.playerId);
    if (!reason) return s;
    const target = targets.get(s.playerId)!;
    changes.push({ playerId: s.playerId, fromMinutes: s.minutes.target, toMinutes: target, reason });
    return { ...s, minutes: { ...s.minutes, target }, rotationRole: starters.has(s.playerId) !== oldStarters.has(s.playerId) ? (starters.has(s.playerId) ? 'starter' : 'bench') as 'starter' | 'bench' : s.rotationRole };
  });
  return { ...team, seasons, rotationOrder: order, rotationReview: { season, gamesReviewed: games.length, windowGames: recent.length, changes,
    summary: changes.length ? `Reviewed production, shooting efficiency, workload and system fit over the last ${recent.length} games.` : 'Rotation retained. No sustained performance advantage among available AI-minute players with enough playing time.' } };
}
