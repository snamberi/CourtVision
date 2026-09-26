import type { League, SeasonPhase } from '../simulation/league';
import { allStarBreakRound } from '../simulation/league';
import { isTradeDeadlinePassed } from '../simulation/gm';

export type StopId = 'preseason' | 'regular' | 'allStar' | 'deadline' | 'playoffs' | 'awards' | 'draft' | 'resign' | 'freeAgency';
export type StopStatus = 'done' | 'current' | 'next' | 'later';

export interface RoadStop { id: StopId; label: string; status: StopStatus; note?: string }
export interface RoadAction { label: string; tab: string }

export interface RoadMap {
  stops: RoadStop[];
  /** How far along the loop the season is, 0–1, for the progress bar. */
  fill: number;
  now: { title: string; points: string[]; actions: RoadAction[] };
  next?: { title: string; text: string };
}

export interface RoadMapOptions {
  controlledTeamId: string | null;
  autoAllStar: boolean;
  /** Pages still locked in the Simple menu; actions never point at them. */
  lockedTabs?: Set<string>;
  freeAgencyDaysRemaining?: number;
}

export const PHASE_NAMES: Record<SeasonPhase, string> = {
  regular_season: 'Regular Season', all_star: 'All-Star Weekend', playoffs: 'Playoffs', awards_recap: 'Awards Recap',
  draft: 'Draft', resign_waive: 'Re-sign / Waive', free_agency: 'Free Agency', preseason: 'Preseason',
};

const PHASE_STOP: Record<SeasonPhase, StopId> = {
  preseason: 'preseason', regular_season: 'regular', all_star: 'allStar', playoffs: 'playoffs',
  awards_recap: 'awards', draft: 'draft', resign_waive: 'resign', free_agency: 'freeAgency',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The team's unplayed games among the first `count` games of the schedule, in the order they are played. */
function teamGamesWithin(league: League, teamId: string | null, count: number): number {
  const ordered = [...league.schedule].sort((a, b) => a.round - b.round).slice(0, count);
  return ordered.filter((g) => !g.played && (!teamId || g.homeTeamId === teamId || g.awayTeamId === teamId)).length;
}

export function seasonRoadMap(league: League, opts: RoadMapOptions): RoadMap {
  const phase = league.seasonPhase ?? 'regular_season';
  const teamId = opts.controlledTeamId;
  const locked = opts.lockedTabs ?? new Set<string>();
  const open = (tab: string) => !locked.has(tab);

  const mine = league.schedule.filter((g) => !teamId || g.homeTeamId === teamId || g.awayTeamId === teamId);
  const myPlayed = mine.filter((g) => g.played).length;
  const leaguePlayed = league.schedule.filter((g) => g.played).length;
  const seasonDone = league.schedule.length > 0 && leaguePlayed === league.schedule.length;

  const breakRound = allStarBreakRound(league);
  const allStarOn = breakRound != null;
  const allStarDone = league.allStarWeekend?.season === (league.season ?? '') && league.allStarWeekend.completed === true;
  const allStarPct = (league.rulesSettings?.allStarBreakPercent ?? 58) / 100;
  const deadlinePct = league.settings.tradeDeadlinePct ?? 0.65;
  const deadlinePassed = isTradeDeadlinePassed(league) || (phase === 'regular_season' && seasonDone);
  const gamesToBreak = allStarOn ? mine.filter((g) => !g.played && g.round < breakRound).length : 0;
  const gamesToDeadline = teamGamesWithin(league, teamId, Math.ceil(deadlinePct * league.schedule.length));

  // Stops in the order they happen this season; the All-Star break and the trade deadline swap if the rules put the deadline first.
  const milestones: StopId[] = allStarOn
    ? (allStarPct <= deadlinePct ? ['allStar', 'deadline'] : ['deadline', 'allStar'])
    : ['deadline'];
  const order: StopId[] = ['preseason', 'regular', ...milestones, 'playoffs', 'awards', 'draft', 'resign', 'freeAgency'];
  const LABEL: Record<StopId, string> = {
    preseason: 'Preseason', regular: 'Regular season', allStar: 'All-Star', deadline: 'Trade deadline', playoffs: 'Playoffs',
    awards: 'Awards', draft: 'Draft', resign: 'Re-sign', freeAgency: 'Free agency',
  };

  const currentId = PHASE_STOP[phase];
  const currentIndex = order.indexOf(currentId);
  const inRegular = phase === 'regular_season';
  const milestoneDone = (id: StopId) => (id === 'allStar' ? allStarDone : deadlinePassed);

  const stops: RoadStop[] = order.map((id, i) => {
    let status: StopStatus;
    if (inRegular && (id === 'allStar' || id === 'deadline')) status = milestoneDone(id) ? 'done' : 'later';
    else if (i < currentIndex) status = 'done';
    else if (i === currentIndex) status = 'current';
    else status = 'later';
    let note: string | undefined;
    if (id === 'regular' && (inRegular || phase === 'all_star')) note = `${myPlayed} / ${mine.length} games`;
    if (inRegular && status === 'later' && id === 'allStar') note = gamesToBreak > 0 ? `in ${plural(gamesToBreak, 'game')}` : 'next';
    if (inRegular && status === 'later' && id === 'deadline') note = gamesToDeadline > 0 ? `in ${plural(gamesToDeadline, 'game')}` : 'next';
    return { id, label: LABEL[id], status, ...(note ? { note } : {}) };
  });
  const nextStop = stops.find((s, i) => i > currentIndex && s.status === 'later');
  if (nextStop) nextStop.status = 'next';

  // Progress: the regular season stretches from its own stop to the playoffs, in proportion to games played.
  const playoffsIndex = order.indexOf('playoffs');
  const position = inRegular && league.schedule.length > 0
    ? currentIndex + (leaguePlayed / league.schedule.length) * (playoffsIndex - currentIndex)
    : currentIndex;
  const fill = Math.max(0, Math.min(1, position / (order.length - 1)));

  const now = whatMattersNow(phase, { seasonDone, deadlinePassed, open, freeAgencyDays: opts.freeAgencyDaysRemaining ?? 0, championCrowned: !!league.playoffBracket?.championTeamId });
  const next = nextStop ? comingUp(nextStop, { autoAllStar: opts.autoAllStar, gamesToBreak, gamesToDeadline, gamesLeft: mine.length - myPlayed }) : undefined;
  return { stops, fill, now, ...(next ? { next } : {}) };
}

function whatMattersNow(phase: SeasonPhase, s: { seasonDone: boolean; deadlinePassed: boolean; open: (tab: string) => boolean; freeAgencyDays: number; championCrowned: boolean }): RoadMap['now'] {
  const act = (label: string, tab: string): RoadAction[] => (s.open(tab) ? [{ label, tab }] : []);
  switch (phase) {
    case 'preseason':
      return { title: 'Preseason', points: [
        'Free agency has closed and rosters are set for the new season.',
        'Check your rotation before the games count.',
        'Press Play › Start Regular Season when you are ready.',
      ], actions: [...act('Check my rotation', 'yourTeam'), ...act('Preseason report', 'preseason')] };
    case 'all_star':
      return { title: 'All-Star weekend', points: [
        'The regular season pauses until the weekend is played.',
        'Open All-Star Central to see who made the teams and run the contests, or press Play to sim the weekend.',
      ], actions: act('All-Star Central', 'allStarWeekend') };
    case 'playoffs':
      return s.championCrowned
        ? { title: 'Champions crowned', points: ['The playoffs are over. Press Play to see the season recap and the award winners.'], actions: act('Playoff bracket', 'playoffs') }
        : { title: 'Playoffs', points: [
          'Play the bracket round by round on the Playoffs page, or press Play to simulate it all.',
          'Teams that missed out wait for the draft.',
        ], actions: act('Playoff bracket', 'playoffs') };
    case 'awards_recap':
      return { title: 'Season awards', points: [
        'See who won MVP and the other awards.',
        'Press Play to continue to the draft.',
      ], actions: act('Awards', 'awards') };
    case 'draft':
      return { title: 'Draft night', points: [
        'Two rounds of rookies. On the Draft page, To Your Next Pick skips ahead to your turn.',
        'Play can also sim the whole draft for you.',
      ], actions: act('Draft board', 'draft') };
    case 'resign_waive':
      return { title: 'Re-sign and waive', points: [
        'Re-sign the players with expiring contracts you want to keep.',
        'Waive anyone you no longer need, then press Play to open free agency.',
      ], actions: act('Re-sign / waive', 'resignWaive') };
    case 'free_agency':
      return { title: 'Free agency', points: [
        'Sign free agents to fill out your roster.',
        s.freeAgencyDays > 0 ? `${plural(s.freeAgencyDays, 'day')} left. Play can skip the rest and move on to preseason.` : 'Free agency has run its course. Press Play to move on to preseason.',
      ], actions: act('Free agents', 'freeAgency') };
    default:
      if (s.seasonDone) {
        return { title: 'Regular season complete', points: ['Every game is played. Press Play to begin the playoffs.'], actions: act('Standings', 'standings') };
      }
      return { title: 'Regular season', points: [
        'Play games and watch your record and your players\' form.',
        'Players who get fewer minutes than they expect lose morale, and some ask to be traded.',
        s.deadlinePassed
          ? 'The trade deadline has passed. Trades reopen when the regular season ends.'
          : s.open('trade') ? 'Trades are open until the trade deadline.' : 'Trades and free agents unlock after your first five games.',
      ], actions: [...act('Check my rotation', 'yourTeam'), ...(s.deadlinePassed ? [] : act('Look for a trade', 'trade')), ...act('Standings', 'standings')] };
  }
}

function comingUp(stop: RoadStop, s: { autoAllStar: boolean; gamesToBreak: number; gamesToDeadline: number; gamesLeft: number }): RoadMap['next'] {
  switch (stop.id) {
    case 'allStar':
      return { title: 'All-Star weekend', text: `${s.gamesToBreak > 0 ? `In ${plural(s.gamesToBreak, 'game')}. ` : ''}${s.autoAllStar
        ? 'It plays automatically when the break arrives. Turn that off in the Play menu to run the contests yourself.'
        : 'The Play button stops at the break so you can run the contests in All-Star Central.'}` };
    case 'deadline':
      return { title: 'Trade deadline', text: `${s.gamesToDeadline > 0 ? `In ${plural(s.gamesToDeadline, 'game')}. ` : ''}After it, trades close until the regular season ends.` };
    case 'playoffs':
      return { title: 'Playoffs', text: `${s.gamesLeft > 0 ? `${plural(s.gamesLeft, 'game')} left for your team. ` : ''}After the last regular-season game, Play offers the playoffs.` };
    case 'awards':
      return { title: 'Season awards', text: 'Once a champion is crowned, the season recap names the MVP and the other award winners.' };
    case 'draft':
      return { title: 'The draft', text: 'The worst records get the best odds in the lottery for the top picks. Scout the class on the Draft page.' };
    case 'resign':
      return { title: 'Re-signing', text: 'After the draft, decide which players with expiring contracts to keep.' };
    case 'freeAgency':
      return { title: 'Free agency', text: 'Players whose contracts ran out and were not re-signed join the free-agent pool.' };
    case 'preseason':
      return { title: 'Preseason', text: 'Rosters are set for the new season, and Play starts the regular season.' };
    default:
      return { title: stop.label, text: '' };
  }
}
