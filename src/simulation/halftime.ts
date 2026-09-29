import type { League } from './league';
import type { PlayerSeason } from './types';
import { personalityOf } from './personality';
import { calculateOverall } from './engine/overall';

/*
 * The halftime speech. In a game you're coaching live, the tape stops at halftime and you address the locker room:
 * fiery, calm, call out the star, or praise the bench. Each player reacts by personality and the score (a hothead
 * feeds on fire when you're down, a star ego sulks if you call him out, the bench lifts when you praise it). The
 * reactions become a per-player edge for the second half, carried on the coaching command so replays stay identical.
 * Speeches are remembered for the season: the best turnarounds make the season reel.
 */

export type Speech = 'fiery' | 'calm' | 'callout' | 'bench';
export const SPEECHES: { id: Speech; label: string; line: string }[] = [
  { id: 'fiery', label: 'Fiery', line: '"That was soft. Go out there and punch them in the mouth."' },
  { id: 'calm', label: 'Calm', line: '"Breathe. Trust the system. One possession at a time."' },
  { id: 'callout', label: 'Call out the star', line: '"You\'re our best player. Start playing like it."' },
  { id: 'bench', label: 'Praise the bench', line: '"The second unit kept us in this. Keep bringing that energy."' },
];

export interface Reaction { playerId: string; delta: number; note: string }
export interface SpeechOutcome { speech: Speech; reactions: Reaction[]; boost: Record<string, number>; headline: string }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * How the room takes it. `margin` is your score minus theirs at the break; `starters` are the players who started
 * (the rest are the bench). Deltas run from -3 to +4 decision-making/help-defense points for the second half.
 */
export function speechOutcome(speech: Speech, roster: PlayerSeason[], margin: number, starters: string[]): SpeechOutcome {
  const star = [...roster].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0]?.playerId;
  const down = margin < 0, bigDown = margin <= -10, up = margin >= 10;
  const reactions: Reaction[] = roster.map(p => {
    const m = personalityOf(p), bench = !starters.includes(p.playerId);
    let d = 0, note = '';
    switch (speech) {
      case 'fiery':
        if (m.type === 'Hothead' || m.type === 'Competitor') { d = down ? 3 : 1; note = down ? 'fired up' : 'amped'; }
        else if (m.type === 'Star Ego') { d = -1; note = 'rolled his eyes'; }
        else if (m.type === 'Leader') { d = 2; note = 'echoed you in the huddle'; }
        else { d = down ? 1 : 0; note = down ? 'got the message' : 'shrugged'; }
        if (bigDown) d += 1;
        if (up) { d -= 1; note = 'thought it was a bit much with a lead'; }
        break;
      case 'calm':
        if (m.type === 'Professional' || m.type === 'Leader' || m.type === 'Loyal') { d = 2; note = 'settled in'; }
        else if (m.type === 'Hothead') { d = down ? 2 : 1; note = 'cooled off'; }
        else if (m.type === 'Competitor') { d = bigDown ? -1 : 1; note = bigDown ? 'wanted more urgency' : 'locked in'; }
        else { d = 1; note = 'nodded along'; }
        break;
      case 'callout':
        if (p.playerId === star) {
          if (m.ego >= 75 || m.type === 'Star Ego') { d = -3; note = 'sulked after being called out'; }
          else if (m.type === 'Competitor' || m.type === 'Leader') { d = 4; note = 'took it personally, in a good way'; }
          else { d = 2; note = 'answered the challenge'; }
        } else { d = 1; note = 'felt the accountability'; }
        break;
      case 'bench':
        if (bench) { d = m.type === 'Star Ego' ? 1 : 3; note = 'loved the shout-out'; }
        else if (m.ego >= 70) { d = -1; note = 'wondered why the starters got nothing'; }
        else { d = 0; note = 'was happy for the second unit'; }
        if (m.type === 'Loyal') d += 1;
        break;
    }
    return { playerId: p.playerId, delta: clamp(d, -3, 4), note };
  });
  const boost = Object.fromEntries(reactions.filter(r => r.delta !== 0).map(r => [r.playerId, r.delta]));
  const net = reactions.reduce((n, r) => n + r.delta, 0);
  const headline = net >= 12 ? 'The room is on fire.' : net >= 6 ? 'They bought in.' : net >= 1 ? 'A few heads nodded.' : net === 0 ? 'No reaction.' : 'That one fell flat.';
  return { speech, reactions, boost, headline };
}

/** A speech as remembered for the season (see League.halftimeSpeeches). */
export interface SpeechRecord { season: string; gameId: string; teamId: string; speech: Speech; halftimeMargin: number }

export interface SpeechMoment extends SpeechRecord { finalMargin: number; swing: number; opponent: string; won: boolean }
/** This season's speeches with how the second half went, best turnaround first (for the season reel). */
export function speechMoments(league: League): SpeechMoment[] {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return (league.halftimeSpeeches ?? []).filter(s => s.season === league.season).flatMap(s => {
    const g = league.schedule.find(x => x.id === s.gameId);
    if (!g?.result) return [];
    const home = g.homeTeamId === s.teamId;
    const finalMargin = home ? g.result.homeScore - g.result.awayScore : g.result.awayScore - g.result.homeScore;
    return [{ ...s, finalMargin, swing: finalMargin - s.halftimeMargin, opponent: name(home ? g.awayTeamId : g.homeTeamId), won: finalMargin > 0 }];
  }).sort((a, b) => b.swing - a.swing);
}
export const speechLabel = (s: Speech) => SPEECHES.find(x => x.id === s)?.label ?? s;
