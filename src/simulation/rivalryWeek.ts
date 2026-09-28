import type { League } from './league';
import { computeStandings } from './league';
import { teamRivals, rivalryBetween } from './rivalry';
import { pressState, type PressConference } from './press';

/*
 * Rivalry Week. Twice a season (once in each half) your game against your biggest rival gets the full build-up: a
 * trash-talk press conference a few games out, a hype meter, and on the night a special court and a crowd on its
 * feet. Win it for bragging rights and a small morale boost; lose it and the fans let you know. The hotter the
 * build-up (a heated rivalry, a close race, what you said at the podium), the bigger the swing either way.
 */

export interface RivalryWeekGame {
  gameId: string; opponentId: string; half: 1 | 2;
  /** What you said at the rivalry press conference. */
  talk?: { tone: string; hype: number; trash: boolean };
  /** Filled in once the game is played and its fallout applied. */
  result?: { won: boolean; us: number; them: number; hype: number; fans: number; mood: number };
}
export interface RivalryWeekState { season: string; teamId: string; games: RivalryWeekGame[] }

/** How many of your games ahead the press conference is called. */
const PRESS_LEAD = 3;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Your biggest rival: the hottest rivalry, else the team you play most (closest record breaks ties). */
function biggestRivals(league: League, teamId: string): string[] {
  const named = teamRivals(league, teamId, 5).map(r => (r.a === teamId ? r.b : r.a));
  const counts = new Map<string, number>();
  for (const g of league.schedule) {
    if (g.homeTeamId === teamId) counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
    else if (g.awayTeamId === teamId) counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
  }
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r.winPct]));
  const us = standings.get(teamId) ?? 0.5;
  const rest = [...counts.keys()].filter(id => !named.includes(id))
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || Math.abs((standings.get(a) ?? 0.5) - us) - Math.abs((standings.get(b) ?? 0.5) - us) || a.localeCompare(b));
  return [...named, ...rest];
}

/** Picks this season's two rivalry games (only unplayed ones), or returns the existing pick. */
export function planRivalryWeek(league: League, teamId: string): RivalryWeekState | null {
  const season = league.season ?? '';
  const existing = league.rivalryWeek;
  if (existing && existing.season === season && existing.teamId === teamId) return existing;
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return null;
  const mine = league.schedule.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
  if (mine.length < 4) return null;
  const half = Math.floor(mine.length / 2);
  const games: RivalryWeekGame[] = [];
  for (const h of [1, 2] as const) {
    const window = (h === 1 ? mine.slice(0, half) : mine.slice(half)).filter(g => !g.played);
    // Not in the first few games of a half: the build-up needs a few games of lead time.
    const candidates = window.slice(Math.min(PRESS_LEAD, Math.max(0, window.length - 1)));
    for (const rival of biggestRivals(league, teamId)) {
      const g = candidates.find(x => x.homeTeamId === rival || x.awayTeamId === rival);
      if (g) { games.push({ gameId: g.id, opponentId: rival, half: h }); break; }
    }
  }
  return games.length ? { season, teamId, games } : null;
}

/** The hype meter, 0-100: rivalry heat, the standings, the last meeting and what was said at the podium. */
export function rivalryHype(league: League, teamId: string, game: RivalryWeekGame): number {
  if (game.result) return game.result.hype;
  const heat = rivalryBetween(league, teamId, game.opponentId)?.total ?? 0;
  const st = new Map(computeStandings(league).map(r => [r.teamId, r]));
  const us = st.get(teamId)?.winPct ?? 0.5, them = st.get(game.opponentId)?.winPct ?? 0.5;
  const played = st.get(teamId)?.wins ?? 0;
  const race = played + (st.get(teamId)?.losses ?? 0) >= 6 ? (us >= 0.5 && them >= 0.5 ? 10 : 0) + (Math.abs(us - them) < 0.1 ? 8 : 0) : 6;
  const last = [...league.schedule].reverse().find(g => g.played && g.result && ((g.homeTeamId === teamId && g.awayTeamId === game.opponentId) || (g.awayTeamId === teamId && g.homeTeamId === game.opponentId)));
  const close = last?.result && Math.abs(last.result.homeScore - last.result.awayScore) <= 6 ? 6 : 0;
  return Math.round(clamp(32 + Math.min(28, heat * 0.9) + race + close + (game.talk?.hype ?? 0)));
}
export const hypeLabel = (h: number) => h >= 85 ? 'Boiling over' : h >= 70 ? 'Red hot' : h >= 50 ? 'Heating up' : 'Simmering';

/** A rivalry game's schedule entry, if it's one of this season's. */
export function rivalryWeekGame(league: League, gameId: string): RivalryWeekGame | null {
  const s = league.rivalryWeek;
  return s && s.season === league.season ? s.games.find(g => g.gameId === gameId) ?? null : null;
}

export function rivalryPressConference(league: League, game: RivalryWeekGame, oppName: string): PressConference {
  const nick = oppName.split(' ').slice(-1)[0];
  return {
    id: `${league.season}:rw:${game.gameId}`, season: league.season ?? '', kind: 'rivalry', context: `Rivalry Week against the ${oppName}`,
    question: `It's Rivalry Week: the ${oppName} are next. What's your message to them?`,
    answers: [
      { id: 'trash', tone: 'Trash talk', text: `The ${nick} are soft, and everybody knows it. We own this building and we own them.`, effects: { fans: 3, team: 1, hype: 18 } },
      { id: 'respect', tone: 'Respectful', text: `Great franchise, great rivalry. We'll have to play our best game of the year.`, effects: { owner: 1, hype: 4 } },
      { id: 'circle', tone: 'Circled date', text: `We've had this one circled since the schedule came out. Our guys remember last time.`, effects: { team: 2, hype: 10 } },
    ],
  };
}

/**
 * Keeps Rivalry Week moving: plans the games, calls the trash-talk press conference when a rivalry game is close,
 * and applies the fallout of rivalry games once played. Returns the same league object when nothing changed.
 */
export function rivalryWeekTick(league: League, teamId: string | null): League {
  if (!teamId || !league.teams.some(t => t.teamId === teamId)) return league;
  const plan = planRivalryWeek(league, teamId);
  if (!plan) return league;
  let state = plan, changed = plan !== league.rivalryWeek;
  let press = pressState(league);
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const upcoming = league.schedule.filter(g => !g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId)).slice(0, PRESS_LEAD).map(g => g.id);
  const team = league.teams.find(t => t.teamId === teamId)!;
  for (const game of state.games) {
    const sched = league.schedule.find(g => g.id === game.gameId);
    if (!sched) continue;
    const confId = `${league.season}:rw:${game.gameId}`;
    // The press conference, a few games out.
    if (!sched.played && !game.talk && upcoming.includes(game.gameId) && !press.pending.some(p => p.id === confId) && !press.log.some(l => l.id === confId)) {
      press = { ...press, pending: [...press.pending, rivalryPressConference(league, game, name(game.opponentId))] };
      changed = true;
    }
    // The fallout.
    if (sched.played && sched.result && !game.result) {
      const home = sched.homeTeamId === teamId, r = sched.result;
      const us = home ? r.homeScore : r.awayScore, them = home ? r.awayScore : r.homeScore, won = us > them;
      const hype = rivalryHype(league, teamId, game);
      const trash = !!game.talk?.trash;
      const fans = won ? Math.round(2 + hype / 30) : -Math.round(2 + hype / 25 + (trash ? 3 : 0));
      const mood = won ? Math.round((2 + hype / 40) * 10) / 10 : -1;
      const playerMood = { ...press.playerMood };
      for (const p of team.seasons) playerMood[p.playerId] = clamp((playerMood[p.playerId] ?? 0) + mood, -12, 12);
      press = { ...press, fans: clamp(press.fans + fans), playerMood };
      state = { ...state, games: state.games.map(g => g.gameId === game.gameId ? { ...g, result: { won, us, them, hype, fans, mood } } : g) };
      changed = true;
    }
  }
  return changed ? { ...league, rivalryWeek: state, press } : league;
}

/** Called when the rivalry press conference is answered: remembers what you said (it feeds the hype meter). */
export function recordRivalryTalk(league: League, conferenceId: string, tone: string, hype: number, trash: boolean): League {
  const s = league.rivalryWeek;
  const gameId = conferenceId.split(':rw:')[1];
  if (!s || !gameId) return league;
  return { ...league, rivalryWeek: { ...s, games: s.games.map(g => g.gameId === gameId ? { ...g, talk: { tone, hype, trash } } : g) } };
}

/** News for played rivalry games: bragging rights, or the boos. */
export function rivalryWeekNews(league: League): { id: string; teamId: string; headline: string; detail: string; gameId: string }[] {
  const s = league.rivalryWeek;
  if (!s) return [];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return s.games.filter(g => g.result).map(g => {
    const r = g.result!, us = name(s.teamId), them = name(g.opponentId);
    return r.won
      ? { id: `rw:${g.gameId}`, teamId: s.teamId, gameId: g.gameId, headline: `Rivalry Week: ${us} beat the ${them} ${r.us}-${r.them}. Bragging rights stay home.`, detail: `The locker room is buzzing (morale +${r.mood}) and the fans loved it (fan mood +${r.fans}).` }
      : { id: `rw:${g.gameId}`, teamId: s.teamId, gameId: g.gameId, headline: `Rivalry Week: ${them} win ${r.them}-${r.us}, and the ${us} fans let them hear it.`, detail: `Boos at the final buzzer${g.talk?.trash ? ' after all that trash talk' : ''} (fan mood ${r.fans}).` };
  });
}
