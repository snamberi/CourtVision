import type { League } from '../simulation/league';
import type { PersonalityType } from '../simulation/personality';

/*
 * Posting on CourtChat as the GM. Your posts live in the league (`league.courtChat`) and the league reacts:
 *   - praise a player and he answers in his own voice; most players like it (Star Egos love it);
 *   - call one out and Hotheads and Star Egos take it badly, Competitors take it as fuel (a morale factor,
 *     `chatMood`, for the next 15 games);
 *   - hype the team, or trash-talk a rival, and the fans (and the rival's players) answer.
 * Fan approval is the fans' read on you: winning, and posts that land.
 */

export type GmPostKind = 'hype' | 'praise' | 'callout' | 'rival' | 'free';
export interface GmPost {
  id: string;
  kind: GmPostKind;
  text: string;
  teamId: string;
  /** Praise or call-out: who. */
  playerId?: string;
  /** Rival post: which team. */
  rivalTeamId?: string;
  season: string;
  /** Schedule index of the last game played when it was posted (where it sits in the feed). */
  at: number;
  /** Your team's games played when it was posted (how long a call-out stings). */
  gamesAt: number;
}
export interface CourtChatState { posts: GmPost[] }

export const MAX_POST_LENGTH = 200;
/** Posts allowed between games. */
export const POSTS_PER_DAY = 3;
/** How many of your team's games a praise or call-out keeps affecting morale. */
export const MOOD_GAMES = 15;

const BLOCKED = ['damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb', 'shut up', 'suck', 'sucks', 'hate', 'kill', 'die', 'loser', 'trash', 'garbage', 'fat', 'ugly'];
/** Keeps posts friendly: trims, caps the length and stars out a short list of words. */
export function cleanText(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_POST_LENGTH);
  for (const w of BLOCKED) t = t.replace(new RegExp(`\\b${w.replace(' ', '\\s+')}\\b`, 'gi'), m => '*'.repeat(m.length));
  return t;
}

const lastPlayedIndex = (league: League) => { for (let i = league.schedule.length - 1; i >= 0; i--) if (league.schedule[i].played) return i; return -1; };
export const teamGamesPlayed = (league: League, teamId: string) => league.schedule.filter(g => g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId)).length;
export const gmPosts = (league: League) => league.courtChat?.posts ?? [];

/** How many more posts you can make before the next game. */
export function postsLeftToday(league: League, teamId: string): number {
  const at = lastPlayedIndex(league);
  return Math.max(0, POSTS_PER_DAY - gmPosts(league).filter(p => p.teamId === teamId && p.at === at && p.season === (league.season ?? '')).length);
}

/** Posts as the GM. Returns the new league, or an error to show. */
export function postAsGm(league: League, teamId: string, draft: { kind: GmPostKind; text: string; playerId?: string; rivalTeamId?: string }): { league: League } | { error: string } {
  const text = cleanText(draft.text);
  if (!text) return { error: 'Write something first.' };
  if (postsLeftToday(league, teamId) <= 0) return { error: `That's ${POSTS_PER_DAY} posts today. Play a game and post again.` };
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return { error: 'No team to post for.' };
  if ((draft.kind === 'praise' || draft.kind === 'callout') && !team.seasons.some(p => p.playerId === draft.playerId)) return { error: 'Pick one of your players.' };
  if (draft.kind === 'rival' && (!draft.rivalTeamId || draft.rivalTeamId === teamId || !league.teams.some(t => t.teamId === draft.rivalTeamId))) return { error: 'Pick a team to call out.' };
  const at = lastPlayedIndex(league), season = league.season ?? '';
  const n = gmPosts(league).length;
  const post: GmPost = { id: `gm|${season}|${at}|${n}`, kind: draft.kind, text, teamId, season, at, gamesAt: teamGamesPlayed(league, teamId),
    ...(draft.kind === 'praise' || draft.kind === 'callout' ? { playerId: draft.playerId } : {}), ...(draft.kind === 'rival' ? { rivalTeamId: draft.rivalTeamId } : {}) };
  // Keep the last 200 posts.
  return { league: { ...league, courtChat: { posts: [...gmPosts(league), post].slice(-200) } } };
}

const PRAISE: Record<PersonalityType, number> = { Leader: 3, Hothead: 5, 'Star Ego': 8, Mercenary: 3, Competitor: 2, Loyal: 6, Professional: 2 };
const CALLOUT: Record<PersonalityType, number> = { Leader: -1, Hothead: -10, 'Star Ego': -9, Mercenary: -4, Competitor: 3, Loyal: -6, Professional: -2 };

/** The morale effect of your latest praise or call-out of this player (fades after MOOD_GAMES of his team's games). */
export function chatMood(league: League, playerId: string, type: PersonalityType, teamId: string): number {
  const last = [...gmPosts(league)].reverse().find(p => p.playerId === playerId && p.teamId === teamId && p.season === (league.season ?? '') && (p.kind === 'praise' || p.kind === 'callout'));
  if (!last) return 0;
  const since = teamGamesPlayed(league, teamId) - last.gamesAt;
  if (since >= MOOD_GAMES) return 0;
  const full = last.kind === 'praise' ? PRAISE[type] : CALLOUT[type];
  return Math.round(full * (1 - since / MOOD_GAMES) * 10) / 10;
}

/** The fans' read on you (0-100): the record, and how your posts this season landed. */
export function fanApproval(league: League, teamId: string): { score: number; label: string } {
  let w = 0, l = 0;
  for (const g of league.schedule) {
    if (!g.played || !g.result || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue;
    const home = g.homeTeamId === teamId;
    if ((g.result.homeScore > g.result.awayScore) === home) w++; else l++;
  }
  const pct = w + l ? w / (w + l) : 0.5;
  let score = 50 + (pct - 0.5) * 80;
  for (const p of gmPosts(league).filter(x => x.teamId === teamId && x.season === (league.season ?? ''))) {
    score += p.kind === 'rival' ? 2 : p.kind === 'praise' ? 1 : p.kind === 'callout' ? -1.5 : pct >= 0.5 ? 1.5 : -1;
  }
  const s = Math.round(Math.max(0, Math.min(100, score)));
  return { score: s, label: s >= 80 ? 'Fans love you' : s >= 60 ? 'Fans like you' : s >= 40 ? 'Fans are split' : s >= 20 ? 'Fans are restless' : 'Fans want you gone' };
}

/** Default text for a post type (you can edit it before posting). */
export function draftText(kind: GmPostKind, names: { player?: string; rival?: string; team: string }): string {
  switch (kind) {
    case 'hype': return `Proud of this group. ${names.team} basketball is just getting started. See you at the next game!`;
    case 'praise': return `Huge credit to ${names.player ?? 'our guy'}. Doing everything for this team. Proud of you.`;
    case 'callout': return `${names.player ?? 'Some of you'}, we need more. The standard is higher than that.`;
    case 'rival': return `Hey ${names.rival ?? 'rivals'}, circle the date. Our building, our rules.`;
    default: return '';
  }
}
