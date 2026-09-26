import type { PlayerSeason } from './types';
import type { DraftProspect } from './gm';
import { calculateOverall } from './engine/overall';
import { prospectComparison } from './draftScouting';

/* A draft prospect's pre-draft season: college for most Americans, a pro club at home for most internationals.
 * The line is derived from the prospect's true ratings with a little deterministic noise, so it is a real (if
 * noisy) window into the player — box scores flatter some prospects and hide others, as in real scouting.
 * Nothing is stored: the same prospect always had the same season, and older saves get one automatically. */

export interface CollegeSeason {
  team: string;
  level: 'college' | 'pro';
  /** "Freshman" … "Senior" in college; "Pro" overseas. */
  year: string;
  circuit: string;
  totalGames: number;
  gp: number; mpg: number; ppg: number; rpg: number; apg: number; spg: number; bpg: number;
  fgPct: number; tpPct: number; tpaPg: number; ftPct: number;
}

function hashUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

const CLUB_CITIES: Record<string, string[]> = {
  Serbia: ['Belgrade', 'Novi Sad', 'Niš'], Spain: ['Madrid', 'Barcelona', 'Valencia', 'Málaga'], France: ['Lyon', 'Paris', 'Monaco', 'Strasbourg'],
  Greece: ['Athens', 'Piraeus', 'Thessaloniki'], Lithuania: ['Kaunas', 'Vilnius'], Turkey: ['Istanbul', 'Ankara', 'Izmir'], Slovenia: ['Ljubljana', 'Koper'],
  Croatia: ['Zagreb', 'Split'], Germany: ['Munich', 'Berlin', 'Ulm', 'Bamberg'], Australia: ['Sydney', 'Melbourne', 'Perth'], Argentina: ['Buenos Aires', 'Córdoba'],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Franca'], Japan: ['Tokyo', 'Osaka', 'Chiba'], Nigeria: ['Lagos', 'Abuja'], Canada: ['Toronto', 'Montreal'],
};
const CIRCUITS: Record<string, string> = {
  Serbia: 'Adriatic League', Slovenia: 'Adriatic League', Croatia: 'Adriatic League', Spain: 'Spanish League', France: 'French League', Greece: 'Greek League',
  Lithuania: 'Lithuanian League', Turkey: 'Turkish League', Germany: 'German League', Australia: 'Australian League', Argentina: 'Argentine League',
  Brazil: 'Brazilian League', Japan: 'Japanese League', Nigeria: 'African League', Canada: 'Canadian League',
};
const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

export function collegeSeason(p: PlayerSeason): CollegeSeason {
  const n = (k: string) => hashUnit(`${p.playerId}|college|${k}`);
  const c = prospectComparison(p);
  const ovr = calculateOverall(p);
  const o = p.attributes.offense;
  const college = !!p.college;
  const country = p.nationality ?? 'USA';
  // Overseas pros play fewer minutes against grown men: their lines look smaller than their talent.
  const scale = college ? 1 : 0.72;
  const totalGames = college ? 32 + Math.round((n('g') + 1) * 3) : 30 + Math.round((n('g') + 1) * 4);
  const gp = clamp(Math.round(totalGames - Math.max(0, (60 - p.attributes.physical.durability) / 8) - (n('miss') + 1) * 1.5), 12, totalGames);
  const mpg = clamp(20 + (ovr - 40) * 0.55 + n('m') * 3, 14, 36) * (college ? 1 : 0.85);
  const scoring = (c.Shooting + c.Finishing + c.Athleticism) / 3;
  const ppg = clamp(4 + (scoring - 40) * 0.42 + (ovr - 45) * 0.38 + n('p') * 3, 3, 30) * scale;
  const rpg = clamp(2 + (c.Rebounding - 40) * 0.17 + (c.Height - 76) * 0.42 + n('r') * 1.2, 1.2, 14.5) * scale;
  const apg = clamp(0.8 + (c.Playmaking - 40) * 0.15 + n('a') * 0.9, 0.3, 9.5) * scale;
  const spg = clamp(0.4 + (c.Defense - 40) * 0.022 + (c.Athleticism - 50) * 0.012 + n('s') * 0.3, 0.1, 3) * scale;
  const bpg = clamp(0.15 + (c.Height - 78) * 0.13 + (c.Defense - 45) * 0.015 + n('b') * 0.3, 0, 4.2) * scale;
  const tpaPg = clamp(0.5 + (o.threePoint - 35) * 0.11 + n('ta') * 0.8, 0, 9) * scale;
  const tpPct = clamp(0.27 + (o.threePoint - 40) * 0.0032 + n('t') * 0.035, 0.18, 0.46);
  const fgPct = clamp(0.41 + (c.Finishing - 50) * 0.0022 + (c.Height - 78) * 0.004 - tpaPg * 0.004 + n('f') * 0.03, 0.35, 0.66);
  const ftPct = clamp(0.62 + (o.freeThrow - 40) * 0.0045 + n('ft') * 0.04, 0.45, 0.93);
  const cities = CLUB_CITIES[country] ?? ['Capital'];
  const team = college ? p.college! : `${cities[Math.floor((n('club') + 1) / 2 * cities.length) % cities.length]} BC`;
  return {
    team, level: college ? 'college' : 'pro', year: college ? YEARS[clamp(p.age - 19, 0, 3)] : 'Pro',
    circuit: college ? 'NCAA Division I' : `${CIRCUITS[country] ?? `${country} League`}`,
    totalGames, gp, mpg: r1(mpg), ppg: r1(ppg), rpg: r1(rpg), apg: r1(apg), spg: r1(spg), bpg: r1(bpg),
    fgPct: r3(fgPct), tpPct: r3(tpPct), tpaPg: r1(tpaPg), ftPct: r3(ftPct),
  };
}

/** The season so far: games played follow the league calendar (0 = preseason, 1 = season over). Averages are the final ones. */
export function collegeSeasonToDate(season: CollegeSeason, progress: number): CollegeSeason {
  const played = Math.round(season.gp * clamp(progress, 0, 1));
  return { ...season, gp: played };
}

/** Honors voted across the whole class: All-American teams and statistical leaders, college players only. */
export function classHonors(prospects: DraftProspect[]): Map<string, string[]> {
  const lines = prospects.map(p => ({ id: p.playerId, s: collegeSeason(p.trueSeason), ovr: calculateOverall(p.trueSeason) }));
  const out = new Map<string, string[]>(lines.map(l => [l.id, []]));
  const college = lines.filter(l => l.s.level === 'college');
  const byValue = [...college].sort((a, b) => (b.s.ppg + b.s.rpg * 0.8 + b.s.apg * 1.1 + b.ovr * 0.3) - (a.s.ppg + a.s.rpg * 0.8 + a.s.apg * 1.1 + a.ovr * 0.3));
  byValue.slice(0, 5).forEach((l, i) => out.get(l.id)!.push(i === 0 ? 'National Player of the Year' : 'All-American 1st Team'));
  byValue.slice(5, 10).forEach(l => out.get(l.id)!.push('All-American 2nd Team'));
  const leader = (key: 'ppg' | 'rpg' | 'apg' | 'bpg', label: string) => {
    const top = [...college].sort((a, b) => b.s[key] - a.s[key])[0];
    if (top) out.get(top.id)!.push(label);
  };
  leader('ppg', 'Nation’s leading scorer'); leader('rpg', 'Nation’s leading rebounder'); leader('apg', 'Nation’s assist leader'); leader('bpg', 'Nation’s shot-blocking leader');
  const freshmen = college.filter(l => l.s.year === 'Freshman').sort((a, b) => b.ovr - a.ovr);
  if (freshmen[0]) out.get(freshmen[0].id)!.push('Freshman of the Year');
  return out;
}
