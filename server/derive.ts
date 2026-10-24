import { objectRead } from '../src/lib/kv';
import { cleanName } from '../src/lib/names';
import { xpParts, totalXp, levelFor, careerCacheOf, type CareerXpCache } from '../src/profile/profile';
import { earnedModeAchievements } from '../src/profile/modeAchievements';
import { TIERS } from '../src/cloud/ranked';
import { readLegacy, legacyTotals } from '../src/storage/gmLegacy';
import { loadRecords, huntScore } from '../src/hunt/storage';
import { loadPerfectRecords, perfectWeeks } from '../src/perfect/storage';
import { loadRebuildRecords } from '../src/simulation/rebuildChallenge';
import { SCENARIOS, scoreResults, FINISH_POINTS, type ScoredSeason } from '../src/simulation/rebuildScenarios';
import { loadWeeklyRecords, weeklyRebuild } from '../src/retention/weekly';
import { weekKey } from '../src/retention/week';
import { decodeLeagueCode } from '../src/retention/leagueCode';
import { codeScore } from '../src/retention/codeResults';
import { SYNC_KEYS, type ProgressBlob, type CodeResult } from '../src/cloud/merge';
import { seasonOf, dailyLegendPoints, weeklyRebuildPoints, weeklyCareerPoints, dailyGoalPoints, tierFor } from '../src/cloud/ranked';
import type { CareerMeta } from '../src/career/career';
import { careerResume } from '../src/career/career';
import { loadMyRatings } from '../src/profile/myRatings';
import { AVATAR_CATEGORIES, DEFAULT_AVATAR, cleanAvatar, type AvatarLook } from '../src/profile/avatar';
import { avatarFrameDef } from '../src/profile/avatarFrames';
import { encodeAvatar } from '../src/profile/avatarCode';
import { shopOwned } from '../src/relics/shopOwned';
import { readArcade, guessWeeks, BRACKET_MAX, GUESS_TRIES } from '../src/arcade/storage';
import { loadRelics, RELIC_BY_ID, RARITY_ORDER } from '../src/relics/relics';
import { unlockContext, earnedExtraTitles } from '../src/profile/cosmetics';
import { TITLES, rankTitles } from '../src/profile/profile';
import { readStreak } from '../src/retention/streak';
import { readPlayTime, topArea, AREA_LABEL } from '../src/retention/playTime';
import { readActivity } from '../src/retention/activity';
import { readPublicProfile } from '../src/profile/publicProfile';
import { ACHIEVEMENT_BY_ID } from '../src/simulation/frontOffice';
import { MODE_ACHIEVEMENT_BY_ID } from '../src/profile/modeAchievements';
import { isClean } from '../src/lib/names';

/*
 * Turns a player's synced progress into their public rows: profile level and stats, achievements, created players,
 * weekly and Daily Legend results, Rebuild records, league-code results and ranked events. Everything is checked
 * here and anything implausible is dropped: the browser's copy is never trusted as-is.
 */

export type WeeklyBoard = 'rebuild' | 'career' | 'hunt' | 'perfect' | 'category' | 'guess' | 'hilo' | 'bracket';
/** The quick games' boards (added later: a database without them yet keeps the others). */
export const ARCADE_BOARDS: readonly WeeklyBoard[] = ['guess', 'hilo', 'bracket'];

export interface Derived {
  profile: { level: number; xp: number; stats: Record<string, unknown> };
  achievements: string[];
  players: Record<string, unknown>[];
  weekly: { board: WeeklyBoard; week: string; score: number; detail: string }[];
  daily: { day: string; won: boolean; stop: number; wins: number; losses: number; score: number }[];
  rebuild: { scenario: string; best: number; stars: number; title_in: number | null }[];
  codes: { code: string; team: string | null; wins: number; losses: number; finish: string; score: number }[];
  ranked: { event: string; season: string; points: number }[];
}

const FIRST_WEEK = '2026-W39';
const FIRST_DAY = '2026-01-01';
const int = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const FINISHES = new Set<string>([...Object.keys(FINISH_POINTS), 'Missed Playoffs']);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const mondayOf = (week: string) => { const [y, w] = week.split('-W').map(Number); const jan4 = new Date(Date.UTC(y, 0, 4)); const d = (jan4.getUTCDay() || 7) - 1; return new Date(Date.UTC(y, 0, 4 - d + (w - 1) * 7)).toISOString().slice(0, 10); };

export function sanitizeBlob(raw: unknown): ProgressBlob | null {
  const b = raw as ProgressBlob;
  if (!b || b.version !== 1 || typeof b.storage !== 'object' || !Array.isArray(b.careers)) return null;
  const storage: Record<string, string> = {};
  for (const k of SYNC_KEYS) { const v = b.storage[k]; if (typeof v === 'string' && v.length < 2_000_000) storage[k] = v; }
  return { version: 1, updatedAt: Number(b.updatedAt) || Date.now(), storage, careers: b.careers.filter(c => c && typeof c === 'object').slice(0, 500) };
}

export function derive(blob: ProgressBlob, now = new Date()): Derived {
  const read = objectRead(blob.storage);
  const today = now.toISOString().slice(0, 10), thisWeek = weekKey(now);

  // Retired careers: the created-player board and the Career part of XP.
  const players: Derived['players'] = [];
  let legacySum = 0, hof = 0, best: { name: string; legacy: number } | null = null;
  const counted: CareerMeta[] = [];
  for (const m of blob.careers as CareerMeta[]) {
    const r = m.retired, name = cleanName(m.playerId);
    if (m.status !== 'retired' || !r || !name || !int(Math.round(r.legacy), 0, 400) || !Array.isArray(m.years) || !int(m.years.length, 1, 25)) continue;
    // Create Anything careers (every rating chosen freely) count for nothing.
    if (m.mode === 'sandbox') continue;
    // Rookie careers (the easy setting) and Your Player careers (your own player, simmed) count for your XP but stay
    // off the Legacy board.
    if (m.difficulty === 'rookie' || m.mode === 'yourplayer') { counted.push(m); continue; }
    const res = careerResume(m), legacy = Math.round(r.legacy), g = Math.max(1, res.games);
    if (res.titles > m.years.length || res.mvp > m.years.length || res.games > 30 * 110) continue;
    const hall = ['yes', 'first-ballot'].includes(r.hallOfFame) ? r.hallOfFame : 'no';
    players.push({ career_id: String(m.id).slice(0, 60), name, legacy, rank: int(r.rank, 1, 100) ? r.rank : null, seasons: m.years.length, titles: res.titles, mvps: res.mvp, all_stars: res.allStar,
      hall_of_fame: hall, draft_year: int(m.draftYear, 1946, 2100) ? m.draftYear : null, weekly: typeof m.weekly === 'string' && /^\d{4}-W\d{2}$/.test(m.weekly) ? m.weekly : null,
      ppg: +(res.pts / g).toFixed(1), rpg: +(res.reb / g).toFixed(1), apg: +(res.ast / g).toFixed(1), points: res.pts, retired_at: new Date(m.updatedAt || now).toISOString() });
    legacySum += legacy; if (hall !== 'no') hof++;
    counted.push(m);
    if (!best || legacy > best.legacy) best = { name, legacy };
  }
  const careerCache: CareerXpCache = { ...careerCacheOf(counted), careers: (blob.careers as CareerMeta[]).filter(c => c && c.mode !== 'sandbox').length, retired: players.length, legacy: legacySum, hallOfFame: hof };
  const readWithCareers = (k: string) => (k === 'cv-profile-careers' ? JSON.stringify(careerCache) : read(k));

  // Weekly results.
  const weekly: Derived['weekly'] = [], ranked: Derived['ranked'] = [];
  for (const [week, w] of Object.entries(loadWeeklyRecords(read))) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek) continue;
    const season = seasonOf(mondayOf(week));
    if (w.rebuild) {
      const cfg = weeklyRebuild(week);
      const results = (w.rebuild.results ?? []) as ScoredSeason[];
      const ok = results.length > 0 && results.length <= cfg.seasons && results.every(x => x && int(x.wins, 0, 82) && int(x.losses, 0, 82) && x.wins + x.losses >= 20 && x.wins + x.losses <= 82 && FINISHES.has(x.finish));
      if (ok) {
        const s = scoreResults(results, cfg.seasons);
        if (s.titleAt >= 0 || results.length === cfg.seasons) {
          const bestRec = [...s.counted].sort((a, b) => b.wins - a.wins)[0];
          weekly.push({ board: 'rebuild', week, score: s.score, detail: `${cfg.scenario.title} · ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)} · ${s.titleAt >= 0 ? `title in year ${s.titleAt + 1}` : `best ${bestRec.wins}-${bestRec.losses}`}` });
          ranked.push({ event: `wr:${week}`, season, points: weeklyRebuildPoints(s.stars, s.titleAt >= 0) });
        }
      }
    }
    if (w.career && int(Math.round(w.career.best), 0, 400)) {
      const legacy = Math.round(w.career.best);
      const label = cleanName(w.career.label) ?? 'A created player';
      weekly.push({ board: 'career', week, score: legacy, detail: `${label} · Legacy ${legacy}` });
      ranked.push({ event: `wc:${week}`, season, points: weeklyCareerPoints(legacy) });
    }
  }

  // Daily Legend and the Weekly Hunt.
  const hunt = loadRecords(read);
  for (const [week, w] of Object.entries(hunt.weekly ?? {})) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !w || !int(w.stop, 0, 10) || !int(w.wins, 0, 70) || !int(w.losses, 0, 70)) continue;
    const won = !!w.won && w.wins >= 40;
    weekly.push({ board: 'hunt', week, score: huntScore({ ...w, won }), detail: won ? `Beat the boss · ${w.wins}-${w.losses} in games` : `Reached series ${w.stop + 1} · ${w.wins}-${w.losses}` });
  }
  // The Daily 82-0: your best day of each week.
  const p82 = loadPerfectRecords(read);
  for (const [week, d] of Object.entries(perfectWeeks(p82))) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !int(d.score, 0, 60_000) || !int(d.w, 0, 82) || !int(d.l, 0, 82) || d.w + d.l > 82 || !int(d.pw, 0, 16) || !int(d.pl, 0, 12)) continue;
    weekly.push({ board: 'perfect', week, score: d.score, detail: `${d.w}-${d.l}${d.pw + d.pl ? ` · playoffs ${d.pw}-${d.pl}` : ''}${d.champion ? ' · champions' : ''}` });
  }
  // The Weekly Category Challenge: your best try each week (Category Draft scores run higher: tiers pay up to ×1.75).
  for (const [week, d] of Object.entries(p82.weekCat ?? {})) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !d || !int(d.score, 0, 60_000) || !int(d.w, 0, 82) || !int(d.l, 0, 82) || d.w + d.l > 82 || !int(d.pw, 0, 16) || !int(d.pl, 0, 12)) continue;
    weekly.push({ board: 'category', week, score: d.score, detail: `${d.w}-${d.l}${d.pw + d.pl ? ` · playoffs ${d.pw}-${d.pl}` : ''}${d.champion ? ' · champions' : ''}` });
  }
  // The quick games: Guess the Player (the week's days), Higher or Lower (best streak), the Bracket Challenge.
  const arcade = readArcade(read);
  for (const [week, g] of Object.entries(guessWeeks({ ...arcade, guess: Object.fromEntries(Object.entries(arcade.guess).filter(([day, d]) => day >= FIRST_DAY && day <= today && Array.isArray(d?.guesses) && d.guesses.length >= 1 && d.guesses.length <= GUESS_TRIES)) }))) {
    if (week < FIRST_WEEK || week > thisWeek || !int(g.score, 0, 7 * 600) || g.score === 0) continue;
    weekly.push({ board: 'guess', week, score: g.score, detail: `${plural(g.solved, 'day')} solved of ${g.days}` });
  }
  for (const [week, best] of Object.entries(arcade.hilo.weeks)) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !int(best, 1, 1000)) continue;
    weekly.push({ board: 'hilo', week, score: best, detail: `Streak of ${best}` });
  }
  for (const [week, b] of Object.entries(arcade.bracket)) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !b?.played || !int(b.score, 0, BRACKET_MAX) || b.score % 10) continue;
    weekly.push({ board: 'bracket', week, score: b.score, detail: `${b.score}/${BRACKET_MAX}${typeof b.champion === 'string' ? ` · champion ${b.champion.split('@')[0].slice(0, 6)} ${b.champion.split('@')[1]?.slice(0, 4) ?? ''}` : ''}` });
  }
  const daily: Derived['daily'] = [];
  for (const [day, d] of Object.entries(hunt.daily ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST_DAY || day > today || !d || !int(d.stop, 0, 10) || !int(d.wins, 0, 40) || !int(d.losses, 0, 40)) continue;
    const won = !!d.won;
    daily.push({ day, won, stop: d.stop, wins: d.wins, losses: d.losses, score: won ? 1000 + (d.wins - d.losses) * 10 : d.stop * 100 + d.wins * 2 });
    ranked.push({ event: `dl:${day}`, season: seasonOf(day), points: dailyLegendPoints(won, d.stop) });
  }

  // Daily goals (ranked only).
  try {
    const hist = JSON.parse(read('cv-daily-history') ?? '{}') as Record<string, { done: number }>;
    for (const [day, h] of Object.entries(hist)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= FIRST_DAY && day <= today && int(h?.done, 1, 3)) ranked.push({ event: `dg:${day}`, season: seasonOf(day), points: dailyGoalPoints(h.done) });
  } catch { /* none */ }

  // Rebuild records.
  const rebuild: Derived['rebuild'] = [];
  for (const [id, r] of Object.entries(loadRebuildRecords(read))) {
    const sc = SCENARIOS.find(s => s.id === id);
    const cap = sc ? 1000 + sc.seasons * (250 + 82 * 2 + 200) : 0;
    if (!sc || !r || !int(r.best, 0, cap) || !int(r.stars, 0, 3)) continue;
    rebuild.push({ scenario: id, best: r.best, stars: r.stars, title_in: int(r.titleIn, 1, sc.seasons) ? r.titleIn : null });
  }

  // League codes: the first season of each.
  const codes: Derived['codes'] = [];
  try {
    for (const [code, c] of Object.entries(JSON.parse(read('cv-code-results') ?? '{}') as Record<string, CodeResult>)) {
      try { decodeLeagueCode(code); } catch { continue; }
      if (!c || !int(c.wins, 0, 82) || !int(c.losses, 0, 82) || c.wins + c.losses < 20 || c.wins + c.losses > 82 || !FINISHES.has(c.finish)) continue;
      codes.push({ code: code.toUpperCase().slice(0, 40), team: typeof c.team === 'string' ? c.team.slice(0, 12) : null, wins: c.wins, losses: c.losses, finish: c.finish, score: codeScore(c) });
    }
  } catch { /* none */ }

  // Profile.
  const parts = xpParts(readWithCareers), xp = totalXp(parts);
  const legacy = readLegacy(read), gm = legacyTotals(legacy);
  const bySeason: Record<string, number> = {};
  for (const e of ranked) bySeason[e.season] = (bySeason[e.season] ?? 0) + e.points;
  const rankedBest = Object.values(bySeason).reduce((b, p) => (tierFor(p).tier.min > tierFor(b).tier.min ? p : b), 0);
  const stats = {
    ranked: bySeason, rankedBest: tierFor(rankedBest).tier.id,
    seasons: gm.seasons, wins: gm.wins, titles: gm.titles, achievements: gm.achievements,
    huntRuns: hunt.runs, huntWins: hunt.wins, huntBest: int(hunt.bestStop, 0, 10) ? hunt.bestStop : 0, dailyWins: daily.filter(d => d.won).length,
    rebuildStars: rebuild.reduce((n, r) => n + r.stars, 0), rebuildTitles: rebuild.filter(r => r.title_in != null).length,
    careers: players.length, hallOfFame: hof, bestPlayer: best, ...playTime(read, now), xpParts: Object.fromEntries(parts.map(p => [p.id, p.xp])),
    summary: `${plural(gm.titles, 'title')} · ${plural(hof, 'Hall of Famer')} · ${plural(hunt.wins, 'hunt')} won`,
    relicShelf: relicShelf(read), showcase: showcase(read, levelFor(xp).level, hunt.wins),
    // Your Player (the Closet ratings), kept within the points this level has earned: others play 1v1 against it.
    myPlayer: (({ skills, height }) => ({ skills, height }))(loadMyRatings(levelFor(xp).level, read)),
  };
  // Mode achievements count for rarity too, as mode-<id>.
  const earnedModes = earnedModeAchievements(readWithCareers, { rankedTier: TIERS.findIndex(t => t.id === stats.rankedBest) });
  const modes = earnedModes.map(id => `mode-${id}`);
  const extras = publicExtras(read, levelFor(xp).level, Object.keys(legacy.achievements), earnedModes);
  return { profile: { level: levelFor(xp).level, xp, stats: { ...stats, ...extras, modeAchievements: modes.length } }, achievements: [...Object.keys(legacy.achievements).filter(a => /^[\w-]{1,40}$/.test(a)).slice(0, 200), ...modes],
    players, weekly, daily, rebuild, codes, ranked };
}

/**
 * What the player picked for the public profile (src/profile/publicProfile.ts), each piece checked: the featured trophy
 * must be earned, the bio clean; plus the last five things finished and time played by mode.
 */
function publicExtras(read: (k: string) => string | null, level: number, gmAchievements: string[], modeAchievements: string[]) {
  const pick = readPublicProfile(read);
  let featured: { kind: 'title' | 'achievement'; name: string; detail?: string } | null = null;
  const [kind, id] = [pick.featured?.split(':')[0], pick.featured?.slice(pick.featured.indexOf(':') + 1) ?? ''];
  if (kind === 'title' && new Set([...TITLES.filter(t => t.level <= level).map(t => t.name), ...rankTitles(read), ...earnedExtraTitles(unlockContext(level, read))]).has(id)) featured = { kind: 'title', name: id };
  else if (kind === 'ach' && gmAchievements.includes(id) && ACHIEVEMENT_BY_ID.has(id)) featured = { kind: 'achievement', name: ACHIEVEMENT_BY_ID.get(id)!.name, detail: ACHIEVEMENT_BY_ID.get(id)!.description };
  else if (kind === 'mode' && modeAchievements.includes(id) && MODE_ACHIEVEMENT_BY_ID.has(id)) featured = { kind: 'achievement', name: MODE_ACHIEVEMENT_BY_ID.get(id)!.name, detail: MODE_ACHIEVEMENT_BY_ID.get(id)!.description };
  const activity = readActivity(read).filter(a => isClean(a.line) && !/[<>]/.test(a.line)).slice(0, 5).map(a => ({ at: a.at, kind: a.kind.slice(0, 20), line: a.line.slice(0, 120) }));
  const areas = readPlayTime(read).areas;
  const playAreas = Object.fromEntries(Object.entries(areas).filter(([k, v]) => k in AREA_LABEL && Number.isFinite(v) && (v ?? 0) >= 60).map(([k, v]) => [k, Math.floor(v!)]));
  return { featured, bio: pick.bio ?? null, banner: pick.banner ?? 'none', activity, playAreas };
}

/** Time played for the profile and the Time played board: never more than the time since the game's first day. */
function playTime(read: (k: string) => string | null, now: Date): { playSeconds: number; playTop: string | null } {
  const t = readPlayTime(read);
  const cap = Math.max(0, Math.floor((now.getTime() - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / 1000));
  return { playSeconds: Math.min(cap, Math.floor(t.total)), playTop: topArea(t) };
}

/** The relic museum on a public profile: up to six relics you own, rarest first, and how many secrets. */
function relicShelf(read: (k: string) => string | null): { ids: string[]; secrets: number } {
  const s = loadRelics(read);
  const ids = Object.keys(s.owned).filter(id => (s.owned[id] ?? 0) > 0 && RELIC_BY_ID.has(id))
    .sort((a, b) => RARITY_ORDER.indexOf(RELIC_BY_ID.get(b)!.rarity) - RARITY_ORDER.indexOf(RELIC_BY_ID.get(a)!.rarity) || a.localeCompare(b)).slice(0, 6);
  return { ids, secrets: s.secrets.length };
}
/** The first three things on your trophy shelf that the server can check (titles you've earned, runs from your records). */
function showcase(read: (k: string) => string | null, level: number, huntWins: number): string[] {
  let shelf: string[] = [];
  try { const v = JSON.parse(read('cv-trophy-case') ?? '[]') as unknown; if (Array.isArray(v)) shelf = v.filter((x): x is string => typeof x === 'string'); } catch { /* none */ }
  const titles = new Set([...TITLES.filter(t => t.level <= level).map(t => t.name), ...earnedExtraTitles(unlockContext(level, read))]);
  const perfect = loadPerfectRecords(read), streak = readStreak(read);
  const out: string[] = [];
  for (const id of shelf) {
    if (out.length >= 3) break;
    if (id.startsWith('title:') && titles.has(id.slice(6))) out.push(id.slice(6));
    else if (id === 'run:hunt' && huntWins > 0) out.push(`${huntWins} League Hunt win${huntWins === 1 ? '' : 's'}`);
    else if (id === 'run:perfect' && perfect.titles > 0) out.push(`${perfect.titles} 82-0 title${perfect.titles === 1 ? '' : 's'}`);
    else if (id === 'run:streak' && streak.best >= 3) out.push(`${streak.best}-day streak`);
  }
  return out;
}

/**
 * Your character for the boards, as a look code (src/profile/avatarCode.ts). Pieces and frames won on the
 * leaderboards need the honor, and level pieces the level; anything else that isn't earned falls back to the default.
 */
/** `owner`: the game owner's account (profiles.role), with everything open, keeps every piece. */
export function publicAvatar(blob: ProgressBlob, level: number, honors: string[], owner = false): string | null {
  const read = objectRead(blob.storage);
  const raw = read('cv-avatar');
  if (!raw) return null;
  let look: AvatarLook;
  try { look = cleanAvatar(JSON.parse(raw) as Partial<AvatarLook>); } catch { return null; }
  const bought = shopOwned(read);
  for (const c of owner ? [] : AVATAR_CATEGORIES) {
    const r = c.items.find(i => i.id === look[c.id])?.rule;
    if (r && ('staff' in r || ('honor' in r && !honors.includes(r.honor)) || ('level' in r && r.level > level) || ('shop' in r && !bought.includes(r.shop)))) look = { ...look, [c.id]: DEFAULT_AVATAR[c.id] };
  }
  let frame: string | undefined;
  try { frame = (JSON.parse(read('cv-profile-equip') ?? '{}') as { avatarFrame?: string }).avatarFrame; } catch { /* none */ }
  const f = avatarFrameDef(frame);
  const modes = f.modes ? earnedModeAchievements(read) : [];
  const hours = playTime(read, new Date()).playSeconds / 3600;
  const ok = owner || (f.staff ? false : f.account ? true : f.hours != null ? hours >= f.hours : f.modes ? f.modes.some(m => modes.includes(m)) : f.honors ? f.honors.some(h => honors.includes(h)) : f.level != null ? level >= f.level : true);
  return encodeAvatar(look, ok ? f.id : 'none');
}
