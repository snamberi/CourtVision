import { formatSeasonYear } from './calendar';
import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import type { GameResult, PlayerStatLine } from './boxscore';
import { isRookieEligible } from './rookieEligibility';
import { calculateOverall } from './engine/overall';
import { dynasties, rivalryKey, rivalryLevel } from './rivalry';
import { formatGameClock, HIGHLIGHT_LABEL, type HighlightKind } from './highlights';
import { deadlineNews } from './deadlineDay';
import { negotiationStories } from './agents';
import { carouselNews } from './coachingCarousel';
import { rivalryWeekNews } from './rivalryWeek';
import { rivalNews } from './gmRivals';

/** Game days that get a "Play of the Night" story; older nights roll off like any other news. */
const HIGHLIGHT_NIGHTS = 12;

export type NewsCategory = 'Highlights' | 'Awards' | 'Draft' | 'League' | 'Injuries' | 'Player Feats' | 'Playoffs' | 'Transactions' | 'Teams' | 'Rivalries' | 'Records';
export interface NewsItem {
  id: string; category: NewsCategory; teamId: string | null; teamName: string | null; headline: string;
  season?: string; detail?: string; playerId?: string; gameId?: string; postseason?: boolean; order?: number;
  /** Possession index of a highlight, so the feed can open the replay right at the play. */
  possession?: number;
}
function feat(line: PlayerStatLine): string | null {
  const counts = [line.points, line.oreb + line.dreb, line.ast, line.stl, line.blk];
  const doubles = counts.filter(n => n >= 10).length;
  if (doubles >= 5) return 'an unbelievable quintuple-double';
  if (doubles >= 4) return 'a quadruple-double';
  if (line.tpm >= 10) return `${line.tpm} threes — a shooting masterpiece`;
  if (line.points >= 50) return `${line.points} points`;
  if (counts.every(n => n >= 5)) return 'a rare five-by-five';
  if (doubles >= 3) return 'a triple-double';
  if (line.points >= 40) return `${line.points} points`;
  if (line.blk >= 8) return `${line.blk} blocks`;
  if (line.ast >= 18) return `${line.ast} assists`;
  if (line.oreb + line.dreb >= 22) return `${line.oreb + line.dreb} rebounds`;
  return null;
}
/** All stories have evidence in box scores, career logs, or recorded awards. No invented quotes or outcomes. */
export function generateNewsFeed(league: League, extras: GMLeagueExtras, maxItems = 150): NewsItem[] {
  const season = league.season ?? 'Unknown season';
  const names = new Map(league.teams.map(t => [t.teamId, t.name]));
  const name = (id: string) => names.get(id) ?? id;
  const items: NewsItem[] = [];
  const add = (item: NewsItem) => items.push({ season, ...item, id: `${item.season ?? season}:${item.id}` });
  const players = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents];
  // The latest World Games, while it is this summer's news.
  const wg = league.worldGames?.history.at(-1);
  if (wg && !activeSeasonPhase(league)) {
    const final = wg.games.find(g => g.stage === 'final');
    add({ id: `world-games:${wg.year}`, category: 'League', teamId: null, teamName: null,
      headline: `${wg.gold} win the ${wg.year} World Games in ${wg.city}.`,
      detail: `${final ? `Final: ${final.a} ${final.as}-${final.bs} ${final.b}. ` : ''}Silver for ${wg.silver}, bronze for ${wg.bronze}.${wg.mvp ? ` Tournament MVP: ${wg.mvp.id} (${wg.mvp.country}).` : ''}`,
      playerId: wg.mvp?.id, order: 300_000 });
  }
  for (const player of players) {
    (player.history ?? []).forEach((event, index) => {
      if (!['drafted', 'injury', 'traded', 'signed', 'waived', 'resigned', 'moved', 'trade_request'].includes(event.type)) return;
      add({ id: `transaction:${player.playerId}:${index}`, season: event.season,
        category: event.type === 'drafted' ? 'Draft' : event.type === 'injury' ? 'Injuries' : 'Transactions',
        teamId: event.teamId ?? null, teamName: event.teamId ? name(event.teamId) : null,
        headline: `${player.playerId}: ${event.description}`, playerId: player.playerId, order: index });
    });
    const events = (player.history ?? []).filter(e => ['drafted', 'signed', 'traded', 'moved'].includes(e.type) && e.teamId);
    const latest = events.at(-1);
    const earlier = events.slice(0, -1);
    const firstAtTeam = earlier.findIndex(e => e.teamId === latest?.teamId);
    const returned = latest && firstAtTeam >= 0 && earlier.slice(firstAtTeam + 1).some(e => e.teamId !== latest.teamId);
    if (returned && latest.season === season && player.teamId === latest.teamId && calculateOverall(player) >= 80) {
      add({ id: `homecoming:${player.playerId}:${events.length}`, category: 'Teams', teamId: latest.teamId!, teamName: name(latest.teamId!),
        headline: `${player.playerId} returns to ${name(latest.teamId!)}.`, detail: 'A familiar jersey, a new chapter. The star has rejoined a franchise from earlier in their career.', playerId: player.playerId, order: 200_000 });
    }
    const stats = player.seasonStats;
    if (isRookieEligible(player) && stats && stats.gamesPlayed >= 5 && stats.points / stats.gamesPlayed >= 20) {
      add({ id: `rookie:${player.playerId}`, category: 'Player Feats', teamId: player.teamId ?? null, teamName: player.teamId ? name(player.teamId) : null,
        headline: `${player.playerId} is making an entrance.`, detail: `The rookie is averaging ${(stats.points / stats.gamesPlayed).toFixed(1)} points through ${stats.gamesPlayed} games. Rookie status is based on previous seasons played, not age.`, playerId: player.playerId, order: 180_000 });
    }
  }
  // During the offseason the schedule can still belong to the prior year. That year's stories are archived.
  const activeSeason = !['draft', 'resign_waive', 'free_agency', 'preseason'].includes(league.seasonPhase ?? 'regular_season');
  const games = activeSeason ? league.schedule.filter(g => g.played && g.result).sort((a, b) => a.round - b.round || a.id.localeCompare(b.id, undefined, { numeric: true })) : [];
  let pointsRecord = 0, threesRecord = 0;
  const matchups = new Map<string, { teams: [string, string]; games: number; close: number; wins: Record<string, number>; order: number }>();
  const addGame = (game: GameResult, id: string, order: number, finals = false, postseason = false) => {
    const lines = [...Object.values(game.homeBox.players), ...Object.values(game.awayBox.players)].filter(l => l.minutes > 0);
    const gamePoints = Math.max(0, ...lines.map(l => l.points));
    const gameThrees = Math.max(0, ...lines.map(l => l.tpm));
    for (const [teamId, opponentId, box, score, oppScore] of [
      [game.homeTeamId, game.awayTeamId, game.homeBox, game.homeScore, game.awayScore],
      [game.awayTeamId, game.homeTeamId, game.awayBox, game.awayScore, game.homeScore],
    ] as const) {
      for (const line of Object.values(box.players)) {
        if (line.minutes <= 0) continue;
        const description = feat(line);
        const outcome = `${score}-${oppScore} ${score > oppScore ? 'win over' : 'loss to'} ${name(opponentId)}`;
        const context = finals ? ' in the Finals' : postseason ? ' in the playoffs' : '';
        if (description) add({ id: `feat:${id}:${line.playerId}`, category: postseason ? 'Playoffs' : 'Player Feats', teamId, teamName: name(teamId),
          headline: `${line.playerId}: ${description}${context}.`,
          detail: `${line.points} PTS · ${line.oreb + line.dreb} REB · ${line.ast} AST · ${line.stl} STL · ${line.blk} BLK · ${line.tpm}/${line.tpa} 3PT. A ${outcome}.`,
          playerId: line.playerId, gameId: postseason ? undefined : id, postseason, order });
        if (!postseason && ((pointsRecord > 0 && line.points > pointsRecord && line.points >= 50 && line.points === gamePoints) || (threesRecord > 0 && line.tpm > threesRecord && line.tpm >= 8 && line.tpm === gameThrees))) {
          const shooting = threesRecord > 0 && line.tpm > threesRecord && line.tpm >= 8 && line.tpm === gameThrees;
          add({ id: `record:${id}:${line.playerId}`, category: 'Records', teamId, teamName: name(teamId),
            headline: `${line.playerId} sets a new season ${shooting ? 'three-point' : 'scoring'} record.`,
            detail: `${shooting ? line.tpm + ' made threes' : line.points + ' points'}, beating the previous league mark of ${shooting ? threesRecord : pointsRecord} in recorded regular-season games. ${outcome}.`,
            playerId: line.playerId, gameId: id, order: order + .1 });
        }
      }
    }
    if (!postseason) {
      pointsRecord = Math.max(pointsRecord, ...lines.map(l => l.points));
      threesRecord = Math.max(threesRecord, ...lines.map(l => l.tpm));
    }
  };
  games.forEach((g, i) => {
    addGame(g.result!, g.id, 1000 + i);
    const teams = [g.homeTeamId, g.awayTeamId].sort() as [string, string];
    const key = JSON.stringify(teams), matchup = matchups.get(key) ?? { teams, games: 0, close: 0, wins: {}, order: 0 };
    matchup.games++; matchup.order = 1000 + i;
    if (Math.abs(g.result!.homeScore - g.result!.awayScore) <= 6) matchup.close++;
    const winner = g.result!.homeScore > g.result!.awayScore ? g.homeTeamId : g.awayTeamId;
    matchup.wins[winner] = (matchup.wins[winner] ?? 0) + 1; matchups.set(key, matchup);
  });
  // Play of the Night: the best one or two recorded highlights from each recent game day.
  const orderOf = new Map(games.map((g, i) => [g.id, 1000 + i]));
  const rounds = [...new Set(games.map(g => g.round))].slice(-HIGHLIGHT_NIGHTS);
  for (const round of rounds) {
    const plays = games.filter(g => g.round === round && g.result?.topPlays?.length)
      .flatMap(g => g.result!.topPlays!.map(play => ({ game: g, play })))
      .sort((a, b) => b.play.score - a.play.score || a.game.id.localeCompare(b.game.id));
    const picked = plays.slice(0, 1);
    const runnerUp = plays.find(p => p.game.id !== picked[0]?.game.id && p.play.score >= 7);
    if (runnerUp) picked.push(runnerUp);
    const nightOrder = Math.max(...games.filter(g => g.round === round).map(g => orderOf.get(g.id) ?? 1000));
    picked.forEach(({ game, play }, rank) => {
      const r = game.result!, label = HIGHLIGHT_LABEL[play.kind as HighlightKind] ?? 'Highlight';
      const winner = r.homeScore > r.awayScore ? game.homeTeamId : game.awayTeamId, loser = winner === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
      add({ id: `highlight:${game.id}:${play.possession}`, category: 'Highlights', teamId: play.teamId, teamName: name(play.teamId),
        headline: `${rank === 0 ? 'Play of the Night' : 'Also on the reel'}: ${play.text}.`,
        detail: `${label} · ${formatGameClock(play.quarter, play.clockSeconds, r.regulationPeriods ?? 4)}, making it ${name(game.homeTeamId)} ${play.homeScoreAfter}–${play.awayScoreAfter} ${name(game.awayTeamId)}. Final: ${name(winner)} ${Math.max(r.homeScore, r.awayScore)}, ${name(loser)} ${Math.min(r.homeScore, r.awayScore)}.`,
        playerId: play.playerId, gameId: game.id, possession: play.possession, order: nightOrder + 0.3 - rank * 0.01 });
    });
  }
  for (const [key, rivalry] of matchups) {
    const [a, b] = rivalry.teams;
    if (rivalry.games >= 3 && rivalry.close >= 2 && rivalry.wins[a] && rivalry.wins[b]) add({ id: `rivalry:${key}`, category: 'Rivalries', teamId: a, teamName: name(a),
      headline: `${name(a)} and ${name(b)} keep trading blows.`, detail: `${rivalry.games} meetings, ${rivalry.close} decided by six points or fewer. Season series: ${name(a)} ${rivalry.wins[a]}–${rivalry.wins[b]} ${name(b)}.`, order: rivalry.order + .2 });
  }
  // Rivals meeting in the playoffs: judged on history from earlier seasons, so the story is about renewed bad blood.
  if (activeSeason) league.playoffBracket?.rounds.forEach((round, roundIndex) => round.forEach(series => {
    if (!series.teamAId || !series.teamBId) return;
    const past = league.rivalries?.[rivalryKey(series.teamAId, series.teamBId)];
    const level = past ? rivalryLevel(past.heat) : null;
    if (!past || !level) return;
    const rounds = ['first round', 'conference semifinals', 'conference finals', 'Finals'];
    const stage = rounds[Math.min(roundIndex, rounds.length - 1)];
    const lastMeeting = past.eliminations.at(-1);
    add({ id: `rival-series:${series.id}`, category: 'Rivalries', teamId: series.teamAId, teamName: name(series.teamAId), postseason: true,
      headline: `Bad blood: ${name(series.teamAId)} and ${name(series.teamBId)} meet again in the ${stage}.`,
      detail: `${level}. ${past.series} previous playoff series (${name(past.a)} ${past.seriesWinsA}–${past.seriesWinsB} ${name(past.b)})${lastMeeting ? `; ${name(lastMeeting.winner)} won the last one in ${lastMeeting.season}` : ''}. All-time regular season: ${past.winsA}–${past.winsB}.`,
      order: 100_000 + roundIndex * 1000 - 1 });
  }));
  // Dynasties: the third title inside five seasons makes it official; every title after extends the run.
  const historyIndex = (season: string) => (league.franchiseHistory ?? []).findIndex(h => h.season === season);
  for (const d of dynasties(league.franchiseHistory ?? [])) d.titles.slice(2).forEach((season, i) => add({ id: `dynasty:${d.teamId}:${season}`, season, category: 'Teams', teamId: d.teamId, teamName: name(d.teamId),
    headline: i === 0 ? `${name(d.teamId)} are a dynasty: three titles in ${historyIndex(season) - historyIndex(d.titles[0]) + 1} seasons.` : `The ${name(d.teamId)} dynasty rolls on: title No. ${i + 3} since ${d.from}.`,
    detail: `Championships: ${d.titles.slice(0, i + 3).join(', ')}. A dynasty banner now hangs in the rafters.`, order: 300_001 }));
  if (activeSeason) league.playoffBracket?.rounds.forEach((round, roundIndex) => round.forEach(series => {
    const finals = roundIndex === league.playoffBracket!.rounds.length - 1;
    series.games.forEach((game, i) => addGame(game, `${series.id}:${i}`, 100_000 + roundIndex * 1000 + i, finals, true));
    if (finals && series.winnerTeamId) add({ id: 'championship', category: 'Playoffs', teamId: series.winnerTeamId, teamName: name(series.winnerTeamId),
      headline: `${name(series.winnerTeamId)} are the ${formatSeasonYear(season)} champions.`, detail: `The Finals end ${Math.max(series.teamAWins, series.teamBWins)}–${Math.min(series.teamAWins, series.teamBWins)}. A new banner is headed for the rafters.`, postseason: true, order: 300_000 });
  }));
  // Players of the Week and Month, filed right after the game day that closed the period.
  const race = league.awardRace?.season === season ? league.awardRace : null;
  for (const h of race?.honors ?? []) {
    let last = -1;
    games.forEach((g, i) => { if (g.round <= h.round) last = i; });
    const conf = h.conference ? `${h.conference === 'east' ? 'Eastern' : 'Western'} Conference ` : '';
    add({ id: `honor:${h.kind}:${h.label}:${h.conference ?? 'league'}`, category: 'Awards', teamId: h.teamId, teamName: h.teamName, playerId: h.playerId,
      headline: `${h.playerId} named ${conf}Player of the ${h.kind === 'week' ? 'Week' : 'Month'} (${h.label}).`,
      detail: `${h.pts.toFixed(1)} points, ${h.reb.toFixed(1)} rebounds and ${h.ast.toFixed(1)} assists a game over ${h.gp} games; ${h.teamName} went ${h.w}–${h.l}.`,
      order: 1000 + last + 0.5 });
  }
  for (const record of league.franchiseHistory ?? []) {
    const a = record.fullAwards;
    if (a?.coy) add({ id: 'award:coy', season: record.season, category: 'Awards', teamId: a.coy.teamId, teamName: a.coy.teamName,
      headline: `${a.coy.coachName ?? a.coy.teamName} is Coach of the Year for ${formatSeasonYear(record.season)}.`, detail: a.votes?.coy?.notes?.slice(1).join('. '), order: 289_000 });
    if (a?.eoy) add({ id: 'award:eoy', season: record.season, category: 'Awards', teamId: a.eoy.teamId, teamName: a.eoy.teamName,
      headline: `The ${a.eoy.teamName} front office${a.eoy.userTeam ? ' (yours)' : ''} is Executive of the Year for ${formatSeasonYear(record.season)}.`, detail: a.votes?.eoy?.notes?.slice(1).join('. '), order: 288_000 });
    if (record.championTeamId) add({ id: 'championship', season: record.season, category: 'Playoffs', teamId: record.championTeamId, teamName: record.championTeamName,
      headline: `${record.championTeamName ?? name(record.championTeamId)} won the ${formatSeasonYear(record.season)} championship.`, order: 300_000 });
    for (const [award, playerId] of [['MVP', record.mvpPlayerId], ['Rookie of the Year', record.royPlayerId], ['Finals MVP', record.fmvpPlayerId]] as const) {
      if (playerId) add({ id: `award:${award}`, season: record.season, category: 'Awards', teamId: null, teamName: null, headline: `${playerId} takes home ${award} for ${formatSeasonYear(record.season)}.`, playerId, order: 290_000 });
    }
  }
  // In-Season Cup: the knockout field, the champion and the Cup MVP (see cup.ts).
  const cup = league.cup;
  if (cup?.knockout) {
    const final = cup.knockout.find(g => g.stage === 'final');
    if (cup.championTeamId) add({ id: 'cup:champion', season: cup.season, category: 'League', teamId: cup.championTeamId, teamName: name(cup.championTeamId),
      headline: `${name(cup.championTeamId)} win the In-Season Cup${final ? `, ${Math.max(final.homeScore, final.awayScore)}–${Math.min(final.homeScore, final.awayScore)} over ${name(cup.runnerUpTeamId ?? '')}` : ''}.`,
      detail: cup.mvpId ? `${cup.mvpId} is the Cup MVP.` : undefined, playerId: cup.mvpId ?? undefined, order: 250_000 });
    if (cup.qualifiers?.length) add({ id: 'cup:knockouts', season: cup.season, category: 'League', teamId: null, teamName: null,
      headline: `The In-Season Cup knockout field is set: ${cup.qualifiers.map(name).join(', ')}.`, order: 249_000 });
  }
  // Trade Deadline Day: each deal as it broke, then the recap (see deadlineDay.ts). Placed just before that night's games.
  const deadline = league.deadlineDay;
  if (deadline) {
    const before = league.schedule.filter(g => g.played && g.result && g.round < deadline.round).length;
    for (const item of deadlineNews(league)) add({ id: item.id, season: deadline.season, category: 'Transactions', teamId: item.teamId,
      teamName: item.teamId ? name(item.teamId) : null, headline: item.headline, detail: item.detail, order: 1000 + before - 0.5 + item.order });
  }
  // Numbers raised to the rafters (AI legends at retirement, or your own choice).
  for (const t of league.teams) for (const j of t.retiredJerseys ?? []) {
    add({ id: `jersey:${t.teamId}:${j.number}`, season: j.season, category: 'Teams', teamId: t.teamId, teamName: t.name,
      headline: `${t.name} retire #${j.number} for ${j.playerId}.`, detail: 'No one on the team will wear it again. The banner goes up in the rafters.', playerId: j.playerId, order: 296_000 });
  }
  // Contract talks with agents: ultimatums, walkouts and deals that went the distance (see agents.ts).
  for (const s of negotiationStories(league, extras)) add({ id: s.id, category: 'Transactions', teamId: s.teamId, teamName: name(s.teamId), headline: s.headline, detail: s.detail, playerId: s.playerId, order: 297_000 });
  // The coaching carousel: firings and hirings around the league.
  for (const c of carouselNews(league)) add({ id: c.id, season: c.season, category: 'Teams', teamId: c.teamId, teamName: name(c.teamId), headline: c.headline, detail: c.detail, order: 298_000 + c.order });
  // Summer League: the champion and the MVP (see draftSeason.ts).
  const sl = league.summerLeague;
  if (sl?.championTeamId) add({ id: 'summer:champion', season: sl.season, category: 'Draft', teamId: sl.championTeamId, teamName: name(sl.championTeamId),
    headline: `${name(sl.championTeamId)} win the Summer League title.`, detail: sl.mvpId ? `${sl.mvpId} was named Summer League MVP.` : undefined, playerId: sl.mvpId ?? undefined, order: 305_000 });
  // Front office: hirings, firings, extensions and hot seats around the league (see frontOffice.ts).
  for (const e of league.frontOffice?.events ?? []) {
    add({ id: `fo:${e.kind}:${e.teamId}:${e.order}`, season: e.season, category: 'Teams', teamId: e.teamId, teamName: e.teamName,
      headline: e.headline, detail: e.detail, order: 310_000 + e.order });
  }
  // GM rivals: what they said after trading with you (see gmRivals.ts).
  for (const r of rivalNews(league)) add({ id: r.id, season: r.season, category: 'Teams', teamId: r.teamId, teamName: name(r.teamId), headline: r.headline, detail: r.detail, order: 295_000 });
  // Family: a retired player's son in the draft class (see family.ts).
  for (const p of extras.draftClass ?? []) for (const f of p.trueSeason.family ?? []) if (f.relation === 'father') {
    add({ id: `family:${p.playerId}`, category: 'Draft', teamId: null, teamName: null, playerId: p.playerId, order: 290_000,
      headline: `${p.playerId}, son of ${f.playerId}, has entered the draft.`, detail: `A familiar name on the big board: his father played in this league.` });
  }
  // Rivalry Week: bragging rights or boos (see rivalryWeek.ts).
  if (league.rivalryWeek?.season === season) for (const r of rivalryWeekNews(league)) {
    const played = league.schedule.findIndex(g => g.id === r.gameId);
    add({ id: r.id, category: 'Rivalries', teamId: r.teamId, teamName: name(r.teamId), headline: r.headline, detail: r.detail, gameId: r.gameId, order: 1000 + played });
  }
  // Prefer freshly derived versions of the same story; cap storage and feed size for long dynasties.
  const unique = new Map<string, NewsItem>();
  for (const item of [...(league.newsArchive ?? []), ...items]) unique.set(item.id, item);
  return [...unique.values()].sort((a, b) => (b.season ?? '').localeCompare(a.season ?? '', undefined, { numeric: true }) || (b.order ?? 0) - (a.order ?? 0) || a.id.localeCompare(b.id)).slice(0, Math.max(0, maxItems));
}

const activeSeasonPhase = (league: League) => !['draft', 'resign_waive', 'free_agency', 'preseason'].includes(league.seasonPhase ?? 'regular_season');
