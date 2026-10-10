import { localRead, type Read } from '../lib/kv';
import type { TrophyKey } from '../simulation/trophies';
import { readLegacy } from '../storage/gmLegacy';
import { loadRecords } from '../hunt/storage';
import { loadPerfectRecords, categoryTitles, categoryTeamTitles, categoryBrutal, categoryPerfect } from '../perfect/storage';
import { loadRebuildRecords } from '../simulation/rebuildChallenge';
import { loadWeeklyRecords } from '../retention/weekly';
import { careerCache } from './profile';
import { readFeats, type Feats } from './feats';
import { loadRelics, setComplete, RELICS, RELIC_SETS, SECRET_RELICS } from '../relics/relics';

/*
 * Achievements for the modes outside the GM front office: Career Mode, League Hunt, the Rebuild Challenge, the
 * All-Time Draft, PvP, Ranked, the weekly challenges and daily goals. They are read from the records each mode already
 * keeps (plus a few feats), so progress made before they existed counts, they follow the account, and the server
 * can count them for rarity. They are trophies only: the modes already give XP for the same results.
 */

export type Mode = 'career' | 'hunt' | 'perfect' | 'rebuild' | 'draft' | 'pvp' | 'ranked' | 'weekly' | 'daily' | 'survival' | 'story' | 'relics';
export const MODE_LABELS: Record<Mode, string> = {
  career: 'Career Mode', hunt: 'League Hunt', perfect: '82-0 Challenge', rebuild: 'Rebuild Challenge', draft: 'All-Time Draft',
  pvp: 'Hunt PvP', ranked: 'Ranked', weekly: 'Weekly challenges', daily: 'Daily goals', survival: 'Survival', story: 'Story Mode', relics: 'Relics',
};

export interface ModeStats {
  retired: number; hallOfFame: number; firstBallot: number; top10: number; mvpCareers: number; mostTitles: number; mostPoints: number;
  huntWins: number; huntLegendWins: number; dailyPlayed: number; dailyWins: number; album: number;
  rebuildStars: number; rebuildTitles: number; rebuildYearOne: number; rebuildThreeStars: number;
  drafts: number; draftTop: number; draftTitles: number;
  pvpWins: number; pvpBest: number; rankedTier: number;
  weeks: number; perfectDays: number; goalStreak: number;
  /** The 82-0 Challenge. */
  p82Wins: number; p82Titles: number; p82Perfect: number; p82Perfect98: number;
  /** Category Draft. */
  catTitles: number; catTeams: number; catBrutal: number; catPerfect: number;
  /** Survival and Story Mode (their own records in this browser). */
  survivalBest: number; survivalBosses: number; storyFinished: number; storyLegend: number; storyEndings: number;
  /** The Relic Vault. */
  relicCommons: number; relicMythics: number; relicSecrets: number; relicSets: number;
}

export interface ModeAchievement { id: string; mode: Mode; name: string; description: string; icon: TrophyKey; progress: (s: ModeStats) => [number, number]; label?: (n: number, goal: number) => string }
const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];
const tierLabel = (n: number) => `Best so far: ${TIER_NAMES[n]}`;
const at = (n: number, goal: number): [number, number] => [Math.min(n, goal), goal];

export const MODE_ACHIEVEMENTS: ModeAchievement[] = [
  { id: 'career-retire', mode: 'career', name: 'Hang Them Up', description: 'Retire a created player.', icon: 'teammate', progress: s => at(s.retired, 1) },
  { id: 'career-hof', mode: 'career', name: 'Enshrined', description: 'Put a created player in the Hall of Fame.', icon: 'eoy', progress: s => at(s.hallOfFame, 1) },
  { id: 'career-first-ballot', mode: 'career', name: 'First Ballot', description: 'A first-ballot Hall of Famer (Legacy 90+).', icon: 'eoy', progress: s => at(s.firstBallot, 1) },
  { id: 'career-mvp', mode: 'career', name: 'Most Valuable', description: 'Win MVP with a created player.', icon: 'mvp', progress: s => at(s.mvpCareers, 1) },
  { id: 'career-three-rings', mode: 'career', name: 'Three Rings', description: 'Win three titles in one career.', icon: 'champion', progress: s => at(s.mostTitles, 3) },
  { id: 'career-30k', mode: 'career', name: 'Thirty Thousand', description: 'Score 30,000 points in one career.', icon: 'scoringChamp', progress: s => at(s.mostPoints, 30_000) },
  { id: 'career-top10', mode: 'career', name: 'Pantheon', description: 'Retire in the all-time Top 10.', icon: 'fmvp', progress: s => at(s.top10, 1) },

  { id: 'hunt-win', mode: 'hunt', name: 'Boss Beaten', description: 'Win a League Hunt.', icon: 'champion', progress: s => at(s.huntWins, 1) },
  { id: 'hunt-five', mode: 'hunt', name: 'Serial Hunter', description: 'Win five League Hunts.', icon: 'champion', progress: s => at(s.huntWins, 5) },
  { id: 'hunt-legend', mode: 'hunt', name: 'Legendary', description: 'Win a League Hunt on Legend difficulty.', icon: 'fmvp', progress: s => at(s.huntLegendWins, 1) },
  { id: 'hunt-daily-win', mode: 'hunt', name: 'Legend of the Day', description: 'Win a Daily Legend.', icon: 'pow', progress: s => at(s.dailyWins, 1) },
  { id: 'hunt-daily-seven', mode: 'hunt', name: 'Daily Habit', description: 'Play seven Daily Legends.', icon: 'ironMan', progress: s => at(s.dailyPlayed, 7) },
  { id: 'hunt-album-100', mode: 'hunt', name: 'Collector', description: 'Hold 100 cards in your album.', icon: 'allStar', progress: s => at(s.album, 100) },
  { id: 'hunt-album-300', mode: 'hunt', name: 'Archivist', description: 'Hold 300 cards in your album.', icon: 'allStarMvp', progress: s => at(s.album, 300) },

  { id: 'perfect-60', mode: 'perfect', name: 'Sixty Wins', description: 'Win 60 games in an 82-0 Challenge season.', icon: 'pom', progress: s => at(s.p82Wins, 60) },
  { id: 'perfect-title', mode: 'perfect', name: 'Ring Chaser', description: 'Win the title in the 82-0 Challenge.', icon: 'champion', progress: s => at(s.p82Titles, 1) },
  { id: 'perfect-74', mode: 'perfect', name: 'Better Than 73-9', description: 'Win 74 games in an 82-0 Challenge season.', icon: 'mvp', progress: s => at(s.p82Wins, 74) },
  { id: 'perfect-82', mode: 'perfect', name: 'Undefeated', description: 'Go 82-0 in the 82-0 Challenge.', icon: 'fmvp', progress: s => at(s.p82Perfect, 1) },
  { id: 'cat-5', mode: 'perfect', name: 'Category Collector', description: 'Win the title with 5 different Category Roll categories.', icon: 'champion', progress: s => at(s.catTitles, 5) },
  { id: 'cat-25', mode: 'perfect', name: 'Category Master', description: 'Win the title with 25 different categories.', icon: 'mvp', progress: s => at(s.catTitles, 25) },
  { id: 'cat-teams', mode: 'perfect', name: 'Every Franchise', description: 'Win the title with all 30 team categories.', icon: 'fmvp', progress: s => at(s.catTeams, 30) },
  { id: 'cat-brutal', mode: 'perfect', name: 'Brutal', description: 'Win the title with a D-tier category.', icon: 'hustle', progress: s => at(s.catBrutal, 1) },
  { id: 'cat-82', mode: 'perfect', name: 'Perfect Category', description: 'Go 82-0 in a Category Roll.', icon: 'eoy', progress: s => at(s.catPerfect, 1) },
  { id: 'cat-82x5', mode: 'perfect', name: 'Category King', description: 'Go 82-0 with 5 different Category Roll categories.', icon: 'mvp', progress: s => at(s.catPerfect, 5) },
  { id: 'perfect-98', mode: 'perfect', name: 'Perfection', description: 'Go 82-0, then 16-0 in the playoffs.', icon: 'eoy', progress: s => at(s.p82Perfect98, 1) },

  { id: 'survival-5', mode: 'survival', name: 'Still Standing', description: 'Win 5 rounds in one Survival run.', icon: 'ironMan', progress: s => at(s.survivalBest, 5) },
  { id: 'survival-15', mode: 'survival', name: 'Last One Standing', description: 'Win 15 rounds in one Survival run.', icon: 'mvp', progress: s => at(s.survivalBest, 15) },
  { id: 'survival-bosses', mode: 'survival', name: 'Giant Killer', description: 'Beat 5 Survival bosses (real champions).', icon: 'champion', progress: s => at(s.survivalBosses, 5) },
  { id: 'story-done', mode: 'story', name: 'Street to the League', description: 'Finish Story Mode.', icon: 'allRookie1', progress: s => at(s.storyFinished, 1) },
  { id: 'story-legend', mode: 'story', name: 'Street Legend', description: 'Reach the ending "The Legend Begins".', icon: 'roy', progress: s => at(s.storyLegend, 1) },
  { id: 'relic-collector', mode: 'relics', name: 'Collector', description: 'Own every Common relic.', icon: 'allStar', progress: s => at(s.relicCommons, RELICS.filter(r => r.rarity === 'common').length) },
  { id: 'relic-set', mode: 'relics', name: 'Set Builder', description: 'Complete a relic set.', icon: 'champion', progress: s => at(s.relicSets, 1) },
  { id: 'relic-mythic', mode: 'relics', name: 'Mythic Hunter', description: 'Find a Mythic relic.', icon: 'mvp', progress: s => at(s.relicMythics, 1) },
  { id: 'relic-secrets', mode: 'relics', name: 'Keeper of Secrets', description: 'Uncover all eight secret relics.', icon: 'fmvp', progress: s => at(s.relicSecrets, SECRET_RELICS.length) },
  { id: 'story-all', mode: 'story', name: 'Every Road', description: 'See all four Story Mode endings.', icon: 'eoy', progress: s => at(s.storyEndings, 4) },

  { id: 'rebuild-star', mode: 'rebuild', name: 'First Star', description: 'Earn a star in a Rebuild Challenge.', icon: 'mip', progress: s => at(s.rebuildStars, 1) },
  { id: 'rebuild-title', mode: 'rebuild', name: 'Rebuilt', description: 'Rebuild a team into champions.', icon: 'champion', progress: s => at(s.rebuildTitles, 1) },
  { id: 'rebuild-year-one', mode: 'rebuild', name: 'Instant Contender', description: 'Win the title in the first season of a rebuild.', icon: 'fmvp', progress: s => at(s.rebuildYearOne, 1) },
  { id: 'rebuild-architect', mode: 'rebuild', name: 'Architect', description: 'Three stars in five different rebuilds.', icon: 'eoy', progress: s => at(s.rebuildThreeStars, 5) },

  { id: 'draft-done', mode: 'draft', name: 'On the Clock', description: 'Finish an All-Time Draft and start the season.', icon: 'allRookie1', progress: s => at(s.drafts, 1) },
  { id: 'draft-top', mode: 'draft', name: 'Best Board', description: 'Leave an All-Time Draft with the strongest team on paper.', icon: 'allLeague1', progress: s => at(s.draftTop, 1) },
  { id: 'draft-title', mode: 'draft', name: 'All-Time Champions', description: 'Win a title with an All-Time Draft team.', icon: 'champion', progress: s => at(s.draftTitles, 1) },

  { id: 'pvp-win', mode: 'pvp', name: 'Ghostbuster', description: 'Win a PvP series against another GM\'s ghost.', icon: 'pom', progress: s => at(s.pvpWins, 1) },
  { id: 'pvp-ten', mode: 'pvp', name: 'Ghost Hunter', description: 'Win ten PvP series.', icon: 'pow', progress: s => at(s.pvpWins, 10) },
  { id: 'pvp-1200', mode: 'pvp', name: 'Contender', description: 'Reach a PvP rating of 1200.', icon: 'allLeague2', progress: s => at(Math.max(0, s.pvpBest - 1000), 200), label: n => `Best rating ${1000 + n} / 1200` },

  { id: 'ranked-gold', mode: 'ranked', name: 'Gold Standard', description: 'Reach Gold in a ranked season.', icon: 'allLeague3', progress: s => at(s.rankedTier, 2), label: tierLabel },
  { id: 'ranked-diamond', mode: 'ranked', name: 'Diamond Hands', description: 'Reach Diamond in a ranked season.', icon: 'allLeague1', progress: s => at(s.rankedTier, 4), label: tierLabel },
  { id: 'ranked-legend', mode: 'ranked', name: 'Legend Tier', description: 'Reach Legend in a ranked season.', icon: 'mvp', progress: s => at(s.rankedTier, 5), label: tierLabel },

  { id: 'weekly-first', mode: 'weekly', name: 'This Week\'s Challenge', description: 'Post a weekly Rebuild or Career result.', icon: 'pow', progress: s => at(s.weeks, 1) },
  { id: 'weekly-four', mode: 'weekly', name: 'Regular', description: 'Post four weekly results.', icon: 'pom', progress: s => at(s.weeks, 4) },

  { id: 'goals-all', mode: 'daily', name: 'Clean Sheet', description: 'Finish all three daily goals in one day.', icon: 'hustle', progress: s => at(s.perfectDays, 1) },
  { id: 'goals-streak', mode: 'daily', name: 'Seven Straight', description: 'Finish a daily goal seven days in a row.', icon: 'ironMan', progress: s => at(s.goalStreak, 7) },
];
export const MODE_ACHIEVEMENT_BY_ID = new Map(MODE_ACHIEVEMENTS.map(a => [a.id, a]));

const RANK_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];
const json = <T>(read: Read, key: string, fallback: T): T => { try { return (JSON.parse(read(key) ?? 'null') as T) ?? fallback; } catch { return fallback; } };

/** The longest run of consecutive UTC days (YYYY-MM-DD) in a list. */
export function longestStreak(days: string[]): number {
  const t = [...new Set(days)].map(d => Date.parse(`${d}T00:00:00Z`)).filter(Number.isFinite).sort((a, b) => a - b);
  let best = 0, run = 0;
  t.forEach((d, i) => { run = i && d - t[i - 1] === 86_400_000 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

/** Everything the mode achievements look at. `extra` lets the server add what it knows better (the ranked tier). */
export function modeStats(read: Read = localRead, extra: Feats = {}): ModeStats {
  const c = careerCache(read), hunt = loadRecords(read), feats = readFeats(read);
  const daily = Object.values(hunt.daily ?? {});
  const rebuild = Object.values(loadRebuildRecords(read));
  const legacy = readLegacy(read);
  const weeks = Object.values(loadWeeklyRecords(read)).reduce((n, w) => n + (w.rebuild ? 1 : 0) + (w.career ? 1 : 0), 0);
  const goals = json<Record<string, { done: number }>>(read, 'cv-daily-history', {});
  const rankedLocal = RANK_ORDER.indexOf(read('cv-ranked-best') ?? '');
  const p82 = loadPerfectRecords(read);
  const surv = json<{ best?: Record<string, { wins: number } | undefined>; bossesBeaten?: number }>(read, 'cv-survival-records', {});
  const story = json<{ finished?: number; tiers?: Record<string, number> }>(read, 'cv-story-endings', {});
  const relics = loadRelics(read);
  const has = (id: string) => (relics.owned[id] ?? 0) > 0;
  return {
    retired: c.retired, hallOfFame: c.hallOfFame, firstBallot: c.firstBallot ?? 0, top10: c.top10 ?? 0, mvpCareers: c.mvpCareers ?? 0, mostTitles: c.mostTitles ?? 0, mostPoints: c.mostPoints ?? 0,
    huntWins: hunt.wins, huntLegendWins: feats.huntLegendWins ?? 0, dailyPlayed: daily.length, dailyWins: daily.filter(d => d.won).length,
    album: json<string[]>(read, 'cv-hunt-album', []).length,
    rebuildStars: rebuild.reduce((n, r) => n + r.stars, 0), rebuildTitles: rebuild.filter(r => r.titleIn != null).length,
    rebuildYearOne: rebuild.filter(r => r.titleIn === 1).length, rebuildThreeStars: rebuild.filter(r => r.stars >= 3).length,
    drafts: feats.drafts ?? 0, draftTop: feats.draftTop ?? 0,
    draftTitles: Object.values(legacy.leagues).filter(l => l.kind === 'draft').reduce((n, l) => n + l.titles, 0),
    pvpWins: Math.max(feats.pvpWins ?? 0, extra.pvpWins ?? 0), pvpBest: Math.max(feats.pvpBest ?? 0, extra.pvpBest ?? 0),
    rankedTier: Math.max(feats.rankedTier ?? 0, rankedLocal, extra.rankedTier ?? 0),
    weeks, perfectDays: Object.values(goals).filter(g => g.done >= 3).length,
    goalStreak: longestStreak(Object.entries(goals).filter(([, g]) => g.done > 0).map(([d]) => d)),
    p82Wins: p82.bestWins, p82Titles: p82.titles, p82Perfect: p82.perfectSeasons, p82Perfect98: p82.perfect98,
    catTitles: categoryTitles(p82), catTeams: categoryTeamTitles(p82), catBrutal: categoryBrutal(p82), catPerfect: categoryPerfect(p82),
    survivalBest: Math.max(0, ...Object.values(surv.best ?? {}).map(b => b?.wins ?? 0)), survivalBosses: surv.bossesBeaten ?? 0,
    storyFinished: story.finished ?? 0, storyLegend: story.tiers?.legend ?? 0, storyEndings: Object.keys(story.tiers ?? {}).length,
    relicCommons: RELICS.filter(r => r.rarity === 'common' && has(r.id)).length, relicMythics: RELICS.filter(r => r.rarity === 'mythic' && has(r.id)).length,
    relicSecrets: relics.secrets.length, relicSets: RELIC_SETS.filter(st => setComplete(relics, st)).length,
  };
}

export const isEarned = (a: ModeAchievement, s: ModeStats) => { const [n, goal] = a.progress(s); return n >= goal; };
export function earnedModeAchievements(read: Read = localRead, extra: Feats = {}): string[] {
  const s = modeStats(read, extra);
  return MODE_ACHIEVEMENTS.filter(a => isEarned(a, s)).map(a => a.id);
}
