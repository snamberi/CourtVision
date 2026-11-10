import { defaultCoachTendencies, type League, type LeagueTeam } from './league';
import { simulateGame, type TeamInput } from './engine/game';
export interface Rotation50 { starters: string[]; minutes: Record<string, number> }
export interface LineupTestRequest50 { league: League; teamId: string; opponentId: string; a: Rotation50; b: Rotation50; games: number; seed: number }
export interface LineupTestResult50 { games: number; wins: number; points: number; allowed: number; rebounds: number; turnovers: number; shotQuality: number; endingFatigue: number }
export function initialRotation50(team: LeagueTeam): Rotation50 { return { starters: team.rotationOrder?.slice(0, 5) ?? [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target).slice(0, 5).map(p => p.playerId), minutes: Object.fromEntries(team.seasons.map(p => [p.playerId, p.minutes.target])) }; }
export function validateRotation50(team: LeagueTeam, rotation: Rotation50): void {
  if (rotation.starters.length !== 5 || new Set(rotation.starters).size !== 5 || rotation.starters.some(id => !team.seasons.some(p => p.playerId === id))) throw new Error('Choose five different starters from this team.');
  const values = team.seasons.map(p => rotation.minutes[p.playerId] ?? p.minutes.target);
  if (values.some(n => !Number.isFinite(n) || n < 0 || n > 60) || values.filter(n => n > 0).length < 5) throw new Error('Set valid minutes (0–60) for at least five players.');
}
export function lineupTestGame50(request: LineupTestRequest50, variant: 'a' | 'b', i: number): LineupTestResult50 {
  const { league, teamId, opponentId } = request, team = league.teams.find(t => t.teamId === teamId), opponent = league.teams.find(t => t.teamId === opponentId);
  if (!team || !opponent || teamId === opponentId) throw new Error('Choose two different teams.');
  const rotation = request[variant]; validateRotation50(team, rotation);
  const input: TeamInput = { ...team, rotationOrder: [...rotation.starters, ...team.seasons.map(p => p.playerId).filter(id => !rotation.starters.includes(id))],
    coach: { ...defaultCoachTendencies(), ...team.coach, autoRotation: false }, seasons: team.seasons.map(p => ({ ...p, rotationRole: rotation.starters.includes(p.playerId) ? 'starter' : 'bench', minutes: { mode: 'TARGET', target: rotation.minutes[p.playerId] ?? p.minutes.target } })) };
  const home = i % 2 === 0;
  const game = simulateGame({ home: home ? input : opponent, away: home ? opponent : input, settings: { ...league.settings, injuriesEnabled: false, seed: request.seed + i }, rules: league.rulesSettings });
  const box = home ? game.homeBox : game.awayBox, own = home ? game.homeScore : game.awayScore, other = home ? game.awayScore : game.homeScore;
  const shots = game.possessionLog.filter(e => e.offenseTeamId === teamId && typeof e.debug?.makeProbability === 'number');
  const fatigue = Object.values(box.players).filter(p => p.minutes > 0).map(p => game.endingFatigue50?.[p.playerId] ?? 0);
  return { games: 1, wins: Number(own > other), points: own, allowed: other,
    rebounds: Object.values(box.players).reduce((n, p) => n + p.oreb + p.dreb, 0), turnovers: Object.values(box.players).reduce((n, p) => n + p.tov, 0),
    shotQuality: shots.length ? shots.reduce((n, e) => n + Number(e.debug!.makeProbability), 0) / shots.length * 100 : 0,
    endingFatigue: fatigue.length ? fatigue.reduce((a, b) => a + b, 0) / fatigue.length * 100 : 0 };
}
export function summarizeLineupTest50(rows: LineupTestResult50[]): LineupTestResult50 {
  const n = Math.max(1, rows.length), sum = (key: keyof LineupTestResult50) => rows.reduce((s, r) => s + r[key], 0);
  return { games: rows.length, wins: sum('wins'), points: sum('points') / n, allowed: sum('allowed') / n, rebounds: sum('rebounds') / n, turnovers: sum('turnovers') / n, shotQuality: sum('shotQuality') / n, endingFatigue: sum('endingFatigue') / n };
}
