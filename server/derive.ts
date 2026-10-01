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
import { SYNC_KEYS, type ProgressBlob, type CodeResult } from '../src/cloud/merge';
import { seasonOf, dailyLegendPoints, weeklyRebuildPoints, weeklyCareerPoints, dailyGoalPoints, tierFor } from '../src/cloud/ranked';
import type { CareerMeta } from '../src/career/career';
import { careerResume } from '../src/career/career';
import { AVATAR_CATEGORIES, DEFAULT_AVATAR, cleanAvatar, type AvatarLook } from '../src/profile/avatar';
import { avatarFrameDef } from '../src/profile/avatarFrames';
import { encodeAvatar } from '../src/profile/avatarCode';

/*
 * Turns a player's synced progress into their public rows: profile level and stats, achievements, created players,
 * weekly and Daily Legend results, Rebuild records, league-code results and ranked events. Everything is checked
 * here and anything implausible is dropped: the browser's copy is never trusted as-is.
 */

export interface Derived {
  profile: { level: number; xp: number; stats: Record<string, unknown> };
  achievements: string[];
  players: Record<string, unknown>[];
  weekly: { board: 'rebuild' | 'career' | 'hunt' | 'perfect'; week: string; score: number; detail: string }[];
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
  for (const k of SYNC_KEYS) { const v = b.storage[k]; if (typeof v === 'string' && v.length < 400_000) storage[k] = v; }
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
  const careerCache: CareerXpCache = { ...careerCacheOf(counted), careers: blob.careers.length, retired: players.length, legacy: legacySum, hallOfFame: hof };
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
  for (const [week, d] of Object.entries(perfectWeeks(loadPerfectRecords(read)))) {
    if (!/^\d{4}-W\d{2}$/.test(week) || week < FIRST_WEEK || week > thisWeek || !int(d.score, 0, 30_000) || !int(d.w, 0, 82) || !int(d.l, 0, 82) || d.w + d.l > 82 || !int(d.pw, 0, 16) || !int(d.pl, 0, 12)) continue;
    weekly.push({ board: 'perfect', week, score: d.score, detail: `${d.w}-${d.l}${d.pw + d.pl ? ` · playoffs ${d.pw}-${d.pl}` : ''}${d.champion ? ' · champions' : ''}` });
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
      codes.push({ code: code.toUpperCase().slice(0, 40), team: typeof c.team === 'string' ? c.team.slice(0, 12) : null, wins: c.wins, losses: c.losses, finish: c.finish, score: c.wins * 2 + (FINISH_POINTS[c.finish as keyof typeof FINISH_POINTS] ?? 0) });
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
    careers: players.length, hallOfFame: hof, bestPlayer: best, xpParts: Object.fromEntries(parts.map(p => [p.id, p.xp])),
    summary: `${plural(gm.titles, 'title')} · ${plural(hof, 'Hall of Famer')} · ${plural(hunt.wins, 'hunt')} won`,
  };
  // Mode achievements count for rarity too, as mode-<id>.
  const modes = earnedModeAchievements(readWithCareers, { rankedTier: TIERS.findIndex(t => t.id === stats.rankedBest) }).map(id => `mode-${id}`);
  return { profile: { level: levelFor(xp).level, xp, stats: { ...stats, modeAchievements: modes.length } }, achievements: [...Object.keys(legacy.achievements).filter(a => /^[\w-]{1,40}$/.test(a)).slice(0, 200), ...modes],
    players, weekly, daily, rebuild, codes, ranked };
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
  for (const c of owner ? [] : AVATAR_CATEGORIES) {
    const r = c.items.find(i => i.id === look[c.id])?.rule;
    if (r && (('honor' in r && !honors.includes(r.honor)) || ('level' in r && r.level > level))) look = { ...look, [c.id]: DEFAULT_AVATAR[c.id] };
  }
  let frame: string | undefined;
  try { frame = (JSON.parse(read('cv-profile-equip') ?? '{}') as { avatarFrame?: string }).avatarFrame; } catch { /* none */ }
  const f = avatarFrameDef(frame);
  const modes = f.modes ? earnedModeAchievements(read) : [];
  const ok = owner || (f.modes ? f.modes.some(m => modes.includes(m)) : f.honors ? f.honors.some(h => honors.includes(h)) : f.level != null ? level >= f.level : true);
  return encodeAvatar(look, ok ? f.id : 'none');
}
