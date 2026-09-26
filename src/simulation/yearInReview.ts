import type { League, PlayoffFinish } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import type { PlayerStatLine } from './boxscore';
import type { PlayerSeason } from './types';
import { bracketFinish, goalProgress, strengthRank } from './frontOffice';
import { calculateOverall } from './engine/overall';
import { formatSeasonYear } from './calendar';
import { CUP_NAME } from './cup';
import { deadlineClock, describeDeadlineTrade } from './deadlineDay';
import type { SeasonAwards } from './awards';

/*
 * Year in Review: the end-of-season show for your team. Everything is read from the season as it was played:
 * the record and its turning points, the best nights, how the front office did (a GM grade with its reasons),
 * and how your past draft picks are turning out against where they were taken.
 */

export interface StoryBeat { title: string; text: string; tone: 'up' | 'down' | 'flat' }
export interface Moment { title: string; text: string; gameId?: string }
export interface GradePart { label: string; score: number; note: string }
export interface DraftVerdict { playerId: string; draftYear: string; pick: number | null; overall: number; classRank: number; classSize: number; verdict: 'Hit' | 'As expected' | 'Miss' | 'Too early' }
export interface YearInReview {
  season: string;
  seasonYear: string;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  finish: PlayoffFinish;
  story: StoryBeat[];
  moments: Moment[];
  grade: { letter: string; score: number; parts: GradePart[] };
  draft: DraftVerdict[];
  steals: DraftVerdict[];
  league: { label: string; text: string }[];
}

const FINISH_RANK: Record<PlayoffFinish, number> = { 'Missed Playoffs': 0, 'Play-In': 1, Playoffs: 2, 'First Round': 2, 'Second Round': 3, 'Conference Finals': 4, Finals: 5, Champion: 6 };

/** Expected finish (0-6 as in FINISH_RANK) from where the roster ranks. */
function expectedFinish(rank: number, teams: number): number {
  const share = (rank - 1) / Math.max(1, teams - 1);
  return share < 0.07 ? 4.5 : share < 0.17 ? 3.5 : share < 0.34 ? 2.5 : share < 0.5 ? 1.5 : share < 0.67 ? 0.8 : 0.2;
}

function letter(score: number): string {
  return score >= 93 ? 'A+' : score >= 87 ? 'A' : score >= 82 ? 'A-' : score >= 77 ? 'B+' : score >= 72 ? 'B' : score >= 67 ? 'B-'
    : score >= 62 ? 'C+' : score >= 56 ? 'C' : score >= 50 ? 'C-' : score >= 44 ? 'D+' : score >= 38 ? 'D' : 'F';
}

const gameScore = (l: PlayerStatLine) => l.points + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.oreb + 0.3 * l.dreb + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov;

export function buildYearInReview(league: League, extras: GMLeagueExtras, teamId: string, awards?: SeasonAwards | null): YearInReview | null {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return null;
  const season = league.season ?? '';
  const name = (id: string | null | undefined) => league.teams.find(t => t.teamId === id)?.name ?? id ?? '—';
  const standings = computeStandings(league);
  const row = standings.find(r => r.teamId === teamId);
  const wins = row?.wins ?? 0, losses = row?.losses ?? 0;
  const finish = bracketFinish(league, teamId)?.finish ?? 'Missed Playoffs';

  // ---- The season, game by game ----
  const games = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId)).sort((a, b) => a.round - b.round);
  const won = (g: typeof games[number]) => g.homeTeamId === teamId ? g.result!.homeScore > g.result!.awayScore : g.result!.awayScore > g.result!.homeScore;
  const results = games.map(won);
  const streak = (want: boolean) => {
    let best = 0, run = 0, end = -1;
    results.forEach((r, i) => { run = r === want ? run + 1 : 0; if (run > best) { best = run; end = i; } });
    return { best, end };
  };
  const hot = streak(true), cold = streak(false);
  const story: StoryBeat[] = [];
  const firstTen = results.slice(0, 10).filter(Boolean).length;
  if (results.length >= 10) story.push({ title: 'The start', tone: firstTen >= 7 ? 'up' : firstTen <= 3 ? 'down' : 'flat',
    text: firstTen >= 7 ? `A ${firstTen}-${10 - firstTen} start set the tone.` : firstTen <= 3 ? `A ${firstTen}-${10 - firstTen} start put the season in a hole early.` : `${firstTen}-${10 - firstTen} through ten games: nothing decided yet.` });
  if (hot.best >= 5) story.push({ title: 'The run', tone: 'up', text: `A ${hot.best}-game winning streak, the best stretch of the year${hot.end >= 0 ? `, capped against ${name(games[hot.end].homeTeamId === teamId ? games[hot.end].awayTeamId : games[hot.end].homeTeamId)}` : ''}.` });
  if (cold.best >= 5) story.push({ title: 'The slide', tone: 'down', text: `A ${cold.best}-game losing streak tested everyone.` });
  const cup = league.cup?.season === season ? league.cup : undefined;
  if (cup?.knockout) {
    const inKo = cup.qualifiers?.includes(teamId);
    story.push({ title: CUP_NAME, tone: cup.championTeamId === teamId ? 'up' : inKo ? 'flat' : 'down',
      text: cup.championTeamId === teamId ? `Won the ${CUP_NAME}${cup.mvpId ? `, with ${cup.mvpId} as Cup MVP` : ''}.` : inKo ? 'Reached the Cup knockouts.' : 'Went out in the Cup group stage.' });
  }
  const deadline = league.deadlineDay?.season === season ? league.deadlineDay : undefined;
  const myDeals = (deadline?.trades ?? []).filter(t => t.teamAId === teamId || t.teamBId === teamId);
  if (deadline?.status === 'closed') story.push({ title: 'Deadline Day', tone: myDeals.length ? 'up' : 'flat',
    text: myDeals.length ? myDeals.map(t => `${deadlineClock(t.hour)}: ${describeDeadlineTrade(t, name)}`).join(' · ') : 'Stood pat at the trade deadline.' });
  const allStars = awards?.allStars?.filter(a => a.teamId === teamId).map(a => a.playerId) ?? [];
  if (allStars.length) story.push({ title: 'All-Stars', tone: 'up', text: `${allStars.join(' and ')} ${allStars.length === 1 ? 'was an All-Star' : 'were All-Stars'}.` });
  const bracket = league.playoffBracket;
  const series = (bracket?.rounds ?? []).flat().filter(s => s.teamAId === teamId || s.teamBId === teamId);
  for (const s of series) {
    const opp = s.teamAId === teamId ? s.teamBId : s.teamAId;
    const mine = s.teamAId === teamId ? s.teamAWins : s.teamBWins, theirs = s.teamAId === teamId ? s.teamBWins : s.teamAWins;
    if (!s.winnerTeamId) continue;
    const roundName = ['First Round', 'Second Round', 'Conference Finals', 'Finals'][Math.max(0, 4 - ((bracket?.rounds.length ?? 4) - s.round))] ?? `Round ${s.round + 1}`;
    story.push({ title: roundName, tone: s.winnerTeamId === teamId ? 'up' : 'down',
      text: s.winnerTeamId === teamId ? `Beat ${name(opp)} ${mine}-${theirs}${mine + theirs === 7 ? ' in seven' : ''}.` : `Lost to ${name(opp)} ${mine}-${theirs}${mine + theirs === 7 ? ' in a Game 7' : ''}.` });
  }
  story.push({ title: 'The finish', tone: finish === 'Champion' ? 'up' : FINISH_RANK[finish] >= 2 ? 'flat' : 'down',
    text: finish === 'Champion' ? `${wins}-${losses}, and champions.` : finish === 'Missed Playoffs' ? `${wins}-${losses}. No playoffs this year.` : `${wins}-${losses}. The season ended in the ${finish === 'Play-In' ? 'play-in' : finish}.` });

  // ---- Best moments ----
  const moments: Moment[] = [];
  const lines = games.flatMap(g => {
    const box = g.homeTeamId === teamId ? g.result!.homeBox : g.result!.awayBox;
    const opp = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
    return Object.values(box.players).filter(l => l.minutes > 0).map(l => ({ l, g, opp }));
  }).sort((a, b) => gameScore(b.l) - gameScore(a.l));
  const seen = new Set<string>();
  for (const { l, g, opp } of lines) {
    if (seen.has(l.playerId) || moments.length >= 3) continue;
    seen.add(l.playerId);
    moments.push({ title: `${l.playerId}: ${l.points} points`, gameId: g.id,
      text: `${l.points} PTS, ${l.oreb + l.dreb} REB, ${l.ast} AST${l.tpm >= 5 ? `, ${l.tpm} threes` : ''} ${won(g) ? 'in a win over' : 'against'} ${name(opp)}.` });
  }
  const margins = games.map(g => ({ g, m: (g.homeTeamId === teamId ? 1 : -1) * (g.result!.homeScore - g.result!.awayScore) }));
  const blowout = [...margins].sort((a, b) => b.m - a.m)[0];
  if (blowout && blowout.m > 0) moments.push({ title: `Biggest win: +${blowout.m}`, gameId: blowout.g.id, text: `${blowout.g.result!.homeScore}-${blowout.g.result!.awayScore} against ${name(blowout.g.homeTeamId === teamId ? blowout.g.awayTeamId : blowout.g.homeTeamId)}.` });
  const thriller = margins.filter(x => x.m > 0 && x.m <= 2).at(-1);
  if (thriller) moments.push({ title: 'Closest win', gameId: thriller.g.id, text: `By ${thriller.m} over ${name(thriller.g.homeTeamId === teamId ? thriller.g.awayTeamId : thriller.g.homeTeamId)}.` });

  // ---- GM grade ----
  const rank = strengthRank(league, teamId), n = league.teams.length;
  const gamesPlayed = wins + losses;
  const expectedPct = 0.7 - 0.42 * ((rank - 1) / Math.max(1, n - 1));
  const winScore = Math.max(0, Math.min(100, 60 + ((gamesPlayed ? wins / gamesPlayed : 0) - expectedPct) * 250));
  const finishScore = Math.max(0, Math.min(100, 60 + (FINISH_RANK[finish] - expectedFinish(rank, n)) * 14 + (finish === 'Champion' ? 20 : 0)));
  const goals = league.frontOffice?.goalsSeason === season && league.frontOffice.teamId === teamId ? league.frontOffice.goals : [];
  const met = goals.map(g => ({ g, s: goalProgress(league, extras, teamId, g).status }));
  const weight = goals.reduce((s, g) => s + g.weight, 0);
  const goalScore = weight ? Math.round(met.reduce((s, x) => s + (x.s === 'met' || x.s === 'on_track' ? x.g.weight : x.s === 'at_risk' ? x.g.weight * 0.4 : 0), 0) / weight * 100) : 60;
  const young = team.seasons.filter(s => s.age <= 24);
  // Growth since last season's final rating (the offseason plus this season).
  const growth = young.reduce((s, p) => s + calculateOverall(p) - (p.careerHistory?.at(-1)?.overall ?? p.previousOverall ?? calculateOverall(p)), 0) / Math.max(1, young.length);
  const buildScore = Math.max(0, Math.min(100, 55 + growth * 6 + Math.min(15, young.filter(p => calculateOverall(p) >= 68).length * 5)));
  const parts: GradePart[] = [
    { label: 'Results vs. roster', score: Math.round(winScore), note: `${wins}-${losses} with the ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}-best roster` },
    { label: 'Postseason', score: Math.round(finishScore), note: finish },
    { label: "Owner's goals", score: goalScore, note: goals.length ? `${met.filter(x => x.s === 'met' || x.s === 'on_track').length} of ${goals.length} on track or met` : 'No goals set this season' },
    { label: 'Building for later', score: Math.round(buildScore), note: young.length ? `${young.length} players 24 or younger, ${growth >= 0 ? '+' : ''}${growth.toFixed(1)} overall each this year` : 'No young players on the roster' },
  ];
  const score = Math.round(parts[0].score * 0.35 + parts[1].score * 0.25 + parts[2].score * 0.25 + parts[3].score * 0.15);

  // ---- Draft picks: hits and misses against where they were taken ----
  const everyone: PlayerSeason[] = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents];
  const classes = new Map<string, PlayerSeason[]>();
  for (const p of everyone) if (p.draftYear && p.draftPick) classes.set(p.draftYear, [...(classes.get(p.draftYear) ?? []), p]);
  const verdictFor = (p: PlayerSeason): DraftVerdict => {
    const cls = [...(classes.get(p.draftYear!) ?? [])].sort((a, b) => calculateOverall(b) - calculateOverall(a));
    const classRank = cls.findIndex(x => x.playerId === p.playerId) + 1;
    const pick = p.draftPick ?? null;
    const yearsIn = Math.max(0, parseInt(season, 10) - parseInt(p.draftYear!, 10));
    // Players who washed out of the league are gone from the class, so scale the slot to the survivors.
    const drafted = Math.max(cls.length, ...cls.map(x => x.draftPick ?? 0));
    const expectedRank = pick == null ? cls.length : Math.max(1, Math.round(pick * cls.length / drafted));
    const overall = calculateOverall(p);
    const verdict: DraftVerdict['verdict'] = yearsIn < 1 ? 'Too early' : pick == null ? 'As expected'
      : (classRank <= 3 || classRank <= expectedRank * 0.6) && overall >= 58 ? 'Hit'
      : pick <= 14 && (classRank >= expectedRank + 6 || (yearsIn >= 3 && overall < 55)) ? 'Miss' : 'As expected';
    return { playerId: p.playerId, draftYear: formatSeasonYear(p.draftYear!), pick, overall, classRank, classSize: cls.length, verdict };
  };
  const recent = (p: PlayerSeason) => p.draftYear && parseInt(season, 10) - parseInt(p.draftYear, 10) <= 6;
  const draft = everyone.filter(p => p.draftTeamId === teamId && recent(p)).map(verdictFor).sort((a, b) => b.draftYear.localeCompare(a.draftYear) || (a.pick ?? 99) - (b.pick ?? 99)).slice(0, 10);
  const steals = everyone.filter(p => recent(p) && p.draftPick && p.draftPick > 10).map(verdictFor).filter(v => v.verdict === 'Hit').sort((a, b) => (b.pick! - b.classRank) - (a.pick! - a.classRank)).slice(0, 3);

  // ---- Around the league ----
  const leagueLines: { label: string; text: string }[] = [];
  if (bracket?.championTeamId) leagueLines.push({ label: 'Champion', text: name(bracket.championTeamId) });
  if (awards?.mvp) leagueLines.push({ label: 'MVP', text: `${awards.mvp.playerId} (${name(awards.mvp.teamId)})` });
  if (awards?.roy) leagueLines.push({ label: 'Rookie of the Year', text: awards.roy.playerId });
  if (cup?.championTeamId) leagueLines.push({ label: CUP_NAME, text: name(cup.championTeamId) });
  const blockbuster = [...(deadline?.trades ?? [])].sort((a, b) => b.topOverall - a.topOverall)[0];
  if (blockbuster) leagueLines.push({ label: 'Biggest deadline deal', text: describeDeadlineTrade(blockbuster, name) });
  const firings = (league.coachingCarousel?.events ?? []).filter(e => e.season === season && e.kind === 'fired');
  if (firings.length) leagueLines.push({ label: 'Coaching changes', text: `${firings.length} head coach${firings.length === 1 ? '' : 'es'} fired during the season` });

  return { season, seasonYear: formatSeasonYear(season), teamId, teamName: team.name, wins, losses, finish, story, moments, grade: { letter: letter(score), score, parts }, draft, steals, league: leagueLines };
}
