export const TABS = ["worldGames", "staff", "development", "playerDevelopment", "sandbox", "imports", "teamProfile", "database", "editor", "yourTeam", "roster", "code", "bulk", "fastEdit", "compare", "coaching", "standings", "schedule", "playoffs", "finances", "trade", "tradeBlock", "tradeOffers", "freeAgency", "draft", "allStarWeekend", "legends", "awards", "lab", "settings", "leagueSettings", "injuries", "analytics", "resignWaive", "preseason", "history", "boxscore", "dashboard", "powerRankings", "transactions", "news", "watchList", "playerStats", "teamStats", "autoPlay", "dailySchedule", "hallOfFame", "teamHistory", "records", "almanac", "nbaArchive", "gmOffice", "summerLeague", "cup", "deadline", "yearInReview", "press", "medical", "extensions", "threeTeam", "summerCamp", "storylines", "travel", "cards", "gmRivals", "timeline", "ownerBox", "historyBook"] as const;
export type Tab = typeof TABS[number];
export interface GameRoute { saveId: string; tab: Tab; player?: string; team?: string; game?: string; sub?: 'awards' | 'rules'; source?: 'league' | 'exhibition' }
export function parseRoute(hash: string): GameRoute | null {
  try {
    const [path, query] = hash.split('?');
    const parts = path.split('/');
    if (parts.length !== 4 || parts[0] !== '#' || parts[1] !== 'league' || !parts[2]) return null;
    const tab = parts[3] as Tab;
    if (!TABS.includes(tab)) return null;
    const params = new URLSearchParams(query);
    return { saveId: decodeURIComponent(parts[2]), tab,
      ...(tab === 'teamProfile' && params.get('team') ? { team: params.get('team')! } : {}),
      ...((tab === 'editor' || tab === 'playerDevelopment') && params.get('player') ? { player: params.get('player')! } : {}),
      ...(tab === 'boxscore' ? { game: params.get('game') ?? undefined, source: params.get('source') === 'exhibition' ? 'exhibition' : 'league' } : {}),
      ...(tab === 'leagueSettings' ? { sub: params.get('sub') === 'rules' ? 'rules' : 'awards' } : {}) };
  } catch { return null; }
}
export function routeHash(route: GameRoute): string {
  const params = new URLSearchParams();
  if (route.tab === 'teamProfile' && route.team) params.set('team', route.team);
  if ((route.tab === 'editor' || route.tab === 'playerDevelopment') && route.player) params.set('player', route.player);
  if (route.tab === 'boxscore') {
    if (route.game) params.set('game', route.game);
    if (route.source === 'exhibition') params.set('source', 'exhibition');
  }
  if (route.tab === 'leagueSettings') params.set('sub', route.sub ?? 'awards');
  return `#/league/${encodeURIComponent(route.saveId)}/${route.tab}${params.size ? '?' + params : ''}`;
}
/** Analytics receives page categories, never local save IDs or player/game details. */
export function analyticsPath(hash: string): string {
  if (hash.startsWith('#/privacy')) return '/privacy';
  if (hash === '#/choose-team') return '/choose-team';
  if (hash === '#/community') return '/community';
  if (hash === '#/friends') return '/friends';
  if (hash.startsWith('#/u/')) return '/profile'; // never the username
  if (hash === '#/profile') return '/my-profile';
  if (hash === '#/settings') return '/settings';
  const route = parseRoute(hash);
  return route ? `/game/${route.tab}` : '/menu';
}
