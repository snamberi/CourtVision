import type { League } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import { calculateOverall } from './engine/overall';
import { lockerRoom } from './personality';
import { rivalryTable } from './rivalry';
import { hotSeats } from './coachingCarousel';
import { priceMoodDrift } from './business';

/*
 * The press room. After big wins, bad losses, streaks, huge scoring nights, trade requests and playoff series, the
 * media wants a word. Each answer moves the locker room (player morale), the owner's patience (job security) and
 * the fans (fan mood, which the business side of the franchise feels too). "Around the League" is a weekly segment
 * built from what actually happened in this league.
 */

export type PressKind = 'bigWin' | 'badLoss' | 'winStreak' | 'losingStreak' | 'starGame' | 'tradeRequest' | 'seriesWon' | 'eliminated';
export interface PressEffects { fans?: number; owner?: number; team?: number; player?: number }
export interface PressAnswer { id: string; text: string; effects: PressEffects; tone: string }
export interface PressConference { id: string; season: string; kind: PressKind; question: string; context: string; subjectPlayerId?: string; answers: PressAnswer[] }
export interface PressRecord { id: string; season: string; kind: PressKind; question: string; answer: string; tone: string }
export interface PressState {
  season: string;
  /** 0-100; starts at 55. */
  fans: number;
  pending: PressConference[];
  log: PressRecord[];
  /** Morale shift from what you said, by player (decays game by game). */
  playerMood: Record<string, number>;
  /** How many of your team's games have been looked at, and which one-off topics were already asked about. */
  gamesSeen: number;
  asked: string[];
  /** Conferences that went unanswered ("no comment") in the latest update, for one summary message. */
  lastSkipped?: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const MAX_PENDING = 3;
/** Fan-mood cost of a press conference that went unanswered. */
export const NO_COMMENT_FANS = 1;
const short = (id: string) => id.split(' ').slice(-1)[0];

function answersFor(kind: PressKind, subject?: string): PressAnswer[] {
  const s = subject ? short(subject) : '';
  switch (kind) {
    case 'bigWin': return [
      { id: 'group', tone: 'Team-first', text: 'That was a whole-group effort. Everybody who stepped on the floor contributed.', effects: { team: 3, fans: 1 } },
      { id: 'statement', tone: 'Bold', text: 'That was a statement. People around the league should take notice.', effects: { fans: 4, team: 1, owner: 1 } },
      { id: 'humble', tone: 'Humble', text: "We haven't done anything yet. It's one win; we go back to work tomorrow.", effects: { owner: 2, fans: -1 } },
    ];
    case 'badLoss': return [
      { id: 'onme', tone: 'Accountable', text: "That one is on me. I didn't have them ready, and I'll fix it.", effects: { team: 3, owner: -1 } },
      { id: 'callout', tone: 'Fiery', text: 'That effort was unacceptable. If guys won\'t compete, changes are coming.', effects: { team: -4, fans: 3, owner: 2 } },
      { id: 'move', tone: 'Calm', text: "One bad night. We flush it and move on.", effects: { fans: -2, team: 1 } },
    ];
    case 'winStreak': return [
      { id: 'best', tone: 'Bold', text: "We're the team to beat right now, and we know it.", effects: { fans: 4, team: 2, owner: 1 } },
      { id: 'one', tone: 'Steady', text: 'One game at a time. Streaks end; habits last.', effects: { team: 2, owner: 1 } },
      { id: 'fans', tone: 'Grateful', text: "This building has been incredible. The fans are carrying us.", effects: { fans: 5 } },
    ];
    case 'losingStreak': return [
      { id: 'course', tone: 'Steady', text: 'We trust the process. Stay the course; this group will turn it around.', effects: { team: 3, owner: -2, fans: -2 } },
      { id: 'table', tone: 'Ruthless', text: 'Everything is on the table: minutes, the rotation, the roster.', effects: { team: -3, owner: 3, fans: 2 } },
      { id: 'excuse', tone: 'Deflecting', text: "Look at the schedule and the injuries. We're not that far off.", effects: { fans: -3, team: 1, owner: -1 } },
    ];
    case 'starGame': return [
      { id: 'best', tone: 'Superlative', text: `${s} is the best player in this league. Nobody can guard him.`, effects: { player: 6, team: -1, fans: 2 } },
      { id: 'all', tone: 'Team-first', text: `Great night for ${s}, but it takes all of us, and the guys set him up.`, effects: { team: 2, player: 1 } },
      { id: 'more', tone: 'Confident', text: `Get used to it. There's more of that coming from ${s}.`, effects: { fans: 3, player: 3 } },
    ];
    case 'tradeRequest': return [
      { id: 'future', tone: 'Supportive', text: `${s} is a big part of our future. We'll sit down and work it out.`, effects: { player: 8, owner: -1 } },
      { id: 'best', tone: 'Neutral', text: "We'll always do what's best for the team. That's all I'll say.", effects: { player: -2, owner: 1 } },
      { id: 'bigger', tone: 'Hard-line', text: 'Nobody is bigger than this franchise.', effects: { player: -8, team: 1, fans: 2, owner: 1 } },
    ];
    case 'seriesWon': return [
      { id: 'next', tone: 'Focused', text: 'Enjoy it tonight. Tomorrow we start on the next one.', effects: { team: 2, owner: 1 } },
      { id: 'city', tone: 'Grateful', text: 'This one is for the city. Our fans deserve this.', effects: { fans: 5 } },
      { id: 'title', tone: 'Bold', text: "We didn't come this far to stop. We're winning the whole thing.", effects: { fans: 3, team: 2, owner: 1 } },
    ];
    case 'eliminated': return [
      { id: 'proud', tone: 'Proud', text: "I'm proud of this group. We'll be back, and we'll be better.", effects: { team: 3, fans: 1, owner: -1 } },
      { id: 'notenough', tone: 'Ruthless', text: "Not good enough. This summer, we make changes.", effects: { owner: 3, team: -3, fans: 1 } },
      { id: 'credit', tone: 'Gracious', text: 'Credit to them. They were the better team.', effects: { fans: -1, owner: 1 } },
    ];
  }
}

const QUESTIONS: Record<PressKind, (ctx: string, subject?: string) => string> = {
  bigWin: ctx => `Coach, ${ctx}. What did you see out there tonight?`,
  badLoss: ctx => `Coach, ${ctx}. What happened?`,
  winStreak: ctx => `That's ${ctx}. Is this the best team in the league?`,
  losingStreak: ctx => `That's ${ctx}. Is your job safe, and what changes?`,
  starGame: (ctx, s) => `${s} ${ctx}. Where does he rank in this league?`,
  tradeRequest: (_, s) => `Reports say ${s} has asked for a trade. Will you move him?`,
  seriesWon: ctx => `${ctx}! What does this series win mean?`,
  eliminated: ctx => `${ctx}. What's your message to the fans?`,
};

function conference(league: League, kind: PressKind, key: string, context: string, subject?: string): PressConference {
  return { id: `${league.season}:${key}`, season: league.season ?? '', kind, context, subjectPlayerId: subject, question: QUESTIONS[kind](context, subject), answers: answersFor(kind, subject) };
}

export function pressState(league: League): PressState {
  const p = league.press;
  if (p && p.season === league.season) return p;
  return { season: league.season ?? '', fans: p?.fans ?? 55, pending: [], log: p?.log.slice(-20) ?? [], playerMood: {}, gamesSeen: 0, asked: [] };
}

/**
 * Looks at your newly played games (and trade requests / finished playoff series) and queues press conferences.
 * Returns the same league object when there's nothing new, so it's safe to call after every change.
 */
export function collectPress(league: League, userTeamId: string | null): League {
  if (!userTeamId || !league.teams.some(t => t.teamId === userTeamId)) return league;
  const state = pressState(league);
  const games = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
  const team = league.teams.find(t => t.teamId === userTeamId)!;
  const found: PressConference[] = [];
  const asked = new Set(state.asked);
  const mood = { ...state.playerMood };
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r]));
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;

  // New games since last look.
  let streak = 0;
  let fans = state.fans;
  const usWinPct = standings.get(userTeamId)?.winPct ?? 0.5;
  const results = games.map(g => { const home = g.homeTeamId === userTeamId, r = g.result!; const us = home ? r.homeScore : r.awayScore, them = home ? r.awayScore : r.homeScore; return { g, home, us, them, won: us > them, opp: home ? g.awayTeamId : g.homeTeamId }; });
  for (let i = state.gamesSeen; i < results.length; i++) {
    const x = results[i];
    streak = 0;
    for (let j = i; j >= 0 && results[j].won === x.won; j--) streak++;
    for (const k of Object.keys(mood)) { mood[k] *= 0.94; if (Math.abs(mood[k]) < 0.3) delete mood[k]; }
    // Fans warm to winning and sour on losing; ticket prices move them too at home games.
    fans = clamp(fans + (x.won ? 0.35 : -0.35) + (x.home ? priceMoodDrift(team, usWinPct) : 0));
    const margin = x.us - x.them;
    const box = x.home ? x.g.result!.homeBox : x.g.result!.awayBox;
    const star = Object.values(box?.players ?? {}).sort((a, b) => b.points - a.points)[0];
    const oppRow = standings.get(x.opp), usRow = standings.get(userTeamId);
    if (star && star.points >= 40) found.push(conference(league, 'starGame', `star:${x.g.id}`, `dropped ${star.points} on ${name(x.opp)}`, star.playerId));
    else if (x.won && streak >= 6 && [6, 10, 15].includes(streak)) found.push(conference(league, 'winStreak', `ws:${x.g.id}`, `${streak} straight wins`));
    else if (!x.won && [4, 7, 10].includes(streak)) found.push(conference(league, 'losingStreak', `ls:${x.g.id}`, `${streak} losses in a row`));
    else if (margin >= 20 || (x.won && oppRow && usRow && oppRow.winPct - usRow.winPct >= 0.15)) found.push(conference(league, 'bigWin', `w:${x.g.id}`, `a ${x.us}-${x.them} win over ${name(x.opp)}`));
    else if (margin <= -20 || (!x.won && oppRow && usRow && usRow.winPct - oppRow.winPct >= 0.2)) found.push(conference(league, 'badLoss', `l:${x.g.id}`, `a ${x.us}-${x.them} loss to ${name(x.opp)}`));
  }
  // Trade requests on your team.
  for (const p of team.seasons) if (p.morale?.tradeRequest === league.season && !asked.has(`tr:${p.playerId}`)) { asked.add(`tr:${p.playerId}`); found.push(conference(league, 'tradeRequest', `tr:${p.playerId}`, '', p.playerId)); }
  // Playoff series that just ended for you.
  for (const [ri, round] of (league.playoffBracket?.rounds ?? []).entries()) for (const s of round) {
    if (!s.winnerTeamId || (s.teamAId !== userTeamId && s.teamBId !== userTeamId)) continue;
    const key = `po:${ri}:${s.teamAId}:${s.teamBId}`;
    if (asked.has(key)) continue;
    asked.add(key);
    const opp = (s.teamAId === userTeamId ? s.teamBId : s.teamAId) ?? '';
    found.push(conference(league, s.winnerTeamId === userTeamId ? 'seriesWon' : 'eliminated', key, s.winnerTeamId === userTeamId ? `Series win over ${name(opp)}` : `Eliminated by ${name(opp)}`));
  }
  if (!found.length && state.gamesSeen === results.length && league.press === state) return league;
  const queued = [...state.pending, ...found.filter(f => !state.pending.some(p => p.id === f.id) && !state.log.some(l => l.id === f.id))];
  // More than the podium holds (a long sim): the oldest go unanswered. "No comment" costs a little with the fans.
  const skipped = queued.slice(0, Math.max(0, queued.length - MAX_PENDING));
  const pending = queued.slice(-MAX_PENDING);
  const log = [...state.log, ...skipped.map(c => ({ id: c.id, season: c.season, kind: c.kind, question: c.question, answer: 'No comment.', tone: 'No comment' }))].slice(-40);
  fans = clamp(fans - skipped.length * NO_COMMENT_FANS);
  return { ...league, press: { ...state, fans, pending, log, playerMood: mood, gamesSeen: results.length, asked: [...asked], lastSkipped: skipped.length } };
}

/** Answer a press conference: applies its effects and files it in the log. */
export function answerPress(league: League, conferenceId: string, answerId: string, userTeamId: string | null): League {
  const state = pressState(league);
  const c = state.pending.find(p => p.id === conferenceId);
  const a = c?.answers.find(x => x.id === answerId);
  if (!c || !a) return league;
  const mood = { ...state.playerMood };
  const team = league.teams.find(t => t.teamId === userTeamId);
  if (a.effects.team && team) for (const p of team.seasons) mood[p.playerId] = clamp((mood[p.playerId] ?? 0) + a.effects.team, -12, 12);
  if (a.effects.player && c.subjectPlayerId) mood[c.subjectPlayerId] = clamp((mood[c.subjectPlayerId] ?? 0) + a.effects.player, -12, 12);
  const fo = league.frontOffice;
  const frontOffice = fo && a.effects.owner && fo.teamId === userTeamId ? { ...fo, security: clamp(fo.security + a.effects.owner) } : fo;
  return {
    ...league,
    ...(frontOffice ? { frontOffice } : {}),
    press: { ...state, fans: clamp(state.fans + (a.effects.fans ?? 0)), playerMood: mood, pending: state.pending.filter(p => p.id !== c.id),
      log: [...state.log, { id: c.id, season: c.season, kind: c.kind, question: c.question, answer: a.text, tone: a.tone }].slice(-40) },
  };
}

/** Morale shift a player carries from what you said about him or the team. */
export const pressMood = (league: League, playerId: string) => league.press && league.press.season === league.season ? league.press.playerMood[playerId] ?? 0 : 0;

export const fanMoodLabel = (fans: number) => fans >= 80 ? 'Electric' : fans >= 65 ? 'Excited' : fans >= 45 ? 'Steady' : fans >= 30 ? 'Restless' : 'Angry';

// ---- Around the League ----
export interface LeagueStory { title: string; text: string; tone: 'up' | 'down' | 'neutral' }

/** This week's segment: streaks, hot hands, feuds, rivalries, milestones and hot seats, from the league as it stands. */
export function aroundTheLeague(league: League, extras: GMLeagueExtras, userTeamId: string | null): LeagueStory[] {
  void extras;
  const out: LeagueStory[] = [];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  // Streaks.
  const streaks = league.teams.map(t => {
    const gs = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === t.teamId || g.awayTeamId === t.teamId));
    let n = 0, won: boolean | null = null;
    for (let i = gs.length - 1; i >= 0; i--) { const r = gs[i].result!, w = (gs[i].homeTeamId === t.teamId) === (r.homeScore > r.awayScore); if (won === null) won = w; if (w !== won) break; n++; }
    return { id: t.teamId, n, won };
  });
  const hot = [...streaks].filter(s => s.won).sort((a, b) => b.n - a.n)[0];
  const cold = [...streaks].filter(s => s.won === false).sort((a, b) => b.n - a.n)[0];
  if (hot && hot.n >= 4) out.push({ title: 'Red hot', text: `${name(hot.id)} have won ${hot.n} straight.`, tone: 'up' });
  if (cold && cold.n >= 4) out.push({ title: 'Ice cold', text: `${name(cold.id)} have dropped ${cold.n} in a row.`, tone: 'down' });
  // Hot hand: best scoring over each team's last three games.
  const recent = new Map<string, { pts: number; games: number; team: string }>();
  for (const t of league.teams) {
    const gs = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === t.teamId || g.awayTeamId === t.teamId)).slice(-3);
    for (const g of gs) { const box = g.homeTeamId === t.teamId ? g.result!.homeBox : g.result!.awayBox; for (const l of Object.values(box?.players ?? {})) { const r = recent.get(l.playerId) ?? { pts: 0, games: 0, team: t.teamId }; r.pts += l.points; r.games++; recent.set(l.playerId, r); } }
  }
  const scorer = [...recent].filter(([, r]) => r.games >= 3).sort((a, b) => b[1].pts / b[1].games - a[1].pts / a[1].games)[0];
  if (scorer) out.push({ title: 'Hot hand', text: `${scorer[0]} (${name(scorer[1].team)}) is averaging ${(scorer[1].pts / scorer[1].games).toFixed(1)} points over his last three.`, tone: 'up' });
  // Feuds: clashes involving a team's top player.
  for (const t of league.teams) {
    const top = [...t.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 3).map(p => p.playerId);
    const clash = lockerRoom(t).links.find(l => l.kind === 'clash' && (top.includes(l.a) || top.includes(l.b)));
    if (clash) { out.push({ title: 'Locker-room feud', text: `Tension in ${name(t.teamId)}: ${clash.a} and ${clash.b} aren't getting along.`, tone: 'down' }); if (out.filter(o => o.title === 'Locker-room feud').length >= 2) break; }
  }
  // Rivalries.
  const rival = rivalryTable(league)[0];
  if (rival && rival.total >= 20) out.push({ title: 'Rivalry watch', text: `${name(rival.a)} vs ${name(rival.b)}: ${rival.winsA}-${rival.winsB} all-time, ${rival.closeGames} close games. It's ${(rival.level ?? 'heated').toLowerCase()}.`, tone: 'neutral' });
  // Milestones: career points within reach of a round number.
  const marks = [10000, 15000, 20000, 25000, 30000, 35000, 40000];
  const chases = league.teams.flatMap(t => t.seasons.map(p => {
    const career = (p.careerHistory ?? []).reduce((n, c) => n + (c.stats?.points ?? 0), 0) + (p.seasonStats?.points ?? 0);
    const next = marks.find(m => m > career);
    return next && next - career <= 400 ? { p, t: t.teamId, career, next } : null;
  })).filter(Boolean).sort((a, b) => (a!.next - a!.career) - (b!.next - b!.career));
  for (const c of chases.slice(0, 2)) out.push({ title: 'Milestone chase', text: `${c!.p.playerId} (${name(c!.t)}) is ${c!.next - c!.career} points from ${c!.next.toLocaleString()} for his career.`, tone: 'up' });
  // Hot seats.
  for (const s of hotSeats(league, userTeamId).filter(s => s.heat >= 70).slice(0, 2)) out.push({ title: 'Hot seat', text: `${s.coachId} (${name(s.teamId)}) is under pressure: ${s.reason}.`, tone: 'down' });
  return out;
}
