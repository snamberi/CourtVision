import { initializeCoaching } from './simulation/staffManagement';
import { setupCup } from './simulation/cup';
import { advanceDeadlineHour, deadlineClock, describeDeadlineTrade, isBlockbuster, isDeadlineDayDue, isDeadlineDayOpen, openDeadlineDay, runToDeadline, scheduleDeadlineDay, tradeDeadlineEnabled, type DeadlineHourResult } from './simulation/deadlineDay';
import { TeamLinksProvider, TeamLink } from './components/TeamLink';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { SANDBOX_TABS, canEditTeam } from './navigation/permissions';
import { TeamIdentityProvider } from './visuals/TeamIdentityContext';
import { SaveRecoveryPanel } from './components/SaveRecoveryPanel';
import { parseRoute, routeHash, type Tab } from './navigation/routes';
import { useGameHistory } from './navigation/useGameHistory';
import { manageCoachRosters, normalizeRosterRules, ROSTER_LIMITS } from './simulation/coachRosters';
import { currentDraftOrder } from './simulation/gm';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './pixel.css';
import './tutorial.css';
import './polish.css';
import './awards.css';
import './contrast.css';
import './frontOffice.css';
import './design.css';
import './features.css';
import './theme/themes.css';
import { CoachGuide } from './components/tutorial/CoachGuide';
import { SeasonRoadMap } from './components/tutorial/SeasonRoadMap';
import { FirstSeasonChecklist } from './components/tutorial/FirstSeasonChecklist';
import { UnlockNotice } from './components/tutorial/UnlockNotice';
import { LessonsSettingsCard } from './components/tutorial/LessonsSettingsCard';
import { createTutorial, markVisited, navModeOf, readPreferredNavMode, readTourSeen, rememberNavMode, rememberTourSeen, tutorialOf, updateTutorial, type NavMode, type TutorialState } from './tutorial/tutorialState';
import { featureForTab, featureStatuses, lockedFeatures, newTabs as newFeatureTabs, pendingUnlockNotices, type Feature } from './tutorial/unlocks';
import { lessonStatuses, type HintId, type Lesson } from './tutorial/lessons';
import { hintStep, tourSteps } from './tutorial/guide';
import { PHASE_NAMES, seasonRoadMap } from './tutorial/roadmap';
import { PixelIcon } from './components/PixelIcon';
import logoIcon from './assets/brand/logo-icon.png';
import { buildDemoTeam } from './simulation/presets/samplePlayers';
import { simulateGame, type LiveCoachingCommand } from './simulation/engine/game';
import { compactLeagueLogs } from './simulation/logPacking';
import { DEFAULT_GAME_SETTINGS } from './simulation/types';
import type { GameResult } from './simulation/boxscore';
import type { League, LeagueTeam } from './simulation/league';
import { generateRoundRobinSchedule, simulateFullRound, simulateRounds, gamesRemainingForTeam, computeStandings, computeConferenceStandings, hasConferenceStructure, isAllStarBreakPending } from './simulation/league';
import { generateFullLeague } from './simulation/leagueGenerator';
import { developOffseasonLeague } from './simulation/engine/development';
import { followsRealDevelopment } from './simulation/realDevelopmentGate';
import { applyHistoricalRosters } from './history/realRollover';
import { enforceSticky } from './simulation/sticky';
import { collectPress } from './simulation/press';
import { pendingDecisions } from './simulation/medical';
import { crowdFill, arenaLevels } from './simulation/business';
import { useBackgroundJobs } from './workers/useBackgroundJobs';
import { ToastStack, type ToastData } from './components/ToastStack';
import { PrivacyPolicyPage, PrivacyLink } from './components/PrivacyPolicyPage';
import { ConsentBanner, CookieSettingsLink } from './consent/ConsentBanner';
import { AD_CONFIG } from './ads/adConfig';
import { loadGoogleConsentTool } from './ads/adsense';
import { hasEntitlement } from './profile/cosmetics';
import { IS_DESKTOP_BUILD } from './appMode';
import { MainMenu, type GameMode, type RealLeagueOptions } from './components/MainMenu';
import { SettingsPage } from './components/SettingsPage';
import { ChooseTeamScreen } from './components/ChooseTeamScreen';
import { retireJerseyNumber, unretireJerseyNumber } from './simulation/league';
import { collectPlayerIds, withUniquePlayerId } from './simulation/playerIds';
import { repairDuplicatePlayerIds } from './simulation/playerIntegrity';
import { syncLeaguePotentials } from './simulation/potentialMigration';
import { backfillRecordBook } from './simulation/records';
import { LeagueSettingsPage, type AwardSettings } from './components/LeagueSettingsPage';
import { DEFAULT_LEAGUE_RULES } from './simulation/leagueRules';
import { rivalryBadge } from './simulation/rivalry';
import { rivalryWeekGame, rivalryHype } from './simulation/rivalryWeek';
import { duoKeys } from './simulation/chemistryWeb';
import { coachLook } from './visuals/coachLook';
import { ownerBest, OWNER_REWARD } from './profile/cosmetics';
import { startOwnership, recordOwnerLegacy } from './simulation/ownerBox';
import { ensureGmRivals } from './simulation/gmRivals';
import type { Speech } from './simulation/halftime';
import type { NbaHistory } from './history/nbaHistoryData';
import { HistoricalSettingsCard } from './components/HistoricalSettingsCard';
import { migrateHistoricalLeague } from './history/migrateHistorical';
import { stripNameYears } from './history/nameYears';
import { DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, generateDraftClass, pickDraftClassSize, buildTwoRoundDraftOrder, generateFutureDraftPicks, isTradeDeadlinePassed, simulateUntilTradeDeadline, waiveToFreeAgency, toggleTradeBlock, type GMLeagueExtras, type Contract, type TradeDifficulty } from './simulation/gm';
import { RNG } from './simulation/engine/rng';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule, type SeasonTransitionSummary } from './simulation/seasonTransition';
import { acceptJobOffer, becomeSpectator, ensureFrontOffice, markSandboxUse, isOfficialLeague, ACHIEVEMENT_BY_ID, type OwnerReview } from './simulation/frontOffice';
import { JobOffersDialog, OwnerReviewDialog } from './components/FrontOfficePanels';
import { recordLeagueLegacy } from './storage/gmLegacy';
import { challengeProgress, recordRebuild, scenarioById } from './simulation/rebuildChallenge';
import { weeklyRebuild, recordWeekly, TWISTS, type WeeklyRebuild } from './retention/weekly';
import { decodeLeagueCode, encodeLeagueCode, type LeagueOrigin } from './retention/leagueCode';
import { recordCodeResult } from './retention/codeResults';
import { syncSoon } from './cloud/sync';
import { track, trackOnce } from './analytics/track';
import { ChallengeBanner } from './components/ChallengeBanner';
import { rebuildSnapshot } from './simulation/rebuildSnapshot';
import { DailyGoalsCard } from './components/DailyGoalsCard';
import { LeagueCodeBox } from './components/LeagueCodeBox';
import { updateDailyGoals, todayUtc } from './profile/dailyGoals';
import { FEATS_EVENT } from './profile/feats';
import { LEGACY_EVENT } from './storage/gmLegacy';
import { DAILY_EVENT } from './profile/dailyGoals';
import { BackupPanel } from './components/BackupPanel';
import { canPlaySummerLeague, ensureUpcomingDraftClass, simulateSummerLeague } from './simulation/draftSeason';
import { runLeagueAIPass, autoDraftAIPicksUntilUserTurn, simEntireDraft, runFreeAgencyAI } from './simulation/aiGM';
import { autoRunAllStarWeekend } from './simulation/autoPlay';
import { autoGeneratePlayoffBracket, simulateFullPlayoffs, type PlayoffBracket } from './simulation/playoffs';
import { rosterComplianceIssues } from './simulation/rosterRequirements';
import { PlayButton } from './components/PlayButton';
import { addDays, formatDisplayDate, formatSeasonYear } from './simulation/calendar';
import { awardOptions, computeFinalsMVP, finalsMVPLine, normalizeAwardSettings, seasonGamesPerTeam } from './simulation/awards';
import { ChampionshipCelebration, type CelebrationInfo } from './components/ChampionshipCelebration';
import { Sidebar } from './components/Sidebar';
import { TeamLogo } from './components/TeamLogo';
import { AdBanner } from './components/AdBanner';
import { DownloadButton } from './components/DownloadButton';
import { SETTINGS_PRESETS, type PresetName } from './simulation/settingsPresets';
import { downloadUniverse, readUniverseFromFile } from './storage/universeIO';
import {
  listSaves, createSave, updateSave, deleteSave, renameSave, getSave,
  migrateLegacyAutosaveIfNeeded, createDebouncedSave, type SaveSummary,
} from './storage/saves';

// Pages load on demand (code-split): the first paint only needs the shell, sidebar and Play button.
import { needsRetireeData } from './history/retirees';
import { pendingOffers } from './simulation/staffPoaching';
const StaffPage = lazy(() => import('./components/StaffPage').then(m => ({ default: m.StaffPage })));
const TeamProfilePage = lazy(() => import('./components/TeamProfilePage').then(m => ({ default: m.TeamProfilePage })));
const SandboxPage = lazy(() => import('./components/SandboxPage').then(m => ({ default: m.SandboxPage })));
const CoachingPage = lazy(() => import('./components/CoachingPage').then(m => ({ default: m.CoachingPage })));
const PlayerProfile = lazy(() => import('./components/PlayerProfile').then(m => ({ default: m.PlayerProfile })));
const SimulationLab = lazy(() => import('./components/SimulationLab').then(m => ({ default: m.SimulationLab })));
const PlayerDatabase = lazy(() => import('./components/PlayerDatabase').then(m => ({ default: m.PlayerDatabase })));
const StandingsPage = lazy(() => import('./components/StandingsPage').then(m => ({ default: m.StandingsPage })));
const ThreeTeamTradePage = lazy(() => import('./components/ThreeTeamTradePage').then(m => ({ default: m.ThreeTeamTradePage })));
const ExtensionsPage = lazy(() => import('./components/ExtensionsPage').then(m => ({ default: m.ExtensionsPage })));
const LeagueHunt = lazy(() => import('./components/hunt/LeagueHunt').then(m => ({ default: m.LeagueHunt })));
const CareerImportPanel = lazy(() => import('./components/career/CareerImportPanel').then(m => ({ default: m.CareerImportPanel })));
const ProfileHub = lazy(() => import('./components/locker/ProfileHub').then(m => ({ default: m.ProfileHub })));
const AllTimeDraft = lazy(() => import('./components/draft/AllTimeDraft').then(m => ({ default: m.AllTimeDraft })));
const Community = lazy(() => import('./components/cloud/Community').then(m => ({ default: m.Community })));
const CareerMode = lazy(() => import('./components/career/CareerMode').then(m => ({ default: m.CareerMode })));
const SummerCampPage = lazy(() => import('./components/SummerCampPage').then(m => ({ default: m.SummerCampPage })));
const MedicalRoomPage = lazy(() => import('./components/MedicalRoomPage').then(m => ({ default: m.MedicalRoomPage })));
const FranchiseTimelinePage = lazy(() => import('./components/FranchiseTimelinePage').then(m => ({ default: m.FranchiseTimelinePage })));
const OwnerBoxPage = lazy(() => import('./components/OwnerBoxPage').then(m => ({ default: m.OwnerBoxPage })));
const GmRivalsPage = lazy(() => import('./components/GmRivalsPage').then(m => ({ default: m.GmRivalsPage })));
const CardAlbumPage = lazy(() => import('./components/CardAlbumPage').then(m => ({ default: m.CardAlbumPage })));
const RoadTripsPage = lazy(() => import('./components/RoadTripsPage').then(m => ({ default: m.RoadTripsPage })));
const PressRoomPage = lazy(() => import('./components/PressRoomPage').then(m => ({ default: m.PressRoomPage })));
const SchedulePage = lazy(() => import('./components/SchedulePage').then(m => ({ default: m.SchedulePage })));
const BulkEditor = lazy(() => import('./components/BulkEditor').then(m => ({ default: m.BulkEditor })));
const FinancesPage = lazy(() => import('./components/FinancesPage').then(m => ({ default: m.FinancesPage })));
const TradePage = lazy(() => import('./components/TradePage').then(m => ({ default: m.TradePage })));
const TradeBlockPage = lazy(() => import('./components/TradeBlockPage').then(m => ({ default: m.TradeBlockPage })));
const TradeOffersPage = lazy(() => import('./components/TradeOffersPage').then(m => ({ default: m.TradeOffersPage })));
const FreeAgencyPage = lazy(() => import('./components/FreeAgencyPage').then(m => ({ default: m.FreeAgencyPage })));
const DraftPage = lazy(() => import('./components/DraftPage').then(m => ({ default: m.DraftPage })));
const AllStarWeekendPage = lazy(() => import('./components/AllStarWeekendPage').then(m => ({ default: m.AllStarWeekendPage })));
/** NBA history: the dataset loader (with its decompressor) and the league builder load only when a historical league needs them. */
const historyTools = () => Promise.all([import('./history/nbaHistoryData'), import('./history/historicalLeague')])
  .then(([data, builder]) => data.loadNbaHistory().then((h: NbaHistory) => ({ h, ...builder })));
const AutoPlayPage = lazy(() => import('./components/AutoPlayPage').then(m => ({ default: m.AutoPlayPage })));
const LegendsPage = lazy(() => import('./components/LegendsPage').then(m => ({ default: m.LegendsPage })));
const CodeMode = lazy(() => import('./components/CodeMode').then(m => ({ default: m.CodeMode })));
const ImportPage = lazy(() => import('./components/ImportPage').then(m => ({ default: m.ImportPage })));
const TeamRosterPage = lazy(() => import('./components/TeamRosterPage').then(m => ({ default: m.TeamRosterPage })));
const PlayoffsPage = lazy(() => import('./components/PlayoffsPage').then(m => ({ default: m.PlayoffsPage })));
const YourTeamPage = lazy(() => import('./components/YourTeamPage').then(m => ({ default: m.YourTeamPage })));
const FastEditPage = lazy(() => import('./components/FastEditPage').then(m => ({ default: m.FastEditPage })));
const ComparePage = lazy(() => import('./components/ComparePage').then(m => ({ default: m.ComparePage })));
const AwardsPage = lazy(() => import('./components/AwardsPage').then(m => ({ default: m.AwardsPage })));
const InjuryReportPage = lazy(() => import('./components/InjuryReportPage').then(m => ({ default: m.InjuryReportPage })));
const LeagueRulesPage = lazy(() => import('./components/LeagueRulesPage').then(m => ({ default: m.LeagueRulesPage })));
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const FranchiseHistoryPage = lazy(() => import('./components/FranchiseHistoryPage').then(m => ({ default: m.FranchiseHistoryPage })));
const TeamHistoryPage = lazy(() => import('./components/TeamHistoryPage').then(m => ({ default: m.TeamHistoryPage })));
const NbaArchivePage = lazy(() => import('./components/NbaArchivePage').then(m => ({ default: m.NbaArchivePage })));
const RecordsPage = lazy(() => import('./components/RecordsPage').then(m => ({ default: m.RecordsPage })));
const AlmanacPage = lazy(() => import('./components/AlmanacPage').then(m => ({ default: m.AlmanacPage })));
const ResignWaivePage = lazy(() => import('./components/ResignWaivePage').then(m => ({ default: m.ResignWaivePage })));
const PreseasonPage = lazy(() => import('./components/PreseasonPage').then(m => ({ default: m.PreseasonPage })));
const CupPage = lazy(() => import('./components/CupPage').then(m => ({ default: m.CupPage })));
const YearInReviewPage = lazy(() => import('./components/YearInReviewPage').then(m => ({ default: m.YearInReviewPage })));
const DeadlineDayPage = lazy(() => import('./components/DeadlineDayPage').then(m => ({ default: m.DeadlineDayPage })));
const SummerLeaguePage = lazy(() => import('./components/SummerLeaguePage').then(m => ({ default: m.SummerLeaguePage })));
const GmOfficePage = lazy(() => import('./components/FrontOfficePanels').then(m => ({ default: m.GmOfficePage })));
const DashboardPage = lazy(() => import('./components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PlayerStatsPage = lazy(() => import('./components/PlayerStatsPage').then(m => ({ default: m.PlayerStatsPage })));
const PowerRankingsPage = lazy(() => import('./components/PowerRankingsPage').then(m => ({ default: m.PowerRankingsPage })));
const TransactionsPage = lazy(() => import('./components/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const WatchListPage = lazy(() => import('./components/WatchListPage').then(m => ({ default: m.WatchListPage })));
const TeamStatsPage = lazy(() => import('./components/TeamStatsPage').then(m => ({ default: m.TeamStatsPage })));
const DailySchedulePage = lazy(() => import('./components/DailySchedulePage').then(m => ({ default: m.DailySchedulePage })));
const StorylinesPage = lazy(() => import('./components/StorylinesPage').then(m => ({ default: m.StorylinesPage })));
const NewsFeedPage = lazy(() => import('./components/NewsFeedPage').then(m => ({ default: m.NewsFeedPage })));
const HallOfFamePage = lazy(() => import('./components/HallOfFamePage').then(m => ({ default: m.HallOfFamePage })));
const GameBoxScorePage = lazy(() => import('./components/GameBoxScorePage').then(m => ({ default: m.GameBoxScorePage })));
const DevelopmentCenterPage = lazy(() => import('./components/DevelopmentCenterPage').then(m => ({ default: m.DevelopmentCenterPage })));
const CoachingSettingsPanel = lazy(() => import('./components/DevelopmentCenterPage').then(m => ({ default: m.CoachingSettingsPanel })));

function buildInitialLeague(): League {
  const teams: LeagueTeam[] = [
    { ...buildDemoTeam('WOLVES', 'Timber Wolves') },
    { ...buildDemoTeam('COMETS', 'City Comets') },
    { ...buildDemoTeam('GRANITE', 'Granite Kings') },
    { ...buildDemoTeam('EMBERS', 'River Embers') },
  ].map((t) => ({ teamId: t.teamId, name: t.label, seasons: t.seasons }));
  const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 1);
  return { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: '2025' };
}

function buildInitialExtras(league: League): GMLeagueExtras {
  const contracts: Record<string, Contract> = {};
  for (const t of league.teams) {
    for (const s of t.seasons) {
      contracts[s.playerId] = {
        playerId: s.playerId, teamId: t.teamId,
        annualSalary: 5_000_000 + Math.round(s.attributes.offense.threePoint * 100_000),
        yearsRemaining: 3, playerOption: false, teamOption: false,
      };
    }
  }
  const startYear = parseInt((league.season ?? '2026').slice(0, 4), 10) + 1;
  return {
    contracts,
    freeAgents: [],
    capSettings: { ...DEFAULT_CAP_SETTINGS },
    draftClass: generateDraftClass(pickDraftClassSize(league.teams.length, new RNG(startYear)), startYear, String(startYear), collectPlayerIds(league)),
    draftOrder: buildTwoRoundDraftOrder(league, startYear),
    tradeSettings: { ...DEFAULT_TRADE_SETTINGS },
    futurePicks: generateFutureDraftPicks(league.teams.map((t) => t.teamId), startYear),
    ...DEFAULT_GM_FLAGS,
  };
}

type Screen = 'menu' | 'chooseTeam' | 'app' | 'hunt' | 'career' | 'locker' | 'profile' | 'community' | 'draft' | 'settings';

const debouncedSave = createDebouncedSave();

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [saveSummaries, setSaveSummaries] = useState<SaveSummary[]>([]);
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  const [pendingLeagueName, setPendingLeagueName] = useState('My League');
  const [league, setLeague] = useState<League>(buildInitialLeague);
  const [extras, setExtras] = useState<GMLeagueExtras>(() => buildInitialExtras(league));
  const [pendingLeague, setPendingLeague] = useState<League | null>(null);
  const [pendingExtras, setPendingExtras] = useState<GMLeagueExtras | null>(null);
  const [controlledTeamId, setControlledTeamId] = useState<string | null>(null);
  const sandboxMode = league.settings.sandboxMode === true;
  // Turning Sandbox on marks the league for good: its GM record and achievements stop counting.
  const setSandboxMode = (enabled: boolean) => setLeague(l => markSandboxUse({ ...l, settings: { ...l.settings, sandboxMode: enabled } }));
  const [confirmation, setConfirmation] = useState<'sandbox' | 'exit' | null>(null);
  const [viewedTeamId, setViewedTeamId] = useState<string>('');
  const managerId = sandboxMode ? null : controlledTeamId ?? '__spectator__';
  const [seed, setSeed] = useState(1234);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => league.teams[0]?.seasons[0]?.playerId ?? '');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [exhibitionHomeId, setExhibitionHomeId] = useState(() => league.teams[0]?.teamId ?? '');
  const [exhibitionAwayId, setExhibitionAwayId] = useState(() => league.teams[1]?.teamId ?? '');
  const [requestedTab, setRequestedTab] = useState<Tab>('database');
  /** Every page change goes through here, so opening a lesson's page ticks it off the checklist. */
  const setTab = useCallback((next: Tab) => {
    setRequestedTab(next);
    setLeague((l) => markVisited(l, next));
  }, []);
  const tab: Tab = !sandboxMode && SANDBOX_TABS.has(requestedTab) ? 'sandbox' : requestedTab;
  const [seasonSummary, setSeasonSummary] = useState<SeasonTransitionSummary | null>(null);
  const [ownerVerdict, setOwnerVerdict] = useState<{ review: OwnerReview; newAchievements: string[] } | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const pushToast = useCallback((message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]); // each toast times itself out (see ToastStack) based on its length
  }, []);
  useEffect(() => {
    const failed = () => pushToast('Autosave failed. Your previous save is intact. Export your universe to keep your latest progress.', 'error');
    window.addEventListener('courtvision:save-error', failed);
    return () => window.removeEventListener('courtvision:save-error', failed);
  }, [pushToast]);
  const dismissToast = useCallback((id: number) => setToasts((cur) => cur.filter((x) => x.id !== id)), []);
  // Award settings live in the league, so they're saved with it and travel with Auto Play.
  const awardSettings = useMemo<AwardSettings>(() => normalizeAwardSettings(league.awardSettings), [league.awardSettings]);
  const setAwardSettings = useCallback((next: AwardSettings) => setLeague((l) => ({ ...l, awardSettings: normalizeAwardSettings(next) })), [setLeague]);
  const [leagueSettingsSub, setLeagueSettingsSub] = useState<'awards' | 'rules'>('awards');
  const playoffBracket = league.playoffBracket ?? null;
  const setPlayoffBracket = (bracket: PlayoffBracket | null) => setLeague(l => ({ ...l, playoffBracket: bracket ?? undefined }));
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  /** The title celebration for the current bracket's champion (the whole roster, the Finals MVP holding his trophy). */
  const celebrationFor = useCallback((bracket: PlayoffBracket, l: League): CelebrationInfo | null => {
    if (!bracket.championTeamId) return null;
    const finals = bracket.rounds[bracket.rounds.length - 1]?.[0];
    const line = finalsMVPLine(finals, l);
    const name = (id: string | null) => l.teams.find(t => t.teamId === id)?.name ?? id ?? '';
    const loser = finals ? (finals.winnerTeamId === finals.teamAId ? finals.teamBId : finals.teamAId) : null;
    const wins = finals ? Math.max(finals.teamAWins, finals.teamBWins) : 0, losses = finals ? Math.min(finals.teamAWins, finals.teamBWins) : 0;
    return { teamId: bracket.championTeamId, season: l.season ?? '', fmvpId: line?.winner.playerId ?? null,
      fmvpLine: line ? `${line.ppg.toFixed(1)} PTS · ${line.rpg.toFixed(1)} REB · ${line.apg.toFixed(1)} AST in ${line.games} games` : undefined,
      seriesLine: finals && loser ? `Won the Finals ${wins}–${losses} over the ${name(loser)}` : undefined };
  }, []);
  // The moment a champion is crowned, raise the trophy (once per bracket; replayable from Awards and Playoffs).
  useEffect(() => {
    if (screen !== 'app' || !playoffBracket?.championTeamId || playoffBracket.celebrated) return;
    const info = celebrationFor(playoffBracket, league);
    setLeague(l => l.playoffBracket ? { ...l, playoffBracket: { ...l.playoffBracket, celebrated: true } } : l);
    if (info) setCelebration(info);
  }, [screen, playoffBracket, league, celebrationFor]);
  const replayCelebration = playoffBracket?.championTeamId ? () => setCelebration(celebrationFor(playoffBracket, league)) : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [viewedGameId, setViewedGameId] = useState<string | null>(null);
  const [watchNextResult, setWatchNextResult] = useState(false);
  const [watchStart, setWatchStart] = useState<number | undefined>(undefined);
  const [coachSession, setCoachSession] = useState<{ base: League; baseExtras: GMLeagueExtras; gameId: string; teamId: string; commands: LiveCoachingCommand[]; committed: League; openCoach?: boolean } | null>(null);
  const [communityUser, setCommunityUser] = useState<string | null>(null);
  const [boxscoreSource, setBoxscoreSource] = useState<'league' | 'exhibition'>('league');

  const currentRoute = screen === 'menu' ? '#/menu' : screen === 'chooseTeam' ? '#/choose-team' : screen === 'hunt' ? '#/hunt' : screen === 'career' ? '#/career' : screen === 'locker' ? '#/locker' : screen === 'profile' ? '#/profile' : screen === 'settings' ? '#/settings' : screen === 'draft' ? '#/draft' : screen === 'community' ? (communityUser ? `#/u/${encodeURIComponent(communityUser)}` : '#/community')
    : activeSaveId ? routeHash({ saveId: activeSaveId, tab, player: selectedPlayerId,
      team: viewedTeamId, game: viewedGameId ?? undefined, source: boxscoreSource, sub: leagueSettingsSub }) : null;
  const { restoring, showPrivacy, closePrivacy } = useGameHistory(currentRoute, async (hash, isCurrent) => {
    await debouncedSave.flush();
    if (!isCurrent()) return;
    const route = parseRoute(hash);
    if (!route) {
      jobs.resetAll();
      const profileMatch = hash.match(/^#\/u\/(.+)$/);
      setCommunityUser(profileMatch ? decodeURIComponent(profileMatch[1]) : null);
      setScreen(hash === '#/choose-team' && pendingLeague ? 'chooseTeam' : hash === '#/hunt' ? 'hunt' : hash === '#/career' ? 'career' : hash === '#/locker' ? 'locker' : hash === '#/profile' ? 'profile' : hash === '#/settings' ? 'settings' : hash === '#/community' || profileMatch ? 'community' : hash === '#/draft' ? 'draft' : 'menu');
      refreshSaves();
      return;
    }
    if (activeSaveId !== route.saveId || screen !== 'app') {
      const snapshot = await getSave(route.saveId);
      if (!isCurrent()) return;
      if (!snapshot) {
        setScreen('menu'); setActiveSaveId(null);
        pushToast('This saved league is no longer available on this browser.', 'error');
        return;
      }
      enterApp(snapshot.league, snapshot.extras, snapshot.controlledTeamId ?? null, undefined, route.saveId);
    }
    setTab(route.tab);
    setViewedTeamId(route.team ?? '');
    if (route.player) setSelectedPlayerId(route.player);
    setViewedGameId(route.game ?? null);
    setBoxscoreSource(route.source ?? 'league');
    setLeagueSettingsSub(route.sub ?? 'awards');
    setWatchNextResult(false);
  }, () => { setScreen('menu'); setActiveSaveId(null); pushToast('Could not open this saved league. Your saves have not been deleted.', 'error'); });

  const refreshSaves = () => listSaves().then(setSaveSummaries).catch(() => setSaveSummaries([]));

  useEffect(() => {
    migrateLegacyAutosaveIfNeeded().finally(refreshSaves);
  }, []);

  useEffect(() => {
    if (!restoring && screen === 'app' && activeSaveId) debouncedSave(activeSaveId, league, extras, controlledTeamId);
  }, [league, extras, screen, activeSaveId, controlledTeamId, restoring]);

  // Write any not-yet-saved change the moment the tab is hidden or closed, instead of waiting out the debounce.
  useEffect(() => {
    const flush = () => debouncedSave.flush();
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const selectPlayer = (id: string) => { setSelectedPlayerId(id); setTab('editor'); };
  const [archiveQuery, setArchiveQuery] = useState('');

  const enterApp = (rawLeague: League, rawExtras: GMLeagueExtras, teamId: string | null, saveName?: string, existingSaveId?: string) => {
    // Heal any universe that has several players sharing one id (older builds could generate them), so no one is lost.
    // Leagues made with the first NBA history data: convert ratings to Court Vision's scale and team names to city names.
    const migrated = migrateHistoricalLeague(rawLeague, rawExtras);
    // Real players who share a name: "Patrick Ewing II" rather than "Patrick Ewing (2011)" (older historical saves).
    const converted = stripNameYears(migrated.league, migrated.extras);
    const repaired = repairDuplicatePlayerIds(converted.league, converted.extras);
    const { repairs } = repaired;
    const rostered = normalizeRosterRules(repaired.league, repaired.extras);
    // Potential is never below Overall, and equals it once a player reaches (or passes) their prime.
    const { league: normalizedLeague, extras: e } = syncLeaguePotentials(rostered.league, rostered.extras);
    // Older saves: seed the record book from the games still stored this season.
    // Owners, goals and your job security; older leagues gain them here.
    // This season's In-Season Cup draw, when the league is early enough in the season to hold one.
    const l = ensureFrontOffice(setupCup(backfillRecordBook(initializeCoaching(normalizedLeague, teamId))), teamId);
    if (repairs.length > 0) {
      pushToast(`Fixed ${repairs.length} duplicate player name${repairs.length === 1 ? '' : 's'} so no one gets lost (${repairs.slice(0, 3).map((r) => r.newId).join(', ')}${repairs.length > 3 ? ', ...' : ''}).`, 'info');
    }
    jobs.resetAll(); // a background run belongs to the league it started on
    // Whatever is on screen must only ever auto-save into ITS OWN save slot. Without this reset, starting a new
    // game that has no slot of its own would keep writing over the previously opened save.
    setActiveSaveId(existingSaveId ?? null);
    setLeague(l);
    // Next summer's draft class is on the board all season (older saves get theirs here).
    setExtras(ensureUpcomingDraftClass(l, e));
    setControlledTeamId(teamId);
    setSelectedPlayerId(l.teams[0]?.seasons[0]?.playerId ?? '');
    setExhibitionHomeId(teamId ?? l.teams[0]?.teamId ?? '');
    setExhibitionAwayId(l.teams.find((t) => t.teamId !== teamId)?.teamId ?? l.teams[1]?.teamId ?? '');
    setTab(navModeOf(l) === 'simple' ? 'dashboard' : 'database');
    setScreen('app');
    if (saveName) {
      createSave(saveName, l, e, teamId).then((id) => { setActiveSaveId(id); refreshSaves(); }).catch(() => pushToast('Could not create a local save. Export your universe to keep a backup.', 'error'));
    }
  };

  const [menuBusy, setMenuBusy] = useState<string | null>(null);
  /** Builds a league from its origin (a new game, the weekly challenge, or a league code) and opens it. */
  const startFromOrigin = (origin: LeagueOrigin, o: { name: string; teamId?: string | null; weekly?: WeeklyRebuild | null }) => {
    const openWithTeam = (league: League, extras: GMLeagueExtras) => {
      if (o.teamId && league.teams.some(t => t.teamId === o.teamId)) { enterApp(league, extras, o.teamId, o.name); setTab('dashboard'); return; }
      setPendingLeague(league);
      setPendingExtras(extras);
      setPendingLeagueName(o.name);
      setScreen('chooseTeam');
    };
    if (origin.kind === 'random') {
      const generated = generateFullLeague(origin.seed, 30, 18, 82, String(origin.year), { balanced: !!origin.balanced });
      openWithTeam({ ...generated.league, origin }, { ...generated.extras, tradeSettings: { difficulty: origin.difficulty } });
      return;
    }
    setMenuBusy('Loading NBA history…');
    historyTools().then(({ h, buildHistoricalLeague }) => new Promise<void>(resolve => setTimeout(() => {
      setMenuBusy('Building the league…');
      if (origin.kind === 'history') {
        const built = buildHistoricalLeague(h, origin.year ?? 2016, { realDevelopment: !!origin.realDevelopment, forceRosters: !!origin.forceRosters, allPlayers: !!origin.allPlayers, difficulty: origin.difficulty, seed: origin.seed });
        openWithTeam({ ...built.league, origin }, built.extras);
        resolve();
        return;
      }
      // A Rebuild Challenge: its scenario, and the weekly twist when there is one.
      const sc = scenarioById(origin.scenario ?? '');
      if (!sc) throw new Error('Unknown scenario.');
      const twist = TWISTS.find(t => t.id === origin.twist);
      const built = buildHistoricalLeague(h, sc.startYear, { realDevelopment: true, difficulty: twist?.hardTrades ? 'hard' : origin.difficulty, seed: origin.seed });
      if (!built.league.teams.some(t => t.teamId === sc.team)) throw new Error(`${sc.team} is not in the ${sc.startYear} league.`);
      const seasons = twist ? Math.max(3, sc.seasons + twist.seasonsDelta) : sc.seasons;
      // The team as it was handed over, for the before-and-after view: last season's real record, payroll and best three.
      const franchise = h.teams.find(t => t.season === sc.startYear + 1 && t.abbr === sc.team)?.franchise;
      const prior = h.teams.find(t => t.season === sc.startYear && (franchise ? t.franchise === franchise : t.abbr === sc.team));
      const start = rebuildSnapshot(built.league.teams.find(t => t.teamId === sc.team)!, built.extras.contracts,
        prior?.w != null && prior.l != null ? { wins: prior.w, losses: prior.l, season: String(sc.startYear - 1) } : undefined);
      const league: League = { ...built.league, origin, rebuildChallenge: { id: sc.id, teamId: sc.team, startSeason: built.league.season ?? String(sc.startYear), seasons, start, ...(o.weekly ? { weekly: { week: o.weekly.week, twist: o.weekly.twist.id } } : {}) } };
      enterApp(league, built.extras, sc.team, o.name);
      setTab('dashboard');
      resolve();
    }, 20))).catch((err: unknown) => pushToast(`Could not build the league: ${err instanceof Error ? err.message : String(err)}`, 'error'))
      .finally(() => setMenuBusy(null));
  };

  /** "Have a league code?": the same starting league a friend played. */
  const startFromCode = (code: string): string | null => {
    try {
      const { origin, teamId } = decodeLeagueCode(code);
      track('league_code', { action: 'use', kind: origin.kind });
      startFromOrigin(origin, { name: `Challenge ${code.trim().toUpperCase()}`, teamId });
      return null;
    } catch (e) { return e instanceof Error ? e.message : String(e); }
  };

  const startGameMode = (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions, scenarioId?: string) => {
    if (mode !== 'rebuild') track('mode_start', { mode, variant: mode === 'real' ? real?.source ?? 'settings' : 'menu' });
    const seed = Math.floor(Math.random() * 1_000_000);
    if (mode === 'rebuild') {
      // The Rebuild of the Week: this week's scenario and twist, from a seed shared by everyone.
      const weekly = scenarioId === 'weekly' ? weeklyRebuild() : null;
      const sc = weekly ? weekly.scenario : scenarioId ? scenarioById(scenarioId) : undefined;
      if (!sc) return;
      track('mode_start', { mode: 'rebuild', variant: weekly ? 'weekly' : sc.id });
      startFromOrigin({ kind: 'rebuild', scenario: sc.id, seed: weekly ? weekly.seed : seed, difficulty: 'normal', ...(weekly ? { twist: weekly.twist.id } : {}) },
        { name: weekly ? `Rebuild of the Week ${weekly.week}: ${sc.title}` : `Rebuild: ${sc.title}`, weekly });
      return;
    }
    if (mode === 'real' && real?.source === 'history') {
      // Built-in NBA history: load the reference data on demand, then pick a team like any new league.
      startFromOrigin({ kind: 'history', year: parseInt(year, 10), seed, difficulty, realDevelopment: real.realDevelopment, forceRosters: !!real.forceRosters, allPlayers: !!real.allPlayers },
        { name: leagueName || `NBA ${year}–${String(parseInt(year, 10) + 1).slice(2)}` });
      return;
    }
    if (mode === 'random') {
      startFromOrigin({ kind: 'random', year: parseInt(year, 10), seed, difficulty, balanced: true }, { name: leagueName || 'My League' });
    } else if (mode === 'real') {
      const emptyLeague: League = { teams: [], schedule: [], settings: { ...DEFAULT_GAME_SETTINGS } };
      enterApp(emptyLeague, { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS }, draftClass: [], tradeSettings: { difficulty }, ...DEFAULT_GM_FLAGS }, null, leagueName || 'My League');
      setTab('settings');
    } else if (mode === 'draft') {
      setScreen('draft');
    } else if (mode === 'career') {
      setScreen('career');
    } else {
      setScreen('hunt');
    }
  };

  const continueSavedUniverse = async (saveId: string) => {
    try {
      const snap = await getSave(saveId);
      if (!snap) throw new Error('Missing saved league');
      enterApp(snap.league, snap.extras, snap.controlledTeamId ?? null, undefined, saveId);
    } catch {
      pushToast('Could not open this league. Use Backups & recovery to restore an earlier point.', 'error');
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    await deleteSave(saveId);
    if (activeSaveId === saveId) setActiveSaveId(null);
    refreshSaves();
  };

  const handleRenameSave = async (saveId: string, name: string) => {
    await renameSave(saveId, name);
    refreshSaves();
  };

  const returnToMenu = async () => {
    jobs.resetAll();
    await debouncedSave.flush();
    if (activeSaveId) await updateSave(activeSaveId, league, extras, controlledTeamId);
    setScreen('menu');
    refreshSaves();
  };

  const applyPreset = (name: PresetName) => {
    setLeague((l) => ({ ...l, settings: { ...SETTINGS_PRESETS[name], sandboxMode: l.settings.sandboxMode } }));
  };

  const handleExport = () => downloadUniverse(league, extras, `universe-${Date.now()}.json`);
  const handleSaveNow = () => {
    const action = activeSaveId
      ? updateSave(activeSaveId, league, extras, controlledTeamId)
      : createSave(pendingLeagueName || 'My League', league, extras, controlledTeamId).then((id) => setActiveSaveId(id));
    action.then(() => { setImportMessage('Saved locally.'); refreshSaves(); }).catch(() => pushToast('Could not save locally. Export your universe to keep a backup.', 'error'));
  };

  const handleImportFile = async (file: File) => {
    try {
      const snapshot = await readUniverseFromFile(file);
      const migrated = migrateHistoricalLeague(snapshot.league, snapshot.extras);
      const converted = stripNameYears(migrated.league, migrated.extras);
      const fixed = repairDuplicatePlayerIds(converted.league, converted.extras);
      jobs.resetAll();
      const normalized = normalizeRosterRules(fixed.league, fixed.extras);
      setLeague(initializeCoaching(normalized.league, controlledTeamId));
      setExtras(normalized.extras);
      setSelectedPlayerId(fixed.league.teams[0]?.seasons[0]?.playerId ?? selectedPlayerId);
      setImportMessage(fixed.repairs.length > 0
        ? `Universe imported successfully. Fixed ${fixed.repairs.length} duplicate player name${fixed.repairs.length === 1 ? '' : 's'}.`
        : 'Universe imported successfully.');
    } catch (err) {
      setImportMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, extras]);

  const addImportedPlayers = (teamId: string, rows: { season: (typeof league.teams)[number]['seasons'][number] }[]) => {
    // An imported player whose name matches someone already here would silently merge with them; give them a unique id instead.
    const taken = collectPlayerIds(league, extras);
    setLeague((l) => ({
      ...l,
      teams: l.teams.map((t) => (t.teamId === teamId ? { ...t, seasons: [...t.seasons, ...rows.map((r) => withUniquePlayerId({ ...r.season, teamId }, taken))] } : t)),
    }));
  };

  const buildLeagueFromImport = (teamNames: string[], rowsByTeam: Record<string, { season: (typeof league.teams)[number]['seasons'][number] }[]>) => {
    const takenIds = new Set<string>();
    const teams: LeagueTeam[] = teamNames.map((name) => ({
      teamId: name.toUpperCase().replace(/\s+/g, '-'),
      name,
      seasons: rowsByTeam[name].map((r) => withUniquePlayerId({ ...r.season, teamId: name.toUpperCase().replace(/\s+/g, '-') }, takenIds)),
    }));
    const schedule = teams.length >= 2 ? generateRoundRobinSchedule(teams.map((t) => t.teamId), 2) : [];
    setLeague(initializeCoaching({ teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, rosterLimits: ROSTER_LIMITS }, controlledTeamId));
    if (teams[0]?.seasons[0]) setSelectedPlayerId(teams[0].seasons[0].playerId);
    if (teams[0]) setExhibitionHomeId(teams[0].teamId);
    if (teams[1]) setExhibitionAwayId(teams[1].teamId);
    setTab('database');
  };

  const runDevelopmentPass = () => {
    setLeague((l) => ({ ...l, teams: developOffseasonLeague(l.teams, seed, l.rulesSettings, (p) => followsRealDevelopment(p, l)) }));
  };

  const [autoAllStar, setAutoAllStar] = useState(() => { try { return localStorage.getItem('cv-auto-allstar') !== 'off'; } catch { return true; } });
  const autoAllStarRef = useRef(autoAllStar);
  autoAllStarRef.current = autoAllStar;
  const [autoDeadline, setAutoDeadline] = useState(() => { try { return localStorage.getItem('cv-auto-deadline') === 'on'; } catch { return false; } });
  const autoDeadlineRef = useRef(autoDeadline);
  autoDeadlineRef.current = autoDeadline;
  const toggleAutoDeadline = (on: boolean) => { setAutoDeadline(on); try { localStorage.setItem('cv-auto-deadline', on ? 'on' : 'off'); } catch { /* keep the in-memory choice */ } };
  const toggleAutoAllStar = (on: boolean) => { setAutoAllStar(on); try { localStorage.setItem('cv-auto-allstar', on ? 'on' : 'off'); } catch { /* keep the in-memory choice */ } };
  /** What the current multi-day simulation was asked to reach, so it can resume after an automatic All-Star Weekend. */
  const simTargetRef = useRef<{ round: number; seedBase: number } | null>(null);
  const continueSimRef = useRef<((rounds: number, seedBase: number, from: League) => void) | null>(null);
  /**
   * A background simulation started from an earlier copy of the league. Tutorial progress made while it ran (pages
   * opened, notices answered, the menu switched) is kept rather than rolled back; the simulation never changes it.
   */
  const withCurrentTutorial = (next: League) => (prev: League) => (prev.tutorial === next.tutorial ? next : { ...next, tutorial: prev.tutorial });
  /** Commits a simulated league (plus the AI GM pass) and returns exactly what was stored. `silent` skips toasts and navigation. */
  const applyLeagueAIPass = (simulated: League, nextExtras: GMLeagueExtras, silent = false): League => {
    // Older games' replay logs are packed as soon as they're a round old, keeping memory and saves small.
    let nextLeague = compactLeagueLogs(simulated);
    let resume: { rounds: number; seedBase: number } | null = null;
    // Auto All-Star: play the whole weekend at the break and keep the requested simulation going.
    if (autoAllStarRef.current && nextLeague.rulesSettings?.allStarEnabled !== false && isAllStarBreakPending(nextLeague)) {
      const weekend = autoRunAllStarWeekend(nextLeague, awardSettings, seed + 90_000 + nextLeague.schedule.filter(g => g.played).length);
      nextLeague = weekend.league;
      if (!silent) pushToast(`All-Star Weekend played automatically. MVP: ${weekend.mvpPlayerId ?? '—'} · 3PT: ${weekend.threePointChampionId ?? '—'} · Dunk: ${weekend.dunkChampionId ?? '—'}.`, 'success');
      const target = simTargetRef.current;
      const next = nextLeague.schedule.find(g => !g.played)?.round;
      if (target && next != null && next < target.round) resume = { rounds: target.round - next, seedBase: target.seedBase };
    }
    if (isAllStarBreakPending(nextLeague) && nextLeague.seasonPhase !== 'all_star') {
      const paused = { ...nextLeague, seasonPhase: 'all_star' as const };
      setLeague(withCurrentTutorial(paused));
      setExtras(nextExtras);
      if (!silent) {
        setTab('allStarWeekend');
        pushToast("It's All-Star Weekend — the regular season is paused until it's played.", 'info');
      }
      return paused;
    }
    const aiSeed = seed + 500 + nextLeague.schedule.filter((g) => g.played).length;
    const aiResult = runLeagueAIPass(nextLeague, nextExtras, controlledTeamId, aiSeed);
    // The season stopped on the morning of the trade deadline: Deadline Day opens (see deadlineDay.ts).
    let deadline = !silent && isDeadlineDayDue(aiResult.league) ? openDeadlineDay(aiResult.league, aiResult.extras, controlledTeamId, deadlineSeed(aiResult.league)) : null;
    // Auto Deadline Day: the whole day runs to 3 PM at once (like the automatic All-Star Weekend) and the sim goes on.
    let passedDeadline: League | null = null;
    if (deadline && autoDeadlineRef.current) {
      const closed = runToDeadline(deadline.league, deadline.extras, controlledTeamId, deadlineSeed(deadline.league));
      passedDeadline = closed.league;
      deadline = null;
      aiResult.league = closed.league; aiResult.extras = closed.extras;
      const target = simTargetRef.current, next = closed.league.schedule.find(g => !g.played)?.round;
      if (target && next != null && next < target.round) resume = { rounds: target.round - next, seedBase: target.seedBase };
    }
    const finalLeague = deadline?.league ?? aiResult.league;
    setLeague(withCurrentTutorial(finalLeague));
    setExtras(deadline?.extras ?? aiResult.extras);
    if (passedDeadline) pushToast(`Deadline Day simmed automatically. ${deadlineRecap(passedDeadline)}`, 'success');
    if (resume && !deadline) { const r = resume; setTimeout(() => continueSimRef.current?.(r.rounds, r.seedBase, aiResult.league), 0); }
    if (deadline) {
      setTab('deadline');
      pushToast("It's Trade Deadline Day. Trading locks at 3 PM; the season resumes after that.", 'info');
      announceDeadline(deadline);
    }
    if (silent) return finalLeague;
    const parts: string[] = [];
    if (aiResult.signings.length > 0) parts.push(`${aiResult.signings.length} free-agent signing${aiResult.signings.length === 1 ? '' : 's'} around the league`);
    if (aiResult.trades.length > 0) parts.push(`${aiResult.trades.length} trade${aiResult.trades.length === 1 ? '' : 's'} completed around the league`);
    if (aiResult.newOfferGenerated) parts.push('a new trade offer is waiting for you in Front Office › Trade Offers');
    if (parts.length > 0) pushToast(`${parts.join('; ')}.`);
    for (const ev of aiResult.moraleEvents.filter(e => e.teamId === controlledTeamId)) pushToast(ev.text, ev.kind === 'trade_request' ? 'error' : 'success');
    return finalLeague;
  };

  // Auto Play and "Simulate Remaining Season" run in background workers owned HERE (not by the pages that
  // start them), so switching tabs mid-run no longer kills them. Handlers read live state via closures that
  // the hook refreshes every render.
  const jobs = useBackgroundJobs({
    onAutoPlayLeague: (l, e) => { setLeague(withCurrentTutorial(l)); setExtras(e); },
    onSeasonSimLeague: (l) => applyLeagueAIPass(l, extras),
    onToast: pushToast,
    // Historical leagues: load the real draft classes the run will reach before handing the league to the worker.
    prepareAutoPlay: async (args) => {
      if (!args.league.historical) return args;
      const { h, topUpHistoricalClasses } = await historyTools();
      const meta = topUpHistoricalClasses(h, args.league, args.extras, Number(args.league.season) + args.years + 1);
      return meta ? { ...args, league: { ...args.league, historical: meta } } : args;
    },
  });

  // Historical leagues keep the next ten real draft classes loaded; top up after each rollover (background, non-blocking).
  // Automatic bookkeeping (press, sticks) changes the league object; a live-coaching session carries over to it.
  const adoptLeague = (next: League) => {
    setCoachSession(cs => cs && cs.committed === league ? { ...cs, committed: next } : cs);
    setLeague(next);
  };
  // The doctors want a decision when one of your players gets hurt.
  const injuryDecisions = pendingDecisions(league, controlledTeamId).length;
  const lastDecisions = useRef(injuryDecisions);
  useEffect(() => {
    if (injuryDecisions > lastDecisions.current) pushToast(`Injury: the doctors need your call in the Medical Room (${injuryDecisions} waiting).`, 'error');
    lastDecisions.current = injuryDecisions;
  }, [injuryDecisions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Owner's Box: each booked season updates your owner legacy record (Owners' Hall of Fame, Trophy Road, rewards).
  const ownerSeasons = league.owner?.seasons.length ?? 0;
  useEffect(() => {
    if (screen !== 'app' || !ownerSeasons) return;
    recordOwnerLegacy(activeSaveId ?? 'unsaved', league);
  }, [ownerSeasons, activeSaveId, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trading cards: when a season is archived, your roster's cards and the season's packs arrive (once per league).
  const archivedSeasons = league.franchiseHistory?.length ?? 0;
  useEffect(() => {
    if (!activeSaveId || screen !== 'app' || !archivedSeasons) return;
    void import('./cards/cards').then(m => {
      const got = m.awardSeasonCards(league, activeSaveId, controlledTeamId);
      if (got && (got.added || got.packs)) pushToast(`Card album: ${got.added} new card${got.added === 1 ? '' : 's'} from your roster and ${got.packs} pack${got.packs === 1 ? '' : 's'} to open.`, 'success');
    });
  }, [archivedSeasons, activeSaveId, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reporters line up after big results, streaks, trade requests and playoff series.
  const pressWaiting = league.press?.pending.length ?? 0;
  useEffect(() => {
    const next = collectPress(ensureGmRivals(league, controlledTeamId), controlledTeamId);
    if (next !== league) adoptLeague(next);
  }, [league.schedule, league.playoffBracket, league.teams, controlledTeamId]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastPressCount = useRef(pressWaiting);
  useEffect(() => {
    if (pressWaiting > lastPressCount.current) {
      const skipped = league.press?.lastSkipped ?? 0;
      pushToast(`${pressWaiting} reporter${pressWaiting === 1 ? '' : 's'} want a word in the Press Room.${skipped ? ` ${skipped} earlier question${skipped === 1 ? '' : 's'} went unanswered ("no comment"), which the fans noticed.` : ''}`, 'info');
    }
    lastPressCount.current = pressWaiting;
  }, [pressWaiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sandbox sticks: whatever just moved a player, stuck players end up where their rule says (a no-op otherwise).
  useEffect(() => {
    const settled = enforceSticky(league, extras);
    if (settled.moved.length) { adoptLeague(settled.league); setExtras(settled.extras); }
  }, [league, extras]); // eslint-disable-line react-hooks/exhaustive-deps

  const historicalSeason = league.historical ? league.season : null;
  useEffect(() => {
    if (!historicalSeason || jobs.busy) return;
    const through = Number(historicalSeason) + 10;
    if ((league.historical?.classesLoadedThrough ?? Infinity) >= Math.min(through, league.historical?.lastDataStartYear ?? 0)) return; // the last real draft is the one after the last season in the data
    let cancelled = false;
    historyTools().then(({ h, topUpHistoricalClasses }) => {
      if (cancelled) return;
      setLeague(l => {
        if (!l.historical || l.season !== historicalSeason) return l;
        const meta = topUpHistoricalClasses(h, l, extras, through);
        return meta ? { ...l, historical: meta } : l;
      });
    }).catch(() => { /* retried on the next rollover; the rollover falls back to a labelled generated class */ });
    return () => { cancelled = true; };
  }, [historicalSeason, jobs.busy, league.historical?.classesLoadedThrough, league.historical?.lastDataStartYear, extras]);

  const poachCalls = pendingOffers(league, controlledTeamId).length;
  useEffect(() => {
    if (poachCalls) pushToast(`Another team wants one of your assistants as their head coach. Answer on the Staff page.`, 'info');
  }, [poachCalls, pushToast]);
  const campReady = league.campReport && !league.campReport.seen && league.campReport.season === league.season && league.campReport.teamId === controlledTeamId ? league.campReport.season : null;
  useEffect(() => {
    if (campReady) pushToast('Training Camp Report is in: see how your players came back from the summer (Summer Camp).', 'info');
  }, [campReady, pushToast]);

  // Real players who retired before the start are saved without their careers; rebuild them from NBA history on load.
  const retireesMissing = needsRetireeData(league);
  useEffect(() => {
    if (!retireesMissing) return;
    let cancelled = false;
    historyTools().then(({ h, hydrateRetirees }) => { if (!cancelled) setLeague(l => hydrateRetirees(h, l)); })
      .catch(() => { /* the archive still has them; retried the next time the league loads */ });
    return () => { cancelled = true; };
  }, [retireesMissing]);

  const loadRetirees = () => historyTools().then(({ h, retiredBeforeStart, realIdsInLeague }) => {
    if (!league.historical) return;
    const added = retiredBeforeStart(h, league.historical.startYear, realIdsInLeague(league, extras));
    setLeague(l => ({ ...l, retiredPlayers: [...added, ...(l.retiredPlayers ?? [])] }));
    pushToast(added.length ? `Loaded ${added.length.toLocaleString()} retired players from NBA history.` : 'Every retired player is already in this league.', 'success');
  }).catch((err: unknown) => pushToast(`Could not load NBA history: ${err instanceof Error ? err.message : String(err)}`, 'error'));

  /**
   * Gets the league ready to play. Trade Deadline Day: playing on during the day runs the clock to the 3 PM deadline;
   * reaching the deadline's morning opens the day instead of playing (`holdDeadline`; Auto Play plays straight through).
   */
  const prepareRegularSeason = (holdDeadline = true) => {
    const coached = manageCoachRosters(league, extras);
    let ready = { league: holdDeadline ? scheduleDeadlineDay(coached.league, controlledTeamId) : coached.league, extras: coached.extras };
    if (isDeadlineDayOpen(ready.league)) {
      const closed = runToDeadline(ready.league, ready.extras, controlledTeamId, deadlineSeed(ready.league));
      ready = { league: closed.league, extras: closed.extras };
      pushToast(deadlineRecap(closed.league), 'success');
    }
    if (holdDeadline && isDeadlineDayDue(ready.league) && autoDeadlineRef.current) {
      const opened = openDeadlineDay(ready.league, ready.extras, controlledTeamId, deadlineSeed(ready.league));
      const closed = runToDeadline(opened.league, opened.extras, controlledTeamId, deadlineSeed(opened.league));
      ready = { league: closed.league, extras: closed.extras };
      pushToast(`Deadline Day simmed automatically. ${deadlineRecap(closed.league)}`, 'success');
    }
    if (holdDeadline && isDeadlineDayDue(ready.league)) {
      const opened = openDeadlineDay(ready.league, ready.extras, controlledTeamId, deadlineSeed(ready.league));
      setLeague(opened.league);
      setExtras(opened.extras);
      setTab('deadline');
      pushToast("It's Trade Deadline Day. Trading locks at 3 PM; the season resumes after that.", 'info');
      announceDeadline(opened);
      return null;
    }
    setLeague(ready.league);
    setExtras(ready.extras);
    if ((ready.league.seasonPhase ?? 'regular_season') === 'regular_season' && rosterComplianceIssues(ready.league, ready.extras.capSettings).length) {
      pushToast('A roster still needs players. Check free agents or hard-cap room before playing a regular-season game.', 'error');
      return null;
    }
    return ready;
  };
  const deadlineSeed = (l: League) => seed + 700_000 + (l.deadlineDay?.round ?? 0);
  const deadlineRecap = (l: League) => {
    const trades = l.deadlineDay?.trades ?? [];
    return `3:00 PM: the trade deadline has passed. ${trades.length} deal${trades.length === 1 ? '' : 's'} on Deadline Day${trades.some(isBlockbuster) ? ', including a blockbuster' : ''}.`;
  };
  /** Toasts for one hour of Deadline Day: blockbusters and calls to your phone (every deal is on the Deadline Day ticker). */
  const announceDeadline = (r: DeadlineHourResult) => {
    const name = (id: string) => r.league.teams.find(t => t.teamId === id)?.name ?? id;
    for (const t of r.trades.filter(isBlockbuster)) pushToast(`BLOCKBUSTER (${deadlineClock(t.hour)}): ${describeDeadlineTrade(t, name)}.`, 'info');
    if (r.call) pushToast(`${name(r.call)} are on the phone with an offer.`, 'info');
  };
  const advanceDeadline = () => {
    const r = advanceDeadlineHour(league, extras, controlledTeamId, deadlineSeed(league));
    setLeague(r.league);
    setExtras(r.extras);
    announceDeadline(r);
    if (!isDeadlineDayOpen(r.league)) pushToast(deadlineRecap(r.league), 'success');
  };
  const skipDeadline = () => {
    const r = runToDeadline(league, extras, controlledTeamId, deadlineSeed(league));
    setLeague(r.league);
    setExtras(r.extras);
    pushToast(deadlineRecap(r.league), 'success');
  };

  const playNextGame = (watch = false, coach = false) => {
    simTargetRef.current = null;
    const ready = prepareRegularSeason();
    if (!ready || !ready.league.schedule.some(g => !g.played)) return;
    const targetRound = ready.league.schedule.find(g => !g.played)!.round;
    const myGame = ready.league.schedule.find(g => !g.played && g.round === targetRound && (g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId));
    const gameId = (myGame ?? ready.league.schedule.find(g => !g.played && g.round === targetRound))!.id;
    const played = simulateFullRound(ready.league, seed);
    if (!played.schedule.find(g => g.id === gameId)?.result) {
      pushToast('Complete All-Star weekend before the next regular-season game.', 'info');
      setTab('allStarWeekend');
      return;
    }
    const committed = applyLeagueAIPass(played, ready.extras);
    // Watching your own team's game always lets you take over coaching; "Coach" just opens on the clipboard.
    if ((coach || watch) && myGame && controlledTeamId) {
      setCoachSession({ base: ready.league, baseExtras: ready.extras, gameId, teamId: controlledTeamId, commands: [], committed, openCoach: coach });
    } else {
      setCoachSession(null);
      if (coach) pushToast('Your team is off tonight, so there is no game to coach. Watching the league game instead.', 'info');
    }
    setWatchNextResult(watch);
    setWatchStart(undefined);
    setViewedGameId(gameId);
    setBoxscoreSource('league');
    setTab('boxscore');
  };
  /**
   * A live-coaching decision re-simulates tonight's round from the same starting league and seed with every
   * decision so far. Possessions before the decision are identical, so the replay continues seamlessly; the
   * new result replaces the one committed a moment ago. Refused once anything else has changed the league.
   */
  const coachCommand = (command: LiveCoachingCommand): string | null => {
    const session = coachSession;
    if (!session) return 'There is no live game to coach.';
    if (league !== session.committed) return 'This game is locked in — the league has moved on since tip-off.';
    const commands = [...session.commands, command];
    const simmed = simulateFullRound(session.base, seed, { [session.gameId]: commands });
    if (!simmed.schedule.find(g => g.id === session.gameId)?.result) return 'The game could not be re-simulated.';
    // Halftime speeches are remembered for the season reel (this season and last are kept).
    const speeches = commands.filter((c): c is Extract<LiveCoachingCommand, { kind: 'speech' }> => c.kind === 'speech')
      .map(c => ({ season: simmed.season ?? '', gameId: session.gameId, teamId: c.teamId, speech: c.speech as Speech, halftimeMargin: c.margin ?? 0 }));
    const kept = (simmed.halftimeSpeeches ?? []).filter(s => s.gameId !== session.gameId && Number(s.season.slice(0, 4)) >= Number((simmed.season ?? '0').slice(0, 4)) - 1);
    const played = speeches.length ? { ...simmed, halftimeSpeeches: [...kept, ...speeches].slice(-60) } : simmed;
    const committed = applyLeagueAIPass(played, session.baseExtras, true);
    setCoachSession({ ...session, commands, committed });
    return null;
  };
  const simulateToTradeDeadline = () => {
    simTargetRef.current = null;
    const ready = prepareRegularSeason();
    if (ready) applyLeagueAIPass(simulateUntilTradeDeadline(ready.league, seed), ready.extras);
  };
  continueSimRef.current = (rounds, seedBase, from) => {
    jobs.seasonSim.start(from, seedBase, Number.isFinite(rounds) ? rounds : undefined); // the job hook refuses to double-start
  };
  const playAllStarWeekend = () => {
    const weekend = autoRunAllStarWeekend(league, awardSettings, seed + 90_000 + league.schedule.filter(g => g.played).length);
    setLeague(weekend.league);
    pushToast(`All-Star Weekend complete. MVP: ${weekend.mvpPlayerId ?? '—'} · 3PT: ${weekend.threePointChampionId ?? '—'} · Dunk: ${weekend.dunkChampionId ?? '—'}.`, 'success');
  };
  const simulateGamesCount = (count: number) => {
    const ready = prepareRegularSeason();
    if (!ready) return;
    const first = ready.league.schedule.find(g => !g.played)?.round ?? 0;
    simTargetRef.current = { round: first + count, seedBase: seed };
    // A single game day is quick; a week or month runs in the background worker so the page never freezes.
    if (count <= 1 || jobs.seasonSim.running || jobs.autoPlay.running) applyLeagueAIPass(simulateRounds(ready.league, count, seed), ready.extras);
    else jobs.seasonSim.start(ready.league, seed, count);
  };

  const simulateEntirePlayoffsAndUpdate = () => {
    const bracket = playoffBracket ?? autoGeneratePlayoffBracket(league);
    const result = simulateFullPlayoffs(bracket, league, seed);
    setLeague({ ...result.league, playoffBracket: result.bracket });
  };

  // Auto-drafts every AI pick between here and the controlled team's next turn — leaves the draft
  // open so the person still makes their own pick by hand.
  const simToMyNextDraftPick = () => {
    const result = autoDraftAIPicksUntilUserTurn(league, extras, controlledTeamId);
    setLeague(result.league);
    setExtras(result.extras);
    pushToast(result.picks.length > 0
      ? `AI picks: ${result.picks.map((p) => `${p.teamName} took ${p.playerId}`).join('; ')}.`
      : "It's already your turn to pick.", 'info');
  };

  // Auto-drafts every remaining pick (including the controlled team's) and moves straight on to
  // Resign/Waive — the "I don't want to make picks by hand" fast path.
  const simEntireDraftAndContinue = () => {
    const result = simEntireDraft(league, extras);
    setLeague(result.league);
    setExtras(result.extras);
    beginResignWaivePhase();
    pushToast(`Draft complete — ${result.picks.length} picks made.`, 'success');
  };

  // The Play button's one-click way to leave free agency: runs the AI pass for every remaining day,
  // then immediately continues into Preseason — no separate "free agency is now closed" click needed.
  const skipFreeAgencyAndContinue = () => {
    let current = { league, extras };
    let totalSignings = 0;
    for (let i = 0; i < extras.freeAgencyDaysRemaining; i++) {
      const result = runFreeAgencyAI(current.league, current.extras, controlledTeamId, Date.now() + i);
      totalSignings += result.signings.length;
      current = { league: result.league, extras: result.extras };
    }
    beginPreseasonPhase({ league: { ...current.league, calendarDate: addDays(current.league.calendarDate ?? '', extras.freeAgencyDaysRemaining) }, extras: { ...current.extras, freeAgencyDaysRemaining: 0 } });
    pushToast(`Free agency wrapped up — ${totalSignings} AI signings around the league.`, 'success');
  };

  // --- Guided season-flow: regular_season -> playoffs -> awards_recap -> draft -> resign_waive -> free_agency -> preseason -> regular_season ---
  const beginPlayoffsPhase = () => {
    setPlayoffBracket(autoGeneratePlayoffBracket(league));
    setLeague((l) => ({ ...l, seasonPhase: 'playoffs' }));
    setTab('playoffs');
  };

  const beginAwardsRecap = () => {
    setLeague((l) => ({ ...l, seasonPhase: 'awards_recap' }));
    // The Year in Review show opens first for the team you run; the awards follow it.
    setTab(controlledTeamId ? 'yearInReview' : 'awards');
  };

  const beginDraftPhase = () => {
    const finals = playoffBracket ? playoffBracket.rounds[playoffBracket.rounds.length - 1]?.[0] : undefined;
    const fmvp = finals ? computeFinalsMVP(finals, league) : null;
    const championTeam = playoffBracket?.championTeamId ? league.teams.find((t) => t.teamId === playoffBracket.championTeamId) : null;
    const { league: nextLeague, extras: nextExtras, summary } = beginNewSeasonRoster(league, extras, seed + 7777, awardOptions(awardSettings), {
      teamId: playoffBracket?.championTeamId ?? null,
      teamName: championTeam?.name ?? null,
      fmvp,
    });
    setSeasonSummary(summary);
    setGameResult(null);
    setLeague({ ...nextLeague, calendarDate: addDays(nextLeague.calendarDate ?? '', 21) }); // ~3 weeks from Finals to Draft night
    setExtras(nextExtras);
    setTab('draft');
  };

  const beginResignWaivePhase = () => {
    setExtras((e) => ({ ...e, draftDayOpen: false }));
    setLeague((l) => ({ ...l, seasonPhase: 'resign_waive', calendarDate: addDays(l.calendarDate ?? '', 1) }));
    setTab('resignWaive');
  };

  const beginFreeAgencyPhase = () => {
    setExtras((e) => ({ ...e, freeAgencyOpen: true, freeAgencyDaysRemaining: league.settings.freeAgencyDurationDays ?? 30 }));
    setLeague((l) => ({ ...l, seasonPhase: 'free_agency' }));
    setTab('freeAgency');
  };

  const beginPreseasonPhase = (base: { league: League; extras: GMLeagueExtras } = { league, extras }) => {
    // Historical rosters: AI teams take the floor with their real rosters for the new season.
    const real = applyHistoricalRosters(base.league, { ...base.extras, freeAgencyOpen: false }, controlledTeamId);
    setExtras(real.extras);
    setLeague({ ...real.league, seasonPhase: 'preseason' });
    if (real.moved) pushToast(`Historical rosters: ${real.moved} players joined their real ${formatSeasonYear(base.league.season)} teams.`, 'info');
    setTab('preseason');
  };

  const startRegularSeason = () => {
    setPlayoffBracket(null);
    const ready = manageCoachRosters(finalizeNewSeasonSchedule(league), extras);
    setLeague(ready.league);
    setExtras(ensureUpcomingDraftClass(ready.league, ready.extras));
    setTab('standings');
  };

  const seasonPhase = league.seasonPhase ?? 'regular_season';
  // --- Front office: a fired or spectating GM controls no team; new achievements get a toast. ---
  const frontOffice = league.frontOffice;
  useEffect(() => {
    if (screen === 'app' && frontOffice && frontOffice.status !== 'employed' && controlledTeamId) setControlledTeamId(null);
  }, [screen, frontOffice, controlledTeamId]);
  // A new owner review (guided offseason or Auto Play) opens the verdict dialog with the achievements it unlocked;
  // achievements earned any other way (taking a new job) get a toast.
  const knownFrontOffice = useRef<{ saveId: string | null; ids: Set<string>; reviews: number } | null>(null);
  useEffect(() => {
    if (screen !== 'app' || !frontOffice) return;
    const ids = new Set(Object.keys(frontOffice.achievements));
    const known = knownFrontOffice.current;
    knownFrontOffice.current = { saveId: activeSaveId, ids, reviews: frontOffice.reviews.length };
    if (!known || known.saveId !== activeSaveId) return; // a league just opened: nothing is new
    const fresh = [...ids].filter(id => !known.ids.has(id));
    const review = frontOffice.reviews.length > known.reviews ? frontOffice.reviews.at(-1) : undefined;
    if (review) { setOwnerVerdict({ review, newAchievements: fresh }); return; }
    for (const id of fresh) {
      const a = ACHIEVEMENT_BY_ID.get(id);
      if (a) pushToast(`Achievement unlocked: ${a.name}. ${a.description}`, 'success');
    }
  }, [screen, frontOffice, activeSaveId, pushToast]);
  const acceptOffer = (teamId: string) => {
    const next = acceptJobOffer(league, teamId);
    setLeague(next);
    setControlledTeamId(teamId);
    setViewedTeamId('');
    pushToast(`Welcome to the ${next.teams.find(t => t.teamId === teamId)?.name ?? 'team'}. ${next.frontOffice?.goals.length ? "Your new owner's goals are in the GM Office." : "Your new owner's goals arrive when the season starts."}`, 'success');
    setTab('dashboard');
  };
  const spectate = () => {
    setLeague(becomeSpectator(league));
    setControlledTeamId(null);
    pushToast('You are spectating. Teams will call again next offseason.', 'info');
  };
  // A finished Rebuild Challenge goes on this browser's board (official leagues only, once per save).
  const challengeDone = league.rebuildChallenge ? challengeProgress(league)?.status : undefined;
  useEffect(() => {
    if (screen !== 'app' || !activeSaveId || !challengeDone || challengeDone === 'active') return;
    const p = challengeProgress(league);
    if (p) {
      recordRebuild(p, activeSaveId);
      if (p.config.weekly && p.official) recordWeekly('rebuild', p.config.weekly.week, { best: p.score, stars: p.stars, label: p.scenario.title, results: p.results.map(r => ({ wins: r.wins, losses: r.losses, finish: r.finish })) });
      trackOnce(`rebuild-${activeSaveId}`, 'mode_finish', { mode: 'rebuild', result: p.status, stars: p.stars, weekly: !!p.config.weekly });
    }
  }, [screen, activeSaveId, challengeDone]); // eslint-disable-line react-hooks/exhaustive-deps
  // Daily goals: games your team plays today count toward the day's three goals (official leagues pay out XP).
  const myPlayed = controlledTeamId ? league.schedule.reduce((n, g) => n + (g.played && (g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId) ? 1 : 0), 0) : 0;
  useEffect(() => {
    if (screen !== 'app' || !activeSaveId || !controlledTeamId) return;
    const done = updateDailyGoals(activeSaveId, league, controlledTeamId, isOfficialLeague(league));
    for (const g of done) pushToast(`Daily goal done: ${g.text} (+${g.xp} XP)`, 'success');
    if (done.length) trackOnce(`daily-${todayUtc()}-${done.map(g => g.id).join('-')}`, 'daily_goal', { count: done.length });
  }, [screen, activeSaveId, controlledTeamId, myPlayed, league.season]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mode achievements: announce each new one once (they are read from the records every mode keeps). Loaded after
  // start so the menu doesn't wait for it.
  useEffect(() => {
    let live = true, check = () => {};
    void Promise.all([import('./profile/modeUnlocks'), import('./career/storage'), import('./profile/profile')]).then(async ([{ takeModeUnlocks }, { listCareers }, { noteCareers }]) => {
      check = () => {
        const { fresh, first } = takeModeUnlocks();
        if (!fresh.length || !live) return;
        if (first || fresh.length > 3) pushToast(`${fresh.length} achievement${fresh.length === 1 ? '' : 's'} unlocked across your modes. See them in your Player Profile.`, 'success');
        else for (const a of fresh) pushToast(`Achievement unlocked: ${a.name} (${a.description.replace(/\.$/, '')})`, 'success');
      };
      // Careers are summarized from their saves once per visit, so older careers count too.
      await listCareers().then(noteCareers, () => {});
      check();
    });
    const onChange = () => check();
    const events = [LEGACY_EVENT, FEATS_EVENT, DAILY_EVENT];
    for (const e of events) window.addEventListener(e, onChange);
    return () => { live = false; for (const e of events) window.removeEventListener(e, onChange); };
  }, [pushToast]);
  // Signed-in players sync when they come back to the menu.
  useEffect(() => { if (screen === 'menu') syncSoon(1500); }, [screen]);
  // League codes: your first season in a coded league goes on that code's board (the code without a team, so
  // everyone who played the same league compares, whichever team they ran).
  const playedSeasons = league.origin ? (league.franchiseHistory ?? []).filter(r => !r.imported).length : 0;
  useEffect(() => {
    if (screen !== 'app' || !league.origin || !controlledTeamId || playedSeasons < 1 || !isOfficialLeague(league)) return;
    const first = (league.franchiseHistory ?? []).filter(r => !r.imported)[0];
    const ts = first?.teamSeasons?.find(t => t.teamId === controlledTeamId);
    if (ts) recordCodeResult(encodeLeagueCode(league.origin), { team: league.teams.find(t => t.teamId === controlledTeamId)?.name ?? controlledTeamId, wins: ts.wins, losses: ts.losses, finish: ts.playoffFinish, season: first.season });
  }, [screen, playedSeasons, controlledTeamId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your all-leagues GM legacy follows this league's front office (clean leagues only; see storage/gmLegacy.ts).
  const saveName = saveSummaries.find(sv => sv.id === activeSaveId)?.name ?? 'League';
  useEffect(() => {
    if (screen === 'app' && activeSaveId && frontOffice) recordLeagueLegacy(activeSaveId, saveName, league);
  }, [screen, activeSaveId, saveName, frontOffice, league.settings.sandboxMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Summer League: played once, after the draft and before re-signing. Runs a few seconds on the real engine.
  const [summerBusy, setSummerBusy] = useState(false);
  const playSummerLeague = () => {
    if (!canPlaySummerLeague(league, extras) || summerBusy) return;
    setSummerBusy(true);
    window.setTimeout(() => {
      try {
        const sl = simulateSummerLeague(league, extras, controlledTeamId, seed + 4242);
        setLeague(l => ({ ...l, summerLeague: sl }));
        const champ = league.teams.find(t => t.teamId === sl.championTeamId)?.name;
        pushToast(`Summer League is done${champ ? `: ${champ} win the title` : ''}${sl.mvpId ? `, ${sl.mvpId} is MVP` : ''}.`, 'success');
      } finally { setSummerBusy(false); }
    }, 30);
  };
  // Cup knockout night: the whole bracket is played the night the group stage ends.
  const cupDoneFor = league.cup?.knockout ? league.cup.season : null;
  const seenCup = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (screen !== 'app') return;
    if (seenCup.current === undefined || seenCup.current === cupDoneFor || !cupDoneFor) { seenCup.current = cupDoneFor; return; }
    seenCup.current = cupDoneFor;
    const cup = league.cup!;
    const name = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? '';
    pushToast(`Cup knockout night: ${name(cup.championTeamId)} win the In-Season Cup${cup.mvpId ? `, ${cup.mvpId} is Cup MVP` : ''}.${controlledTeamId && cup.qualifiers?.includes(controlledTeamId) ? (cup.championTeamId === controlledTeamId ? ' That\'s your team!' : ' Your team made the knockouts.') : ''}`, 'success');
  }, [screen, cupDoneFor]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFiringEnabled = (on: boolean) => setLeague(l => l.frontOffice ? { ...l, frontOffice: { ...l.frontOffice, firingEnabled: on } } : l);
  useEffect(() => {
    if (screen !== 'app' || seasonPhase !== 'regular_season') return;
    const ready = manageCoachRosters(league, extras);
    if (!ready.moves.length) return;
    setLeague(ready.league);
    setExtras(ready.extras);
    const mine = ready.moves.filter(m => m.teamId === controlledTeamId);
    pushToast(mine.length ? `Coach roster moves: ${mine.map(m => `${m.kind} ${m.playerId}`).join('; ')}.` : `Coaches made ${ready.moves.length} roster moves to meet the 10–18 player limit.`, 'info');
  }, [screen, seasonPhase, league, extras, controlledTeamId, pushToast]);

  // Draft Day and Free Agency no longer have manual "Start" buttons — beginDraftPhase/beginFreeAgencyPhase
  // already open them the moment the league enters that phase. This is just a safety net for leagues that
  // reach the app already sitting in one of these phases (an older save, an imported universe) without that
  // flag set, so there's never a dead end with no way to open it.
  useEffect(() => {
    if (seasonPhase === 'draft' && !extras.draftDayOpen && extras.draftClass.length > 0) {
      setExtras((e) => ({ ...e, draftDayOpen: true }));
    }
    if (seasonPhase === 'free_agency' && !extras.freeAgencyOpen) {
      setExtras((e) => ({ ...e, freeAgencyOpen: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonPhase, extras.draftDayOpen, extras.freeAgencyOpen, extras.draftClass.length]);

  const settings = useMemo(() => ({ ...league.settings, sandboxMode, seed }), [league.settings, sandboxMode, seed]);

  const rosterTeam = league.teams.find((t) => t.seasons.some((s) => s.playerId === selectedPlayerId));
  const rosterSeason = rosterTeam?.seasons.find((s) => s.playerId === selectedPlayerId);
  const freeAgentSeason = !rosterSeason ? extras.freeAgents.find((s) => s.playerId === selectedPlayerId) : undefined;
  const draftProspectEntry = !rosterSeason && !freeAgentSeason ? extras.draftClass.find((p) => p.playerId === selectedPlayerId) : undefined;
  const retiredRecord = !rosterSeason && !freeAgentSeason && !draftProspectEntry
    ? (league.retiredPlayers ?? []).find((r) => r.playerId === selectedPlayerId)
    : undefined;

  // A player can be looked up from anywhere their name is clickable — an active roster, free
  // agency, an undrafted prospect, or a retired Hall of Fame case — not just a current roster spot.
  const selectedSeason = rosterSeason ?? freeAgentSeason ?? draftProspectEntry?.trueSeason ?? retiredRecord?.finalSeasonData;
  const selectedTeamName = rosterTeam?.name
    ?? (freeAgentSeason ? 'Free Agent'
      : draftProspectEntry ? 'Draft Prospect (Undrafted)'
        : retiredRecord ? `${retiredRecord.finalTeamName} (Retired)`
          : 'Unknown');

  /** A player's look (Edit look): cosmetic only, so it works in every league, not just Sandbox, and changes nothing else. */
  const updatePlayerLook = (playerId: string, appearance: import('./visuals/playerSprite').Appearance | undefined) => {
    const apply = <T extends { playerId: string; appearance?: import('./visuals/playerSprite').Appearance }>(s: T): T => {
      if (s.playerId !== playerId) return s;
      const next = { ...s };
      if (appearance) next.appearance = appearance; else delete next.appearance;
      return next;
    };
    setLeague(l => ({ ...l, teams: l.teams.map(t => (t.seasons.some(s => s.playerId === playerId) ? { ...t, seasons: t.seasons.map(apply) } : t)) }));
    setExtras(x => (x.freeAgents.some(s => s.playerId === playerId) ? { ...x, freeAgents: x.freeAgents.map(apply) } : x));
  };
  const updatePlayer = (next: NonNullable<typeof selectedSeason>) => {
    if (!sandboxMode) return;
    if (rosterTeam) {
      setLeague((l) => ({
        ...l,
        teams: l.teams.map((t) => (t.teamId !== rosterTeam.teamId ? t : {
          ...t,
          seasons: t.seasons.map((s) => (s.playerId === next.playerId ? next : s)),
        })),
      }));
    } else if (freeAgentSeason) {
      setExtras((e) => ({ ...e, freeAgents: e.freeAgents.map((s) => (s.playerId === next.playerId ? next : s)) }));
    } else if (draftProspectEntry) {
      setExtras((e) => ({ ...e, draftClass: e.draftClass.map((p) => (p.playerId === next.playerId ? { ...p, trueSeason: next } : p)) }));
    } else if (retiredRecord) {
      setLeague((l) => ({
        ...l,
        retiredPlayers: (l.retiredPlayers ?? []).map((r) => (r.playerId === next.playerId ? { ...r, finalSeasonData: next, ...(r.preStart ? { keepData: true } : {}) } : r)),
      }));
    }
  };

  const updatePlayerOnTeam = (teamId: string, next: (typeof league.teams)[number]['seasons'][number]) => {
    if (!sandboxMode) return;
    setLeague((l) => ({
      ...l,
      teams: l.teams.map((t) => (t.teamId !== teamId ? t : { ...t, seasons: t.seasons.map((s) => (s.playerId === next.playerId ? { ...next, badges: sandboxMode ? next.badges : s.badges } : s)) })),
    }));
  };

  const runExhibitionGame = () => {
    const home = league.teams.find((t) => t.teamId === exhibitionHomeId);
    const away = league.teams.find((t) => t.teamId === exhibitionAwayId);
    if (!home || !away) return;
    const result = simulateGame({
      home: { teamId: home.teamId, seasons: home.seasons, coach: home.coach, chemistry: home.chemistry, coachIdentity: home.coachIdentity, rotationOrder: home.rotationOrder },
      away: { teamId: away.teamId, seasons: away.seasons, coach: away.coach, chemistry: away.chemistry, coachIdentity: away.coachIdentity, rotationOrder: away.rotationOrder },
      settings,
    });
    setGameResult(result);
    setWatchNextResult(false);
    setBoxscoreSource('exhibition');
    setTab('boxscore');
  };

  const viewScheduledGame = (gameId: string) => {
    const g = league.schedule.find((s) => s.id === gameId);
    if (g?.result) {
      setWatchNextResult(false);
      setViewedGameId(gameId);
      setBoxscoreSource('league');
      setTab('boxscore');
    }
  };

  const exhibitionHomeTeam = league.teams.find((t) => t.teamId === exhibitionHomeId);
  const exhibitionAwayTeam = league.teams.find((t) => t.teamId === exhibitionAwayId);
  const controlledTeam = controlledTeamId ? league.teams.find((t) => t.teamId === controlledTeamId) : null;
  const unplayedCount = gamesRemainingForTeam(league, controlledTeamId);
  const leagueUnplayedCount = league.schedule.filter((g) => !g.played).length;
  const tradeDeadlinePassed = isTradeDeadlinePassed(league);
  const seasonComplete = league.schedule.length > 0 && league.schedule.every((g) => g.played);
  const rosterIssues = seasonPhase === 'regular_season' && !seasonComplete ? rosterComplianceIssues(league, extras.capSettings) : [];
  const draftOrderList = currentDraftOrder(league, extras);
  const draftPicksRemaining = extras.draftDayOpen ? Math.max(0, draftOrderList.length - extras.draftPickIndex) : 0;
  const hasUpcomingDraftPick = !!controlledTeamId && draftOrderList.slice(extras.draftPickIndex).includes(controlledTeamId);

  // --- Tutorial: Simple menu, unlocks, coach's tour, lesson pointers, checklist and road map ---
  const tutorial = tutorialOf(league);
  const navMode: NavMode = tutorial?.navMode ?? 'full';
  const unlockCtx = { league, controlledTeamId, pendingTradeOffers: extras.pendingTradeOffers.length };
  const locked = lockedFeatures(unlockCtx);
  const lockedTabSet = new Set(locked.flatMap((s) => s.feature.tabs));
  const freshTabs = newFeatureTabs(unlockCtx);
  const unlockNotice: Feature | undefined = pendingUnlockNotices(unlockCtx)[0];
  const lessons = tutorial && controlledTeamId ? lessonStatuses(unlockCtx) : [];
  const lessonsDone = lessons.filter((s) => s.done).length;
  const changeTutorial = (patch: Partial<TutorialState> | ((t: TutorialState) => Partial<TutorialState>)) => setLeague((l) => updateTutorial(l, patch));
  const changeNavMode = (mode: NavMode) => {
    rememberNavMode(mode);
    // Tools that opened while the Full menu was on are simply there: no notices or NEW tags for them.
    changeTutorial((t) => {
      if (mode !== 'simple') return { navMode: mode };
      const open = featureStatuses(unlockCtx, t).filter((s) => s.unlocked).map((s) => s.feature.id);
      return { navMode: mode, seenUnlocks: [...new Set([...t.seenUnlocks, ...open])], opened: [...new Set([...t.opened, ...open])] };
    });
  };
  const acknowledgeUnlock = (feature: Feature, opened: boolean) => changeTutorial((t) => ({
    seenUnlocks: t.seenUnlocks.includes(feature.id) ? t.seenUnlocks : [...t.seenUnlocks, feature.id],
    opened: opened && !t.opened.includes(feature.id) ? [...t.opened, feature.id] : t.opened,
  }));
  const [hint, setHint] = useState<HintId | null>(null);
  const navigateFromMenu = (next: string) => {
    const feature = featureForTab(next);
    if (feature && tutorial && !lockedTabSet.has(next) && !tutorial.opened.includes(feature.id)) acknowledgeUnlock(feature, true);
    setHint(null);
    setTab(next as Tab);
  };
  const steps = tourSteps({ teamName: controlledTeam?.name ?? null, navMode, hasLocks: locked.length > 0 });
  const tourStep = tutorial?.tourStep;
  const tourActive = league.teams.length > 0 && tourStep != null && tourStep < steps.length;
  const goToTourStep = (index: number) => {
    const step = steps[index];
    if (step?.tab) setTab(step.tab as Tab);
    changeTutorial({ tourStep: index });
  };
  const endTour = (status: 'finished' | 'skipped') => {
    rememberTourSeen(status);
    changeTutorial((t) => ({ tourStep: undefined, tourStatus: status === 'finished' || t.tourStatus === 'finished' ? 'finished' : 'skipped' }));
  };
  const startTour = () => { setHint(null); goToTourStep(0); };
  const goToLesson = (lesson: Lesson) => {
    if ('tour' in lesson.go) { startTour(); return; }
    setTab(lesson.go.tab as Tab);
    setHint(lesson.go.hint);
  };
  // The header scoreboard: your record and place in the table.
  const topbarRecord = (() => {
    if (!controlledTeam || screen !== 'app') return null;
    const row = computeStandings(league).find((r) => r.teamId === controlledTeam.teamId);
    if (!row) return null;
    const conference = hasConferenceStructure(league) && controlledTeam.conferenceId ? computeConferenceStandings(league)[controlledTeam.conferenceId] : null;
    const rows = conference ?? computeStandings(league);
    return { wins: row.wins, losses: row.losses, rank: rows.findIndex((r) => r.teamId === controlledTeam.teamId) + 1, scope: conference ? 'conference' : 'league' };
  })();
  const checklistChip = tutorial?.origin === 'new' && controlledTeamId && tutorial.checklistHidden && lessons.length > 0 && lessonsDone < lessons.length
    ? <button type="button" className="checklist-chip" data-tour="checklist-toggle" onClick={() => changeTutorial({ checklistHidden: false })}>First-season checklist {lessonsDone}/{lessons.length}</button>
    : null;

  // Google's own certified consent tool (opt-in via AD_CONFIG.googleCmp) needs its script present on every
  // page, not just where ads render, since it decides consent before any ad slot mounts.
  useEffect(() => {
    if (!IS_DESKTOP_BUILD && AD_CONFIG.googleCmp && AD_CONFIG.enabled && AD_CONFIG.adsenseClient && !hasEntitlement('noAds')) loadGoogleConsentTool(AD_CONFIG.adsenseClient);
  }, []);

  if (restoring) return <main role="status" className="navigation-loading">Opening your league…</main>;
  if (showPrivacy) return <PrivacyPolicyPage onClose={closePrivacy} />;

  if (screen === 'draft') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><Suspense fallback={<main role="status" className="navigation-loading">Opening the draft room…</main>}><AllTimeDraft onExit={() => setScreen('menu')} onStart={(l, e, teamId, name) => { enterApp(l, e, teamId, name); setTab('dashboard'); }} /></Suspense></>;
  }
  if (screen === 'community') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><Suspense fallback={<main role="status" className="navigation-loading">Opening Community…</main>}><Community onExit={() => { setCommunityUser(null); setScreen('menu'); }} user={communityUser} onUser={u => setCommunityUser(u || null)} /></Suspense></>;
  }
  // The GM Locker lives in the Player Profile now: an old #/locker link opens its Trophy room.
  if (screen === 'profile' || screen === 'locker') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><Suspense fallback={<main role="status" className="navigation-loading">Opening your profile…</main>}><ProfileHub key={screen} initialTab={screen === 'locker' ? 'trophies' : 'profile'} onExit={() => setScreen('menu')} /></Suspense></>;
  }
  if (screen === 'settings') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><SettingsPage onExit={() => setScreen('menu')} backups={<>
      <BackupPanel />
      <SaveRecoveryPanel beforeAction={async () => { await debouncedSave.flush(); }} onOpen={async id => { jobs.resetAll(); await debouncedSave.flush(); await continueSavedUniverse(id); }} />
    </>} /></>;
  }
  if (screen === 'career') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><Suspense fallback={<main role="status" className="navigation-loading">Opening Career Mode…</main>}><CareerMode onExit={() => setScreen('menu')} /></Suspense></>;
  }
  if (screen === 'hunt') {
    return <><ToastStack toasts={toasts} onDismiss={dismissToast} /><Suspense fallback={<main role="status" className="navigation-loading">Opening League Hunt…</main>}><LeagueHunt onExit={() => setScreen('menu')} /></Suspense></>;
  }

  if (screen === 'menu') {
    return (
      <>
        <DownloadButton />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <MainMenu
          onStart={startGameMode}
          onLocker={() => setScreen('locker')}
          onProfile={() => setScreen('profile')}
          onCommunity={() => { setCommunityUser(null); setScreen('community'); }}
          onCode={startFromCode}
          busy={menuBusy}
          saves={saveSummaries}
          onContinue={continueSavedUniverse}
          onDeleteSave={handleDeleteSave}
          onSettings={() => setScreen('settings')}
          onRenameSave={handleRenameSave}
        />

      </>
    );
  }

  if (screen === 'chooseTeam' && pendingLeague && pendingExtras) {
    return (
      <>
        <DownloadButton />
        <ChooseTeamScreen
          league={pendingLeague}
          extras={pendingExtras}
          onConfirm={(l, e, teamId, asOwner) => {
            const withTour = l.tutorial ? l : { ...l, tutorial: createTutorial(l, { tourSeen: readTourSeen(), navMode: readPreferredNavMode() }) };
            if (!asOwner) { enterApp(withTour, e, teamId, pendingLeagueName); return; }
            // Owner's Box: you own the team and the AI runs every roster (yours with the GM you hire).
            const owned = startOwnership(withTour, e, teamId);
            enterApp(owned.league, owned.extras, null, pendingLeagueName);
            setTab('ownerBox');
          }}
        />
        <ConsentBanner />
      </>
    );
  }

  return (
    <TeamLinksProvider teams={league.teams} saveId={activeSaveId}><TeamIdentityProvider teams={league.teams} freeAgents={extras.freeAgents}><div className="app-shell">
      <DownloadButton />
      <header className="topbar">
        <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((v) => !v)} aria-label="Toggle navigation" aria-expanded={!sidebarCollapsed} aria-controls="game-navigation" title="Toggle navigation">
          <PixelIcon name="menu" />
        </button>
        <div className="brand">
          <img src={logoIcon} alt="" className="brand-logo" />
          <span className="brand-word">COURTVISION</span>
        </div>
        {controlledTeam && topbarRecord ? (
          <div className="topbar-team">
            <TeamLogo team={controlledTeam} size={32} />
            <span className="topbar-team-text">
              <TeamLink teamId={controlledTeam.teamId} />
              <small>{topbarRecord.rank ? `${ordinalRank(topbarRecord.rank)} in ${topbarRecord.scope} · ` : ''}{PHASE_NAMES[seasonPhase]}</small>
            </span>
            <span className="topbar-record" aria-label={`Record ${topbarRecord.wins} and ${topbarRecord.losses}`}>{topbarRecord.wins}-{topbarRecord.losses}</span>
          </div>
        ) : <span className="phase-tag">{league.teams.length} teams · {PHASE_NAMES[seasonPhase]}</span>}
        {league.calendarDate && <span className="calendar-date-tag">{formatDisplayDate(league.calendarDate)}</span>}
      </header>
      {league.teams.length > 0 && <PlayButton
        seasonPhase={seasonPhase}
        rosterIssues={rosterIssues}
        leagueUnplayedCount={leagueUnplayedCount}
        tradeDeadlinePassed={tradeDeadlinePassed || !tradeDeadlineEnabled(league) || isDeadlineDayOpen(league)}
        onWatchNext={() => playNextGame(true)}
        onCoachNext={controlledTeamId ? () => playNextGame(true, true) : undefined}
        onPlayAllStar={playAllStarWeekend}
        onOpenAllStar={() => setTab('allStarWeekend')}
        autoAllStar={autoAllStar}
        onToggleAutoAllStar={toggleAutoAllStar}
        autoDeadline={autoDeadline}
        onToggleAutoDeadline={toggleAutoDeadline}
        onSkipDeadline={skipDeadline}
        onSimulateGames={simulateGamesCount}
        onSimulateToDeadline={simulateToTradeDeadline}
        deadlineClockLabel={isDeadlineDayOpen(league) ? deadlineClock(league.deadlineDay!.hour) : null}
        onOpenDeadline={() => setTab('deadline')}
        onOpenYearInReview={controlledTeamId ? () => setTab('yearInReview') : undefined}
        seasonSimJob={{
          running: jobs.seasonSim.running,
          progress: jobs.seasonSim.progress,
          start: () => { const ready = prepareRegularSeason(); if (ready) { simTargetRef.current = { round: Infinity, seedBase: seed + 500 }; jobs.seasonSim.start(ready.league, seed + 500); } },
          cancel: jobs.seasonSim.cancel,
        }}
        autoPlayJob={{
          running: jobs.autoPlay.running,
          progress: jobs.autoPlay.progress,
          start: (years) => { const ready = prepareRegularSeason(false); if (ready) jobs.autoPlay.start({ league: ready.league, extras: ready.extras, controlledTeamId, awardSettings, years, seedBase: seed + 555_000 }); },
          cancel: jobs.autoPlay.cancel,
        }}
        seasonComplete={seasonComplete}
        onBeginPlayoffs={beginPlayoffsPhase}
        playoffBracket={playoffBracket}
        onSimulateEntirePlayoffs={simulateEntirePlayoffsAndUpdate}
        onViewSeasonRecap={beginAwardsRecap}
        onContinueToDraft={beginDraftPhase}
        draftPicksRemaining={draftPicksRemaining}
        hasUpcomingDraftPick={hasUpcomingDraftPick}
        onSimToMyNextPick={simToMyNextDraftPick}
        onSimEntireDraftAndContinue={simEntireDraftAndContinue}
        onContinueToResignWaive={beginResignWaivePhase}
        onContinueToFreeAgency={beginFreeAgencyPhase}
        freeAgencyDaysRemaining={extras.freeAgencyDaysRemaining}
        onSkipFreeAgencyAndContinue={skipFreeAgencyAndContinue}
        onStartRegularSeason={startRegularSeason}
      />}
      {importMessage && <div className="import-toast">{importMessage} <button onClick={() => setImportMessage(null)} aria-label="Dismiss">×</button></div>}
      {seasonSummary && (
        <div className="import-toast">
          {formatSeasonYear(seasonSummary.previousSeason)} → {formatSeasonYear(seasonSummary.newSeason)}: {seasonSummary.retiredPlayerIds.length} retired,{' '}
          {seasonSummary.expiredToFreeAgencyIds.length} hit free agency, {seasonSummary.newDraftClassSize} new draft prospects.
          {seasonSummary.seasonAwards.mvp && <> MVP: {seasonSummary.seasonAwards.mvp.playerId}.</>}
          {seasonSummary.pickProtectionsTriggered.length > 0 && (
            <> {seasonSummary.pickProtectionsTriggered.length} traded pick{seasonSummary.pickProtectionsTriggered.length === 1 ? '' : 's'} stayed home this year (protection triggered).</>
          )}
          <button onClick={() => setSeasonSummary(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {ownerVerdict && <OwnerReviewDialog review={ownerVerdict.review} newAchievements={ownerVerdict.newAchievements} onClose={() => setOwnerVerdict(null)} />}
      {!ownerVerdict && frontOffice?.status === 'unemployed' && frontOffice.offers.length > 0 &&
        <JobOffersDialog league={league} onAccept={acceptOffer} onSpectate={spectate} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {celebration && <ChampionshipCelebration league={league} info={celebration} onClose={() => setCelebration(null)} onSelectPlayer={id => { setCelebration(null); selectPlayer(id); }} />}
      {tourActive && tourStep != null && (
        <CoachGuide
          key={`tour-${tourStep}`}
          step={steps[tourStep]}
          index={tourStep}
          total={steps.length}
          onBack={() => goToTourStep(Math.max(0, tourStep - 1))}
          onNext={() => (tourStep + 1 < steps.length ? goToTourStep(tourStep + 1) : endTour('finished'))}
          nextLabel={tourStep + 1 < steps.length ? `Next: ${steps[tourStep + 1].title}` : "Let's play"}
          onSkip={() => endTour('skipped')}
        />
      )}
      {!tourActive && hint && <CoachGuide key={`hint-${hint}`} step={hintStep(hint)} onNext={() => setHint(null)} nextLabel="Got it" />}
      {!tourActive && !hint && unlockNotice && (
        <UnlockNotice
          feature={unlockNotice}
          onShow={() => { acknowledgeUnlock(unlockNotice, true); setHint(null); setTab(unlockNotice.home as Tab); }}
          onLater={() => acknowledgeUnlock(unlockNotice, false)}
        />
      )}

      <div className="app-body">
        <Sidebar
          historical={!!league.historical}
          sandboxMode={sandboxMode} onMainMenu={() => setConfirmation('exit')}
          tab={tab}
          onNavigate={navigateFromMenu}
          navMode={navMode}
          onNavModeChange={league.teams.length > 0 ? changeNavMode : undefined}
          lockedFeatures={locked}
          newTabs={freshTabs}
          onUnlockAll={() => changeTutorial({ unlockAll: true })}
          collapsed={sidebarCollapsed}
          hasControlledTeam={!!controlledTeam}
          seasonPhase={seasonPhase}
          onNavigateLeagueSettings={(sub) => { setLeagueSettingsSub(sub); setTab('leagueSettings'); }}
          pendingTradeOfferCount={extras.pendingTradeOffers.length}
        />
        <main tabIndex={0} aria-label="Game content">
        <AdBanner slot="top" refreshKey={tab} />
        <Suspense fallback={<p className="empty-state page-loading" role="status">Loading…</p>}>
        {tab === 'teamProfile' && <TeamProfilePage league={league} extras={extras} teamId={viewedTeamId} onSelectPlayer={selectPlayer} />}
        {tab === 'sandbox' && <SandboxPage enabled={sandboxMode} league={league} extras={extras} onChange={(l, e) => { setLeague(l); setExtras(e); }} onToast={pushToast} onToggle={() => { if (sandboxMode) { setSandboxMode(false); setTab('sandbox'); } else setConfirmation('sandbox'); }} />}
        {confirmation && <ConfirmationDialog title={confirmation === 'sandbox' ? 'Enable Sandbox Mode?' : 'Return to Main Menu?'} confirmLabel={confirmation === 'sandbox' ? 'Enable Sandbox' : 'Save & Exit'} onCancel={() => setConfirmation(null)} onConfirm={async () => {
          if (confirmation === 'sandbox') { setSandboxMode(true); setConfirmation(null); }
          else { await returnToMenu(); setConfirmation(null); }
        }}>
          {confirmation === 'sandbox' ? <><p>This makes the entire league controllable. You can edit players and badges, manage any team, import league data, and unlock the sandbox editing tools.</p><p>Changes are saved to this league. Turning Sandbox off later will not undo them. Create a backup first if you want to keep an untouched version.</p><p><b>Achievements turn off for this league permanently</b>, and its GM career will not count toward your all-leagues record, even if you turn Sandbox off again.</p></> : <p>Your current league will be saved before leaving. Any running Auto Play or season simulation will stop. You can continue this league from the main menu.</p>}
        </ConfirmationDialog>}
        {tab === 'database' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet. Go to Settings to import data and build a league from a CSV.</p>
            : <PlayerDatabase teams={league.teams} selectedPlayerId={selectedPlayerId} onSelect={selectPlayer} />
        )}

        {(tab === 'editor' || tab === 'playerDevelopment') && (
          selectedSeason
            ? <PlayerProfile key={selectedPlayerId} onLookChange={updatePlayerLook} controlledTeamId={controlledTeamId} activeTab={tab === 'playerDevelopment' ? 'development' : 'overview'} onTabChange={view => setTab(view === 'development' ? 'playerDevelopment' : 'editor')}
                season={selectedSeason} teamName={selectedTeamName} sandboxMode={sandboxMode} onChange={updatePlayer} league={league}
                extras={extras}
                onLeagueExtrasChange={(nextLeague, nextExtras, newPlayerId) => {
                  setLeague(nextLeague);
                  setExtras(nextExtras);
                  if (newPlayerId) setSelectedPlayerId(newPlayerId);
                }}
              />
            : league.historical && selectedPlayerId
              ? <div className="empty-state"><p>{selectedPlayerId} is not in this league — a real player whose career ended before it started.</p><button onClick={() => { setArchiveQuery(selectedPlayerId); setTab('nbaArchive'); }}>Find him in NBA History</button></div>
              : <p className="empty-state">No player selected. Pick one from the Database tab.</p>
        )}

        {tab === 'yourTeam' && controlledTeamId && (
          <YourTeamPage currentChampion={playoffBracket?.championTeamId} league={league} controlledTeamId={controlledTeamId} onSelectPlayer={selectPlayer} onChange={setLeague} />
        )}

        {tab === 'roster' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <TeamRosterPage initialTeamId={controlledTeamId} schedule={league.schedule}
              showTradeValues={extras.tradeSettings.showValues === true}
                franchiseHistory={league.franchiseHistory} currentChampion={playoffBracket?.championTeamId} currentSeason={league.season}
                canEditIdentity={teamId => sandboxMode || teamId === controlledTeamId}
                onIdentityChange={(teamId, identity) => canEditTeam(sandboxMode, controlledTeamId, teamId) && setLeague(l => ({ ...l, teams: l.teams.map(t => t.teamId === teamId ? { ...t, identity } : t) }))}
                teams={league.teams} onRunDevelopmentPass={sandboxMode ? runDevelopmentPass : undefined} onSelectPlayer={selectPlayer} injuries={league.injuries}
                contracts={extras.contracts} capSettings={extras.capSettings} standings={computeStandings(league)}
                onRelease={(teamId, playerId) => {
                  if (!canEditTeam(sandboxMode, controlledTeamId, teamId)) return;
                  const result = waiveToFreeAgency(league, extras, playerId, teamId, managerId);
                  if (result.league === league && result.extras === extras) {
                    pushToast(`Can't release ${playerId} — that roster is at the ${extras.capSettings.minRosterSize}-player minimum.`, 'error');
                    return;
                  }
                  setLeague(result.league);
                  setExtras(result.extras);
                  pushToast(`Released ${playerId} to free agency.`, 'success');
                }}
                onTradeAway={(playerId) => {
                  if (!sandboxMode && !league.teams.find(t => t.teamId === controlledTeamId)?.seasons.some(p => p.playerId === playerId)) return;
                  setExtras((e) => toggleTradeBlock(e, playerId));
                  setTab('tradeBlock');
                }}
                onOpenCoachMarket={() => setTab('staff')}
                retiredPlayers={league.retiredPlayers}
                onRetireJersey={(teamId, number, playerId) => {
                  if (!canEditTeam(sandboxMode, controlledTeamId, teamId)) return;
                  setLeague((l) => ({ ...l, teams: l.teams.map((t) => (t.teamId === teamId ? retireJerseyNumber(t, number, playerId, l.season ?? '2026') : t)) }));
                }}
                onUnretireJersey={(teamId, number) => {
                  if (!canEditTeam(sandboxMode, controlledTeamId, teamId)) return;
                  setLeague((l) => ({ ...l, teams: l.teams.map((t) => (t.teamId === teamId ? unretireJerseyNumber(t, number) : t)) }));
                }}
              />
        )}

        {tab === 'code' && (
          selectedSeason
            ? <CodeMode season={selectedSeason} onChange={updatePlayer} />
            : <p className="empty-state">No player selected. Pick one from the Database tab.</p>
        )}

        {tab === 'bulk' && (
          <BulkEditor teams={league.teams} onApply={(teams) => setLeague((l) => ({ ...l, teams }))} />
        )}

        {tab === 'fastEdit' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <FastEditPage teams={league.teams} sandboxMode={sandboxMode} onUpdatePlayer={updatePlayerOnTeam} onSelectPlayer={selectPlayer} />
        )}

        {tab === 'compare' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <ComparePage teams={league.teams} />
        )}

        {tab === 'standings' && (
          league.teams.length < 2
            ? <p className="empty-state">Need at least two teams for standings.</p>
            : <StandingsPage league={league} />
        )}

        {tab === 'schedule' && (
          league.teams.length < 2
            ? <p className="empty-state">Need at least two teams for a league schedule.</p>
            : <SchedulePage league={league} controlledTeamId={controlledTeamId} onViewGame={viewScheduledGame} />
        )}

        {tab === 'playoffs' && (
          league.teams.length < 4
            ? <p className="empty-state">Need at least four teams for a playoff bracket.</p>
            : <PlayoffsPage league={league} onChange={setLeague} bracket={playoffBracket} onBracketChange={setPlayoffBracket} onCelebrate={replayCelebration} controlledTeamId={controlledTeamId} />
        )}

        {tab === 'finances' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <FinancesPage sandboxMode={sandboxMode}
                league={league} extras={extras} controlledTeamId={managerId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }}
              />
        )}

        {tab === 'trade' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <TradePage
              sandboxMode={sandboxMode}
                league={league} extras={extras} controlledTeamId={managerId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }} onToast={pushToast}
              />
        )}

        {tab === 'tradeBlock' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <TradeBlockPage
                league={league} extras={extras} controlledTeamId={managerId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }} onSelectPlayer={selectPlayer}
              />
        )}


        {tab === 'tradeOffers' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <TradeOffersPage
                league={league} extras={extras} controlledTeamId={controlledTeamId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }}
              />
        )}

        {tab === 'freeAgency' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <><FreeAgencyPage sandboxMode={sandboxMode}
                league={league} extras={extras} controlledTeamId={managerId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }} onSelectPlayer={selectPlayer}
              />
              {!league.rebuildChallenge && <Suspense fallback={null}><CareerImportPanel league={league} extras={extras} allowTeams={sandboxMode} onChange={(l, e) => { setLeague(l); setExtras(e); }} onToast={pushToast} /></Suspense>}</>
        )}

        {tab === 'draft' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <DraftPage
                league={league} extras={extras} controlledTeamId={managerId}
                onChange={(l, e) => { setLeague(l); setExtras(e); }} onSelectPlayer={selectPlayer}
                summerLeagueReady={canPlaySummerLeague(league, extras)} onOpenSummerLeague={() => setTab('summerLeague')}
              />
        )}
        {tab === 'summerLeague' && <SummerLeaguePage league={league} controlledTeamId={controlledTeamId} canPlay={canPlaySummerLeague(league, extras)} busy={summerBusy}
          onPlay={playSummerLeague} onSelectPlayer={selectPlayer}
          onContinue={seasonPhase === 'draft' && !extras.draftDayOpen && extras.draftPickIndex > 0 ? beginResignWaivePhase : undefined} />}

        {tab === 'staff' && <StaffPage league={league} controlledTeamId={controlledTeamId} sandboxMode={sandboxMode} onChange={setLeague} />}
        {tab === 'development' && <DevelopmentCenterPage league={league} controlledTeamId={controlledTeamId} sandboxMode={sandboxMode} onChange={setLeague} onSelectPlayer={id => { selectPlayer(id); setTab('playerDevelopment'); }} />}
        {tab === 'coaching' && <CoachingPage onOpenStaff={() => setTab('staff')} onOpenDevelopment={() => setTab('development')} sandboxMode={sandboxMode} league={league} controlledTeamId={controlledTeamId} onChange={setLeague} onOpenRoster={() => setTab('roster')} />}

        {tab === 'allStarWeekend' && (
          <AllStarWeekendPage
            league={league} awardSettings={awardSettings} seed={seed} onSelectPlayer={selectPlayer} onChange={setLeague} controlledTeamId={controlledTeamId}
            onComplete={(nextLeague) => { setLeague(nextLeague); setTab('standings'); pushToast('All-Star Weekend complete — the regular season continues.', 'success'); }}
          />
        )}

        {tab === 'injuries' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <InjuryReportPage sandboxMode={sandboxMode} league={league} controlledTeamId={controlledTeamId} onChange={setLeague} onSelectPlayer={selectPlayer} />
        )}

        {tab === 'threeTeam' && <ThreeTeamTradePage league={league} extras={extras} controlledTeamId={controlledTeamId} onChange={(l, e) => { setLeague(l); setExtras(e); }} />}
        {tab === 'extensions' && <ExtensionsPage league={league} extras={extras} controlledTeamId={controlledTeamId} onChange={(l, e) => { setLeague(l); setExtras(e); }} onSelectPlayer={selectPlayer} />}
        {tab === 'storylines' && <StorylinesPage league={league} extras={extras} controlledTeamId={controlledTeamId} onSelectPlayer={selectPlayer} />}
        {tab === 'summerCamp' && <SummerCampPage league={league} controlledTeamId={controlledTeamId} onChange={setLeague} onSelectPlayer={selectPlayer} />}
        {tab === 'medical' && <MedicalRoomPage league={league} controlledTeamId={controlledTeamId} onChange={setLeague} onSelectPlayer={selectPlayer} />}
        {tab === 'press' && <PressRoomPage league={league} extras={extras} controlledTeamId={controlledTeamId} onChange={setLeague} />}
        {tab === 'cards' && <CardAlbumPage />}
        {tab === 'gmRivals' && <GmRivalsPage league={league} extras={extras} />}
        {tab === 'ownerBox' && <OwnerBoxPage league={league} extras={extras} controlledTeamId={controlledTeamId} onToast={pushToast}
          onChange={(l, e) => { setLeague(l); if (e) setExtras(e); }}
          onExpand={(bid, voted) => { void import('./simulation/ownerBox').then(m => m.expandLeague(voted, extras, bid, seed + 4242)).then(r => { setLeague(r.league); setExtras(r.extras); pushToast(`Expansion draft done: the ${bid.city} ${bid.nickname} join the league.`, 'success'); }).catch(() => pushToast('The expansion draft could not run.', 'error')); }} />}
        {tab === 'timeline' && <FranchiseTimelinePage league={league} extras={extras} controlledTeamId={controlledTeamId} onSelectPlayer={selectPlayer} />}
        {tab === 'travel' && <RoadTripsPage league={league} controlledTeamId={controlledTeamId} onChange={setLeague} />}
        {tab === 'yearInReview' && <YearInReviewPage league={league} extras={extras} controlledTeamId={controlledTeamId} awardOptions={awardOptions(awardSettings)}
          onOpenAwards={() => setTab('awards')} onSelectPlayer={selectPlayer}
          onOpenGame={(id) => { setViewedGameId(id); setBoxscoreSource('league'); setTab('boxscore'); }} />}

        {tab === 'awards' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <AwardsPage league={league} onSelectPlayer={selectPlayer} awardSettings={awardSettings} finalsBracket={playoffBracket} onCelebrate={replayCelebration} />
        )}

        {tab === 'analytics' && (
          league.teams.length === 0
            ? <p className="empty-state">No teams yet.</p>
            : <AnalyticsPage league={league} onSelectPlayer={selectPlayer} />
        )}

        {tab === 'history' && (
          <FranchiseHistoryPage league={league} onSelectPlayer={selectPlayer} />
        )}
        {tab === 'teamHistory' && <TeamHistoryPage key={viewedTeamId || controlledTeamId || 'team'} league={league} extras={extras} initialTeamId={viewedTeamId || controlledTeamId} onSelectPlayer={selectPlayer} onOpenArchive={league.historical ? () => setTab('nbaArchive') : undefined} />}
        {tab === 'records' && <RecordsPage league={league} extras={extras} onSelectPlayer={selectPlayer} />}
        {tab === 'almanac' && <AlmanacPage league={league} extras={extras} awardSettings={awardSettings} onSelectPlayer={selectPlayer} />}
        {tab === 'nbaArchive' && <NbaArchivePage key={archiveQuery} league={league} extras={extras} onSelectPlayer={selectPlayer} initialQuery={archiveQuery} onLoadRetirees={loadRetirees} />}

        {tab === 'resignWaive' && (
          <ResignWaivePage
            league={league} extras={extras} controlledTeamId={managerId} summary={seasonSummary}
            onChange={(l, e) => { setLeague(l); setExtras(e); }}
            onContinue={beginFreeAgencyPhase}
            onSelectPlayer={selectPlayer}
          />
        )}

        {tab === 'preseason' && (
          <PreseasonPage league={league} controlledTeamId={controlledTeamId} onStartSeason={startRegularSeason} />
        )}

        {tab === 'legends' && (
          <LegendsPage sandboxMode={sandboxMode} seed={seed} />
        )}

        {tab === 'lab' && (
          exhibitionHomeTeam && exhibitionAwayTeam
            ? (
              <SimulationLab
                home={{ teamId: exhibitionHomeTeam.teamId, seasons: exhibitionHomeTeam.seasons, coach: exhibitionHomeTeam.coach }}
                away={{ teamId: exhibitionAwayTeam.teamId, seasons: exhibitionAwayTeam.seasons, coach: exhibitionAwayTeam.coach }}
                settings={settings}
                focusPlayerId={selectedPlayerId}
              />
            )
            : <p className="empty-state">Need at least two teams to run the Simulation Lab.</p>
        )}

        {tab === 'leagueSettings' && (
          <div>
            <nav className="subtabs">
              <button className={leagueSettingsSub === 'awards' ? 'active' : ''} onClick={() => setLeagueSettingsSub('awards')}>Award Formulas</button>
              <button className={leagueSettingsSub === 'rules' ? 'active' : ''} onClick={() => setLeagueSettingsSub('rules')}>League Rules</button>
            </nav>
            {leagueSettingsSub === 'awards' && <LeagueSettingsPage settings={awardSettings} onChange={setAwardSettings} seasonGames={seasonGamesPerTeam(league)} onSave={() => { handleSaveNow(); pushToast('Award settings saved.', 'success'); }} />}
            {leagueSettingsSub === 'rules' && (
              <><HistoricalSettingsCard league={league} extras={extras} onChange={setLeague} /><section className="settings-card">
                <h4>Roster and trade rules</h4><p className="hint-text">10–18 players for regular-season games. Coaches sign or waive players to meet the limits. Draft and offseason moves can temporarily exceed them.</p>
                <label className="trade-value-toggle"><input type="checkbox" checked={extras.tradeSettings.showValues === true} onChange={e => setExtras(prev => ({ ...prev, tradeSettings: { ...prev.tradeSettings, showValues: e.target.checked } }))} /> Show trade values</label>
              </section><LeagueRulesPage
                rules={league.rulesSettings ?? DEFAULT_LEAGUE_RULES}
                onChange={(rules) => setLeague((l) => ({ ...l, rulesSettings: rules, seasonPhase: rules.allStarEnabled === false && l.seasonPhase === 'all_star' ? 'regular_season' : l.seasonPhase }))}
                onSave={() => { handleSaveNow(); pushToast('League rules saved.', 'success'); }}
              /></>
            )}
            <CoachingSettingsPanel league={league} onChange={setLeague} />
          </div>
        )}

        {(tab === 'settings' || tab === 'imports') && (
          <div className="settings-page">
            {league.teams.length === 0 && <section className="import-setup"><span className="pixel-eyebrow">LEAGUE SETUP</span><h2>Import your league</h2><p>Real League starts with your CSV data. Preview the players below, then build your teams to begin.</p><button onClick={() => document.getElementById('csv-league-import')?.scrollIntoView({ behavior: 'smooth' })}>Go to CSV Import</button></section>}
            <section>
              <h4>Menu</h4>
              <button onClick={() => setConfirmation('exit')}>Back to Main Menu</button>
            </section>

            {league.teams.length > 0 && <LessonsSettingsCard
              navMode={navMode}
              onNavModeChange={changeNavMode}
              onReplayTour={startTour}
              checklistHidden={tutorial?.checklistHidden ?? true}
              onToggleChecklist={controlledTeamId ? () => changeTutorial((t) => ({ checklistHidden: !t.checklistHidden })) : undefined}
              lockedCount={locked.length}
              onUnlockAll={() => changeTutorial({ unlockAll: true })}
            />}

            {sandboxMode && <section>
              <h4>Tools</h4>
              <div className="code-mode-actions">
                <button onClick={() => setTab('database')}>Database</button>
                <button onClick={() => setTab('bulk')}>Bulk Editor</button>
                <button onClick={() => setTab('fastEdit')}>Fast Edit</button>
                <button onClick={() => setTab('code')}>Code Mode</button>
                <button onClick={() => setTab('legends')}>Legends</button>
                <button onClick={() => setTab('lab')}>Simulation Lab</button>
              </div>
            </section>}

            {sandboxMode && <section>
              <h4>Simulation Settings</h4>

              <label className="rating-row">
                <span className="rating-label">Seed</span>
                <input type="number" className="rating-number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              </label>
              <label className="rating-row">
                <span className="rating-label">Preset</span>
                <select defaultValue="" onChange={(e) => e.target.value && applyPreset(e.target.value as PresetName)}>
                  <option value="" disabled>Choose…</option>
                  {Object.keys(SETTINGS_PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            </section>}

            <section>
              <h4>Save / Load Universe</h4>
              <SaveRecoveryPanel saveId={activeSaveId} beforeAction={async () => { await debouncedSave.flush(); }} onOpen={async id => { jobs.resetAll(); await debouncedSave.flush(); await continueSavedUniverse(id); }} />
              <div className="code-mode-actions">
                <button onClick={handleSaveNow}>Save Locally Now</button>
                <button onClick={handleExport} title="Ctrl/Cmd+S">Export Universe (JSON)</button>
                {sandboxMode && <button onClick={() => fileInputRef.current?.click()}>Import Universe (JSON)</button>}
                <input
                  ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
                />
              </div>
            </section>

            {(sandboxMode || league.teams.length === 0) && <section>
              <h4 id="csv-league-import">Import Data (CSV to league/roster)</h4>
              <ImportPage teams={league.teams} onAddToTeam={addImportedPlayers} onBuildLeague={buildLeagueFromImport} />
            </section>}

            <section>
              <h4>Exhibition Game</h4>
              <div className="exhibition-controls">
                <select value={exhibitionHomeId} onChange={(e) => setExhibitionHomeId(e.target.value)}>
                  {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
                </select>
                <span>vs</span>
                <select value={exhibitionAwayId} onChange={(e) => setExhibitionAwayId(e.target.value)}>
                  {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
                </select>
                <button className="primary" disabled={league.teams.length < 2} onClick={runExhibitionGame}>Simulate Game</button>
              </div>
              {gameResult && boxscoreSource === 'exhibition' && (
                <p className="hint-text">Box score is open on the Box Score page. <button onClick={() => setTab('boxscore')}>View it</button></p>
              )}
            </section>
          </div>
        )}

        {tab === 'boxscore' && (() => {
          const playedGames = league.schedule.filter((g) => g.played && g.result);
          const viewedIndex = playedGames.findIndex((g) => g.id === viewedGameId);
          const scheduled = boxscoreSource === 'league'
            ? (viewedIndex >= 0 ? playedGames[viewedIndex] : playedGames[playedGames.length - 1])
            : null;
          const activeResult = boxscoreSource === 'exhibition' ? gameResult : scheduled?.result ?? null;
          if (!activeResult) {
            return <p className="empty-state">No game to show yet. Play a game from the header, or simulate an Exhibition Game in Settings.</p>;
          }
          const homeTeam = league.teams.find((t) => t.teamId === activeResult.homeTeamId);
          const awayTeam = league.teams.find((t) => t.teamId === activeResult.awayTeamId);
          const standings = computeStandings(league);
          const recordFor = (teamId: string) => {
            const r = standings.find((s) => s.teamId === teamId);
            return r ? `${r.wins}-${r.losses}` : undefined;
          };
          const idx = boxscoreSource === 'league' ? (viewedIndex >= 0 ? viewedIndex : playedGames.length - 1) : -1;
          return (
            <GameBoxScorePage
              key={`${scheduled?.id ?? activeResult.seed}-${watchNextResult}-${watchStart ?? ''}`}
              crowdFill={homeTeam ? crowdFill(league, homeTeam.teamId) : undefined}
              court={boxscoreSource === 'league' ? (() => {
                const rw = scheduled && controlledTeamId ? rivalryWeekGame(league, scheduled.id) : null;
                // An owner with a big enough legacy dresses his coach in the gold suit (Owner's Box reward).
                const gold = !!league.owner && ownerBest() >= OWNER_REWARD.goldSuit;
                const look = (t?: typeof homeTeam) => t?.coachIdentity ? { ...coachLook(t.coachIdentity.coachId, t.coachIdentity.age), ...(gold && t.teamId === league.owner?.teamId ? { outfit: 'suit' as const, suit: '#c9a227' } : {}) } : undefined;
                return { arena: arenaLevels(homeTeam), duos: new Set([...duoKeys(homeTeam), ...duoKeys(awayTeam)]), rivalryWeek: rw && controlledTeamId ? { hype: rivalryHype(league, controlledTeamId, rw) } : null,
                  coaches: { home: look(homeTeam), away: look(awayTeam) },
                  ...(league.owner && homeTeam?.teamId === league.owner.teamId ? { building: { name: league.owner.arena.name, suites: league.owner.arena.suites } } : {}) };
              })() : undefined}
              initialWatch={watchNextResult}
              watchStart={watchNextResult ? watchStart : undefined}
              coaching={boxscoreSource === 'league' && coachSession && scheduled?.id === coachSession.gameId && league === coachSession.committed && homeTeam && awayTeam ? {
                teamId: coachSession.teamId,
                openCoach: coachSession.openCoach,
                teamName: (coachSession.teamId === homeTeam.teamId ? homeTeam : awayTeam).name,
                roster: (coachSession.teamId === homeTeam.teamId ? homeTeam : awayTeam).seasons,
                commands: coachSession.commands,
                onCommand: coachCommand,
              } : undefined}
              game={activeResult}
              home={{ teamId: activeResult.homeTeamId, name: homeTeam?.name ?? activeResult.homeTeamId, record: boxscoreSource === 'league' ? recordFor(activeResult.homeTeamId) : undefined }}
              away={{ teamId: activeResult.awayTeamId, name: awayTeam?.name ?? activeResult.awayTeamId, record: boxscoreSource === 'league' ? recordFor(activeResult.awayTeamId) : undefined }}
              homeRoster={homeTeam?.seasons}
              awayRoster={awayTeam?.seasons}
              rivalry={boxscoreSource === 'league' ? rivalryBadge(league, activeResult.homeTeamId, activeResult.awayTeamId) : null}
              onSelectPlayer={selectPlayer}
              gamesLabel={boxscoreSource === 'league' && playedGames.length > 0 ? `Game ${idx + 1} of ${playedGames.length} played` : 'Exhibition game'}
              canPrev={boxscoreSource === 'league' && idx > 0}
              onPrev={() => setViewedGameId(playedGames[idx - 1]?.id ?? null)}
              canNext={boxscoreSource === 'league' && idx >= 0 && idx < playedGames.length - 1}
              onNext={() => setViewedGameId(playedGames[idx + 1]?.id ?? null)}
              onSimNext={boxscoreSource === 'league' ? () => playNextGame() : undefined}
              canSimNext={boxscoreSource === 'league' && unplayedCount > 0 && rosterIssues.length === 0}
            />
          );
        })()}

        {(tab === 'dashboard' || tab === 'database') && league.rebuildChallenge && <ChallengeBanner league={league} contracts={extras.contracts} onMenu={() => setConfirmation('exit')} />}
        {tab === 'dashboard' && controlledTeamId && <DailyGoalsCard official={isOfficialLeague(league)} />}
        {tab === 'dashboard' && league.origin && <LeagueCodeBox origin={league.origin} teamId={controlledTeamId} teamName={league.teams.find(t => t.teamId === controlledTeamId)?.name} />}
        {tab === 'dashboard' && (
          <DashboardPage
            league={league} extras={extras} controlledTeamId={controlledTeamId} seasonPhase={seasonPhase}
            onGoTo={(t) => setTab(t as Tab)}
            onSelectPlayer={selectPlayer}
            roadMap={league.teams.length > 1 ? <SeasonRoadMap
              map={seasonRoadMap(league, { controlledTeamId, autoAllStar, lockedTabs: lockedTabSet, freeAgencyDaysRemaining: extras.freeAgencyDaysRemaining })}
              eyebrow={`${formatSeasonYear(league.season)} · ${PHASE_NAMES[seasonPhase]}`}
              onGo={(t) => { setHint(null); setTab(t as Tab); }}
            /> : null}
            checklist={tutorial && controlledTeamId && !tutorial.checklistHidden && lessons.length > 0
              ? <FirstSeasonChecklist statuses={lessons} onGo={goToLesson} onHide={() => changeTutorial({ checklistHidden: true })} />
              : null}
            headerExtra={checklistChip}
            hideFinances={lockedTabSet.has('finances')}
          />
        )}

        {tab === 'autoPlay' && (
          <div className="settings-page">
            {league.teams.length === 0 && <section className="import-setup"><span className="pixel-eyebrow">LEAGUE SETUP</span><h2>Import your league</h2><p>Real League starts with your CSV data. Preview the players below, then build your teams to begin.</p><button onClick={() => document.getElementById('csv-league-import')?.scrollIntoView({ behavior: 'smooth' })}>Go to CSV Import</button></section>}
            <section>
              <h4>Auto Play</h4>
              <p className="hint-text">
                Fast-forward multiple seasons without reviewing every single game. For shorter jumps (a week, a
                month, the rest of this season) use the Play button in the corner — it now covers everything from
                one game up to a whole multi-season Auto Play run.
              </p>
            </section>

            <AutoPlayPage
              league={league} extras={extras} controlledTeamId={controlledTeamId} awardSettings={awardSettings} seed={seed}
              job={jobs.autoPlay} otherJobRunning={jobs.seasonSim.running}
              onOpenFranchiseHistory={() => setTab('history')} onOpenHallOfFame={() => setTab('hallOfFame')}
            />
          </div>
        )}

        {tab === 'playerStats' && (
          <PlayerStatsPage teams={league.teams} league={league} onSelect={selectPlayer} />
        )}

        {tab === 'powerRankings' && <PowerRankingsPage league={league} />}

        {tab === 'cup' && <CupPage league={league} controlledTeamId={controlledTeamId} onSelectPlayer={selectPlayer} />}

        {tab === 'deadline' && <DeadlineDayPage league={league} extras={extras} controlledTeamId={controlledTeamId}
          onChange={(l, e) => { setLeague(l); setExtras(e); }} onAdvanceHour={advanceDeadline} onSkipToDeadline={skipDeadline} onGoTo={(t) => setTab(t as Tab)} />}

        {tab === 'gmOffice' && <GmOfficePage league={league} extras={extras} onAcceptOffer={acceptOffer} onSpectate={spectate} onToggleFiring={setFiringEnabled} />}

        {tab === 'transactions' && <TransactionsPage league={league} extras={extras} onSelectPlayer={selectPlayer} />}

        {tab === 'watchList' && (
          <WatchListPage
            teams={league.teams} extras={extras}
            onExtrasChange={(e) => setExtras(e)}
            onSelectPlayer={selectPlayer}
          />
        )}

        {tab === 'teamStats' && <TeamStatsPage league={league} />}

        {tab === 'dailySchedule' && (
          <DailySchedulePage league={league} onChange={(l) => setLeague(l)} />
        )}

        {tab === 'news' && <NewsFeedPage league={league} extras={extras} onSelectPlayer={selectPlayer} onGame={id => { setViewedGameId(id); setBoxscoreSource('league'); setWatchNextResult(false); setTab('boxscore'); }} onWatchHighlight={(id, possession) => { setViewedGameId(id); setBoxscoreSource('league'); setWatchStart(possession); setWatchNextResult(true); setTab('boxscore'); }} onPlayoffs={() => setTab('playoffs')} />}

        {tab === 'hallOfFame' && <HallOfFamePage league={league} onSelectPlayer={selectPlayer} />}

        <AdBanner slot="inline" refreshKey={tab} />
        <footer className="legal-footer"><PrivacyLink /> · <CookieSettingsLink /></footer>
        </Suspense>
      </main>
      <ConsentBanner />
      </div>
    </div></TeamIdentityProvider></TeamLinksProvider>
  );
}

export default App;

function ordinalRank(n: number): string {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th');
}
