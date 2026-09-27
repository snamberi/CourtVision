import type { League } from '../simulation/league';
import type { TeamBoxScore } from '../simulation/boxscore';

/*
 * Daily goals for the GM game: three small goals a day (the same three for everyone, new at 00:00 UTC), met by games
 * your team plays in any official league that day. Only games played after the goals were first seen count, so a
 * season simulated yesterday doesn't finish today's goals. Finished goals pay GM Profile XP (see profile.ts).
 */

export interface GoalDef { id: string; text: string; target: number; xp: number; kind: 'count' | 'streak' | 'once' }
export const GOALS: GoalDef[] = [
  { id: 'win3', text: 'Win 3 games', target: 3, xp: 50, kind: 'count' },
  { id: 'win5', text: 'Win 5 games', target: 5, xp: 75, kind: 'count' },
  { id: 'streak3', text: 'Win 3 games in a row', target: 3, xp: 75, kind: 'streak' },
  { id: 'blowout', text: 'Win a game by 20 or more', target: 1, xp: 60, kind: 'once' },
  { id: 'forty', text: 'A player of yours scores 40+', target: 1, xp: 75, kind: 'once' },
  { id: 'tripleDouble', text: 'Record a triple-double', target: 1, xp: 100, kind: 'once' },
  { id: 'boards', text: 'A player grabs 15+ rebounds', target: 1, xp: 50, kind: 'once' },
  { id: 'dimes', text: 'Your team hands out 30+ assists', target: 1, xp: 60, kind: 'once' },
  { id: 'steals', text: 'Your team gets 12+ steals', target: 1, xp: 60, kind: 'once' },
  { id: 'lockdown', text: 'Hold an opponent under 95 points', target: 1, xp: 75, kind: 'once' },
  { id: 'points', text: 'Score 130+ in a win', target: 1, xp: 60, kind: 'once' },
  { id: 'clutch', text: 'Win a game by 3 or fewer', target: 1, xp: 50, kind: 'once' },
];
export const ALL_DONE_BONUS = 50;

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);
function seedOf(date: string): number { let h = 2166136261; for (const ch of `daily-goals|${date}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** The day's three goals: one win-count goal, then two different game feats. */
export function goalsFor(date: string): GoalDef[] {
  let s = seedOf(date);
  const next = (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; };
  const wins = GOALS.filter(g => g.kind !== 'once'), feats = GOALS.filter(g => g.kind === 'once');
  const first = wins[next(wins.length)];
  const a = feats[next(feats.length)];
  let b = feats[next(feats.length)];
  if (b.id === a.id) b = feats[(feats.indexOf(a) + 1) % feats.length];
  return [first, a, b];
}

export interface GoalProgress { id: string; progress: number; done: boolean }
export interface DailyState { date: string; goals: GoalProgress[]; streak: number; baseline: Record<string, string[]>; counted: string[]; bonus: boolean }
const KEY = 'cv-daily-goals';
const HISTORY_KEY = 'cv-daily-history';
export const DAILY_EVENT = 'courtvision:daily-goals';

export function loadDaily(date = todayUtc()): DailyState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DailyState | null;
    if (s && s.date === date) return s;
  } catch { /* fresh day */ }
  return { date, goals: goalsFor(date).map(g => ({ id: g.id, progress: 0, done: false })), streak: 0, baseline: {}, counted: [], bonus: false };
}
function saveDaily(s: DailyState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}') as Record<string, { done: number; xp: number }>;
    const done = s.goals.filter(g => g.done);
    hist[s.date] = { done: done.length, xp: done.reduce((n, g) => n + (GOALS.find(d => d.id === g.id)?.xp ?? 0), 0) + (s.bonus ? ALL_DONE_BONUS : 0) };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    window.dispatchEvent(new Event(DAILY_EVENT));
  } catch { /* storage blocked */ }
}

export function dailyGoalXp(): { xp: number; done: number; days: number } {
  try {
    const hist = Object.values(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}') as Record<string, { done: number; xp: number }>);
    return { xp: hist.reduce((n, h) => n + h.xp, 0), done: hist.reduce((n, h) => n + h.done, 0), days: hist.filter(h => h.done).length };
  } catch { return { xp: 0, done: 0, days: 0 }; }
}

interface MyGame { key: string; won: boolean; margin: number; mine: TeamBoxScore; theirs: TeamBoxScore }
function myGames(league: League, teamId: string): MyGame[] {
  const out: MyGame[] = [];
  for (const g of league.schedule) {
    if (!g.played || !g.result || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue;
    const home = g.homeTeamId === teamId, r = g.result;
    const mine = home ? r.homeBox : r.awayBox, theirs = home ? r.awayBox : r.homeBox;
    const my = home ? r.homeScore : r.awayScore, their = home ? r.awayScore : r.homeScore;
    out.push({ key: `${league.season ?? ''}:${g.id}`, won: my > their, margin: my - their, mine, theirs });
  }
  return out;
}

const lines = (b: TeamBoxScore) => Object.values(b.players);
function meets(id: string, g: MyGame): boolean {
  switch (id) {
    case 'blowout': return g.won && g.margin >= 20;
    case 'forty': return lines(g.mine).some(l => l.points >= 40);
    case 'tripleDouble': return lines(g.mine).some(l => [l.points, l.oreb + l.dreb, l.ast, l.stl, l.blk].filter(v => v >= 10).length >= 3);
    case 'boards': return lines(g.mine).some(l => l.oreb + l.dreb >= 15);
    case 'dimes': return lines(g.mine).reduce((n, l) => n + l.ast, 0) >= 30;
    case 'steals': return lines(g.mine).reduce((n, l) => n + l.stl, 0) >= 12;
    case 'lockdown': return g.theirs.points < 95;
    case 'points': return g.won && g.mine.points >= 130;
    case 'clutch': return g.won && g.margin <= 3;
    default: return false;
  }
}

/**
 * Counts the games your team has played since the goals were first seen in this league today. Returns the goals
 * finished by this update (for a toast), or an empty list.
 */
export function updateDailyGoals(saveId: string, league: League, teamId: string, official: boolean, date = todayUtc()): GoalDef[] {
  const s = loadDaily(date);
  const games = myGames(league, teamId);
  const baseKey = `${saveId}|${teamId}`;
  if (!s.baseline[baseKey]) { s.baseline[baseKey] = games.map(g => g.key); saveDaily(s); return []; }
  const seen = new Set([...s.baseline[baseKey], ...s.counted.filter(k => k.startsWith(`${baseKey}|`)).map(k => k.slice(baseKey.length + 1))]);
  const fresh = games.filter(g => !seen.has(g.key));
  if (!fresh.length) return [];
  const finished: GoalDef[] = [];
  for (const g of fresh) {
    s.counted.push(`${baseKey}|${g.key}`);
    if (!official) continue; // Sandbox and God Mode leagues don't pay out
    s.streak = g.won ? s.streak + 1 : 0;
    for (const p of s.goals) {
      if (p.done) continue;
      const def = GOALS.find(d => d.id === p.id);
      if (!def) continue;
      if (def.kind === 'count' && g.won) p.progress++;
      else if (def.kind === 'streak') p.progress = Math.max(p.progress, s.streak);
      else if (def.kind === 'once' && meets(def.id, g)) p.progress = 1;
      if (p.progress >= def.target) { p.done = true; finished.push(def); }
    }
  }
  if (s.goals.every(g => g.done)) s.bonus = true;
  s.counted = s.counted.slice(-600);
  saveDaily(s);
  return finished;
}
