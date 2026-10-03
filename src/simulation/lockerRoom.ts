import type { League } from './league';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { primaryPosition } from './teamStatus';

/*
 * The locker room: every couple of weeks your team has a moment that needs a decision, and the choice changes the
 * players involved (ratings and confidence), not just a mood number.
 *  - A veteran mentors a young player at his position.
 *  - Two teammates click on the floor.
 *  - Two players clash in practice.
 *  - A star wants a bigger role.
 * Long injuries get a story too: a check-in halfway through the recovery (stick to the plan, push it, or extra rehab)
 * and a return game when he is back.
 * Only your team; AI teams carry on as before. Everything is stored in `league.lockerRoom`.
 */

export type LockerKind = 'mentor' | 'click' | 'clash' | 'role' | 'rehab' | 'comeback';
type Group = 'physical' | 'offense' | 'defense' | 'mental';
/** A rating change for one player: [group, attribute, amount]. */
export type Bump = [Group, string, number];
export interface LockerChoice { id: string; text: string; result: string; bumps: Record<string, Bump[]>; injury?: 'push' | 'rehab' }
export interface LockerEvent { id: string; season: string; kind: LockerKind; title: string; text: string; players: string[]; choices: LockerChoice[] }
export interface LockerRecord { id: string; season: string; kind: LockerKind; title: string; choice: string; result: string }
export interface LockerState { season: string; pending: LockerEvent[]; log: LockerRecord[]; gamesSeen: number; asked: string[]; injured: Record<string, number> }

export const LOCKER_EVERY = 12;
const short = (id: string) => id.split(' ').slice(-1)[0];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function lockerState(league: League): LockerState {
  const s = league.lockerRoom;
  return s && s.season === (league.season ?? '') ? s : { season: league.season ?? '', pending: [], log: s?.log.slice(-40) ?? [], gamesSeen: 0, asked: [], injured: s?.injured ?? {} };
}

const MENTOR_SKILLS: Bump[] = [['offense', 'offensiveIQ', 2], ['defense', 'defensiveIQ', 2], ['mental', 'composure', 2], ['offense', 'shotIQ', 1]];

/** Looks at your team and lines up at most one new moment (and any injury check-ins or comebacks). */
export function collectLockerEvents(league: League, userTeamId: string | null): League {
  if (!userTeamId || (league.seasonPhase ?? 'regular_season') !== 'regular_season') return league;
  const team = league.teams.find(t => t.teamId === userTeamId);
  if (!team || team.seasons.length < 5) return league;
  const st = lockerState(league);
  const played = league.schedule.filter(g => g.played && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)).length;
  const season = league.season ?? '';
  const pending = [...st.pending], asked = [...st.asked], injured = { ...st.injured };
  const name = (id: string) => team.seasons.find(p => p.playerId === id);

  // Injuries: a check-in halfway through a long recovery, and the comeback when he is back.
  const injuries = league.injuries ?? {};
  for (const [pid, rec] of Object.entries(injuries)) {
    if (rec.teamId !== userTeamId || rec.totalGames < 12) continue;
    injured[pid] = Math.max(injured[pid] ?? 0, rec.totalGames);
    const id = `rehab-${pid}-${rec.totalGames}`;
    if (!asked.includes(id) && rec.gamesRemaining <= Math.ceil(rec.totalGames / 2) && rec.gamesRemaining >= 4) {
      asked.push(id);
      pending.push({ id, season, kind: 'rehab', title: `Check-in: ${short(pid)}'s recovery`, players: [pid],
        text: `${pid} is halfway back (${rec.gamesRemaining} of ${rec.totalGames} games to go). The training staff wants a decision.`,
        choices: [
          { id: 'plan', text: 'Stick to the plan', result: 'He comes back on schedule.', bumps: {} },
          { id: 'push', text: 'Push the timeline', result: 'He is back sooner, but the body pays for it.', bumps: { [pid]: [['physical', 'durability', -3]] }, injury: 'push' },
          { id: 'rehab', text: 'Extra rehab', result: 'A few more games out, and he comes back stronger.', bumps: { [pid]: [['physical', 'durability', 2], ['physical', 'strength', 1]] }, injury: 'rehab' },
        ] });
    }
  }
  for (const pid of Object.keys(injured)) {
    if (injuries[pid]) continue;
    const out = injured[pid], id = `comeback-${pid}-${out}`;
    delete injured[pid];
    if (asked.includes(id) || !name(pid)) continue;
    asked.push(id);
    pending.push({ id, season, kind: 'comeback', title: `${short(pid)} is back`, players: [pid],
      text: `After a ${out}-game absence, ${pid} is cleared for tonight. The crowd is ready.`,
      choices: [
        { id: 'ease', text: 'Ease him back in', result: 'Limited minutes, no setbacks.', bumps: { [pid]: [['mental', 'composure', 1]] } },
        { id: 'full', text: 'Turn him loose', result: 'He plays like he never left.', bumps: { [pid]: [['mental', 'confidence', 3], ['mental', 'aggression', 1]] } },
      ] });
  }

  // A locker-room moment every LOCKER_EVERY games.
  if (played >= st.gamesSeen + LOCKER_EVERY && !pending.some(e => e.kind !== 'rehab' && e.kind !== 'comeback')) {
    const ev = pickMoment(team.seasons.filter(p => !injuries[p.playerId]), season, played, asked);
    if (ev) { pending.push(ev); asked.push(ev.id); }
  }
  const next: LockerState = { ...st, pending: pending.slice(-4), asked: asked.slice(-200), injured, gamesSeen: played >= st.gamesSeen + LOCKER_EVERY ? played : st.gamesSeen };
  if (JSON.stringify(next) === JSON.stringify(league.lockerRoom)) return league;
  return { ...league, lockerRoom: next };
}

function pickMoment(roster: PlayerSeason[], season: string, played: number, asked: string[]): LockerEvent | null {
  const ovr = (p: PlayerSeason) => calculateOverall(p);
  const byOvr = [...roster].sort((a, b) => ovr(b) - ovr(a));
  const star = byOvr[0], second = byOvr[1];
  const kinds: LockerKind[] = ['mentor', 'click', 'clash', 'role'];
  const start = hash(`${season}|${played}`) % kinds.length;
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[(start + i) % kinds.length];
    if (kind === 'mentor') {
      const vet = byOvr.find(p => p.age >= 30 && ovr(p) >= 62);
      const kid = vet && roster.find(p => p.age <= 23 && p.playerId !== vet.playerId && primaryPosition(p) === primaryPosition(vet));
      const id = vet && kid ? `mentor-${vet.playerId}-${kid.playerId}` : '';
      if (!vet || !kid || asked.includes(id)) continue;
      return { id, season, kind, title: `${short(vet.playerId)} takes ${short(kid.playerId)} under his wing`, players: [vet.playerId, kid.playerId],
        text: `${vet.playerId} (${vet.age}) has been staying after practice with ${kid.playerId} (${kid.age}). He'd like it to be official.`,
        choices: [
          { id: 'yes', text: 'Make it official', result: `${short(kid.playerId)} soaks it up; ${short(vet.playerId)} loves the role.`, bumps: { [kid.playerId]: MENTOR_SKILLS, [vet.playerId]: [['mental', 'leadership', 2]] } },
          { id: 'film', text: 'Film sessions only', result: 'A smaller step, but a step.', bumps: { [kid.playerId]: [['offense', 'offensiveIQ', 1], ['defense', 'defensiveIQ', 1]] } },
          { id: 'no', text: 'Let the kid find his own way', result: `${short(kid.playerId)} shrugs; ${short(vet.playerId)} is a little hurt.`, bumps: { [vet.playerId]: [['mental', 'leadership', -1]] } },
        ] };
    }
    if (kind === 'click' && star && second) {
      const id = `click-${star.playerId}-${second.playerId}-${season}`;
      if (asked.includes(id)) continue;
      return { id, season, kind, title: `${short(star.playerId)} and ${short(second.playerId)} are clicking`, players: [star.playerId, second.playerId],
        text: `${star.playerId} and ${second.playerId} have found something: the two-man game is humming.`,
        choices: [
          { id: 'feature', text: 'Feature the two-man game', result: 'The plays run through the duo.', bumps: { [star.playerId]: [['offense', 'passingIQ', 2], ['offense', 'offensiveIQ', 1]], [second.playerId]: [['offense', 'passingIQ', 2], ['offense', 'offensiveIQ', 1]] } },
          { id: 'spread', text: 'Keep spreading it around', result: 'Everybody eats; the duo keeps it simple.', bumps: { [star.playerId]: [['mental', 'leadership', 1]] } },
        ] };
    }
    if (kind === 'clash' && star && byOvr[2]) {
      const other = byOvr[2], id = `clash-${star.playerId}-${other.playerId}-${season}`;
      if (asked.includes(id)) continue;
      return { id, season, kind, title: `${short(star.playerId)} and ${short(other.playerId)} go at it in practice`, players: [star.playerId, other.playerId],
        text: `Words were exchanged at practice between ${star.playerId} and ${other.playerId}. The locker room is watching what you do.`,
        choices: [
          { id: 'meeting', text: 'Team meeting, clear the air', result: 'They hug it out. Everyone plays harder.', bumps: { [star.playerId]: [['mental', 'effort', 2]], [other.playerId]: [['mental', 'effort', 2]] } },
          { id: 'star', text: 'Back your star', result: `${short(star.playerId)} feels backed; ${short(other.playerId)} sulks.`, bumps: { [star.playerId]: [['mental', 'confidence', 2]], [other.playerId]: [['mental', 'effort', -2], ['mental', 'discipline', -1]] } },
          { id: 'fine', text: 'Fine them both', result: 'Order is restored. Nobody is happy about it.', bumps: { [star.playerId]: [['mental', 'discipline', 2], ['mental', 'confidence', -1]], [other.playerId]: [['mental', 'discipline', 2]] } },
        ] };
    }
    if (kind === 'role') {
      const hungry = byOvr.slice(1, 6).find(p => p.age <= 27 && ovr(p) >= 60);
      const id = hungry ? `role-${hungry.playerId}-${season}` : '';
      if (!hungry || asked.includes(id)) continue;
      return { id, season, kind, title: `${short(hungry.playerId)} wants a bigger role`, players: [hungry.playerId],
        text: `${hungry.playerId} came to your office: he thinks he is ready to be a bigger part of what you do.`,
        choices: [
          { id: 'yes', text: 'Give him the green light', result: 'He plays with a new swagger.', bumps: { [hungry.playerId]: [['mental', 'confidence', 3], ['mental', 'aggression', 2]] } },
          { id: 'earn', text: "Tell him to earn it", result: 'He gets to work, a little stung.', bumps: { [hungry.playerId]: [['mental', 'effort', 2], ['mental', 'confidence', -1]] } },
        ] };
    }
  }
  return null;
}

const CAP = (p: PlayerSeason) => (p.careerPlayer || p.highRatings ? 120 : 99);
function applyBumps(p: PlayerSeason, bumps: Bump[]): PlayerSeason {
  const attributes = { physical: { ...p.attributes.physical }, offense: { ...p.attributes.offense }, defense: { ...p.attributes.defense }, mental: { ...p.attributes.mental } };
  for (const [g, k, n] of bumps) {
    const grp = attributes[g] as unknown as Record<string, number>;
    if (typeof grp[k] === 'number') grp[k] = Math.max(1, Math.min(CAP(p), Math.round(grp[k] + n)));
  }
  return { ...p, attributes };
}

/** Your choice: the players change, the injury timeline moves if you chose that, and it goes in the log. */
export function answerLocker(league: League, eventId: string, choiceId: string): { league: League; result: string } {
  const st = lockerState(league);
  const ev = st.pending.find(e => e.id === eventId), choice = ev?.choices.find(c => c.id === choiceId);
  if (!ev || !choice) return { league, result: '' };
  const teams = league.teams.map(t => t.seasons.some(p => choice.bumps[p.playerId]) ? { ...t, seasons: t.seasons.map(p => choice.bumps[p.playerId] ? applyBumps(p, choice.bumps[p.playerId]) : p) } : t);
  let injuries = league.injuries;
  if (choice.injury && injuries?.[ev.players[0]]) {
    const r = injuries[ev.players[0]];
    const gamesRemaining = choice.injury === 'push' ? Math.max(1, Math.floor(r.gamesRemaining * 0.6)) : r.gamesRemaining + 3;
    injuries = { ...injuries, [ev.players[0]]: { ...r, gamesRemaining } };
  }
  const log: LockerRecord = { id: ev.id, season: ev.season, kind: ev.kind, title: ev.title, choice: choice.text, result: choice.result };
  const next: LockerState = { ...st, pending: st.pending.filter(e => e.id !== eventId), log: [...st.log, log].slice(-40) };
  return { league: { ...league, teams, ...(injuries ? { injuries } : {}), lockerRoom: next }, result: choice.result };
}
