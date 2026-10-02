import type { NbaHistory } from '../history/nbaHistoryData';
import { allFacts, isNotable, type PlayerFacts } from './facts';

/*
 * The NBA Quiz: rounds of multiple-choice questions written from real NBA history (titles, MVPs, Finals MVPs, Rookies
 * of the Year, No. 1 picks, scoring champions and career numbers). A new random round every time, from any era or one.
 */

export type QuizEra = 'all' | 'classic' | 'modern' | 'now';
export const QUIZ_ERAS: { id: QuizEra; label: string; from: number; to: number }[] = [
  { id: 'all', label: 'All eras', from: 1960, to: 9999 },
  { id: 'classic', label: '1960-1989', from: 1960, to: 1989 },
  { id: 'modern', label: '1990-2009', from: 1990, to: 2009 },
  { id: 'now', label: '2010 to now', from: 2010, to: 9999 },
];
export const QUIZ_LENGTH = 10;

export interface QuizQuestion { kind: string; text: string; options: string[]; answer: number; fact: string }

const seasonLabel = (s: number) => `${s - 1}-${String(s).slice(2)}`;

interface QuizData {
  facts: PlayerFacts[]; byIdx: Map<number, PlayerFacts>; nameOf: (idx: number) => string;
  teamName: (abbr: string, season: number) => string;
  champions: NbaHistory['champions']; awards: NbaHistory['awards'];
  firstPicks: { year: number; name: string; others: string[] }[];
  scoring: { season: number; leader: string; ppg: number; others: string[] }[];
}
const cache = new WeakMap<NbaHistory, QuizData>();

function data(h: NbaHistory): QuizData {
  const hit = cache.get(h);
  if (hit) return hit;
  const facts = allFacts(h), byIdx = new Map(facts.map(f => [f.idx, f]));
  const names = new Map(h.players.map(p => [p.idx, p.displayName]));
  const teamNames = new Map(h.teams.map(t => [`${t.abbr}@${t.season}`, t.name]));
  const firstPicks: QuizData['firstPicks'] = [];
  const byYear = new Map<number, typeof h.drafts>();
  for (const d of h.drafts) if (d.league === 'NBA' && d.pick != null && d.pick <= 5) { const l = byYear.get(d.year) ?? []; l.push(d); byYear.set(d.year, l); }
  for (const [year, picks] of byYear) {
    const first = picks.find(p => p.pick === 1), others = picks.filter(p => p.pick !== 1).map(p => p.name);
    if (first && others.length >= 3) firstPicks.push({ year, name: first.name, others });
  }
  // Each season's scoring champion (points per game, 58+ games or 1,400+ points as the NBA used to require).
  const scoring: QuizData['scoring'] = [];
  const bySeason = new Map<number, { name: string; ppg: number }[]>();
  for (const r of h.seasons) {
    if (r.league !== 'NBA') continue;
    const traded = (h.seasonsByPlayer.get(r.player) ?? []).some(x => x.season === r.season && x.isAggregate);
    if (traded !== r.isAggregate) continue;
    const g = r.stats.g ?? 0, pts = r.stats.pts ?? 0;
    if (!g || (g < 58 && pts < 1400)) continue;
    const l = bySeason.get(r.season) ?? []; l.push({ name: names.get(r.player) ?? '?', ppg: pts / g }); bySeason.set(r.season, l);
  }
  for (const [season, list] of bySeason) {
    list.sort((a, b) => b.ppg - a.ppg);
    if (list.length >= 4 && list[0].ppg - list[1].ppg >= 0.05) scoring.push({ season, leader: list[0].name, ppg: list[0].ppg, others: list.slice(1, 8).map(x => x.name) });
  }
  const out: QuizData = {
    facts, byIdx, nameOf: idx => names.get(idx) ?? '?', teamName: (abbr, season) => teamNames.get(`${abbr}@${season}`) ?? abbr,
    champions: h.champions, awards: h.awards, firstPicks, scoring,
  };
  cache.set(h, out);
  return out;
}

const pick = <T,>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)];
function shuffle<T>(list: T[], rand: () => number): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Four different options with the answer among them, or null when there aren't three distinct wrong ones. */
function options(answer: string, wrong: string[], rand: () => number): { options: string[]; answer: number } | null {
  const others = shuffle([...new Set(wrong.filter(w => w !== answer))], rand).slice(0, 3);
  if (others.length < 3) return null;
  const opts = shuffle([answer, ...others], rand);
  return { options: opts, answer: opts.indexOf(answer) };
}

type Maker = (d: QuizData, era: { from: number; to: number }, rand: () => number) => QuizQuestion | null;
const inEra = (s: number, era: { from: number; to: number }) => s >= era.from && s <= era.to;

const MAKERS: Maker[] = [
  // Champions
  (d, era, rand) => {
    const c = pick(d.champions.filter(x => inEra(x.season, era)), rand);
    if (!c) return null;
    const rivals = d.champions.filter(x => Math.abs(x.season - c.season) <= 6 && x.champion !== c.champion).map(x => d.teamName(x.champion, x.season));
    const o = options(d.teamName(c.champion, c.season), [d.teamName(c.runnerUp, c.season), ...rivals], rand);
    return o && { kind: 'champion', text: `Who won the ${seasonLabel(c.season)} NBA title?`, ...o, fact: `${d.teamName(c.champion, c.season)} beat ${d.teamName(c.runnerUp, c.season)} ${c.result} in the Finals.` };
  },
  // Finals MVP
  (d, era, rand) => {
    const c = pick(d.champions.filter(x => inEra(x.season, era) && x.finalsMvp != null), rand);
    if (!c) return null;
    const mvp = d.nameOf(c.finalsMvp!);
    const team = c.rosterCredit.filter(p => p !== c.finalsMvp).map(p => d.byIdx.get(p)).filter((f): f is PlayerFacts => !!f).sort((a, b) => b.points - a.points).map(f => f.name);
    const o = options(mvp, team.slice(0, 6), rand);
    return o && { kind: 'finalsMvp', text: `Who was the Finals MVP for the ${seasonLabel(c.season)} ${d.teamName(c.champion, c.season)}?`, ...o, fact: `${mvp} was Finals MVP as ${d.teamName(c.champion, c.season)} won ${c.result}.` };
  },
  // Season awards: MVP and Rookie of the Year, with that year's other vote-getters as the wrong answers.
  ...(['mvp', 'roy', 'dpoy'] as const).map((award): Maker => (d, era, rand) => {
    const label = award === 'mvp' ? 'MVP' : award === 'roy' ? 'Rookie of the Year' : 'Defensive Player of the Year';
    const won = d.awards.filter(a => a.award === award && a.winner && inEra(a.season, era));
    const w = pick(won, rand);
    if (!w) return null;
    const votes = d.awards.filter(a => a.award === award && a.season === w.season && !a.winner).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).map(a => d.nameOf(a.player));
    const o = options(d.nameOf(w.player), votes, rand);
    return o && { kind: award, text: `Who was the ${seasonLabel(w.season)} ${label}?`, ...o, fact: `${d.nameOf(w.player)} won it${votes[0] ? `, ahead of ${votes[0]}` : ''}.` };
  }),
  // No. 1 picks
  (d, era, rand) => {
    const p = pick(d.firstPicks.filter(x => inEra(x.year, era)), rand);
    if (!p) return null;
    const o = options(p.name, p.others, rand);
    return o && { kind: 'draft', text: `Who was the No. 1 pick in the ${p.year} NBA draft?`, ...o, fact: `${p.name} went first; ${p.others[0]} went second.` };
  },
  // Scoring champions
  (d, era, rand) => {
    const s = pick(d.scoring.filter(x => inEra(x.season, era)), rand);
    if (!s) return null;
    const o = options(s.leader, s.others, rand);
    return o && { kind: 'scoring', text: `Who led the NBA in points per game in ${seasonLabel(s.season)}?`, ...o, fact: `${s.leader} averaged ${s.ppg.toFixed(1)} points a game.` };
  },
  // Career numbers of well-known players
  (d, era, rand) => {
    const pool = d.facts.filter(f => isNotable(f) && inEra(f.debut, era));
    const four = shuffle(pool, rand).slice(0, 4);
    if (four.length < 4) return null;
    const stat = pick(['ppg', 'rpg', 'apg'] as const, rand), word = stat === 'ppg' ? 'points' : stat === 'rpg' ? 'rebounds' : 'assists';
    const best = [...four].sort((a, b) => b[stat] - a[stat]);
    if (best[0][stat] === best[1][stat]) return null;
    const opts = four.map(f => f.name);
    return { kind: 'career', text: `Who averaged the most ${word} per game over his career?`, options: opts, answer: opts.indexOf(best[0].name), fact: four.map(f => `${f.name} ${f[stat].toFixed(1)}`).join(' · ') };
  },
  (d, era, rand) => {
    const f = pick(d.facts.filter(x => isNotable(x) && inEra(x.debut, era)), rand);
    if (!f) return null;
    const teams = [...new Set(d.facts.filter(x => x.franchise !== f.franchise).map(x => x.team))];
    const o = options(f.team, shuffle(teams, rand).slice(0, 8), rand);
    return o && { kind: 'team', text: `Which team did ${f.name} play the most games for?`, ...o, fact: `${f.name}: ${f.games.toLocaleString()} games, ${f.debut}-${f.last}.` };
  },
  (d, era, rand) => {
    const f = pick(d.facts.filter(x => isNotable(x) && inEra(x.debut, era)), rand);
    if (!f) return null;
    const near = [-4, -3, -2, -1, 1, 2, 3, 4].map(n => seasonLabel(f.debut + n));
    const o = options(seasonLabel(f.debut), near, rand);
    return o && { kind: 'debut', text: `In which season did ${f.name} play his first NBA game?`, ...o, fact: `${f.name} played from ${seasonLabel(f.debut)} to ${seasonLabel(f.last)}.` };
  },
  (d, era, rand) => {
    const f = pick(d.facts.filter(x => isNotable(x) && x.allStars >= 4 && inEra(x.debut, era)), rand);
    if (!f) return null;
    const near = [-3, -2, -1, 1, 2, 3, 4].map(n => f.allStars + n).filter(n => n >= 1).map(String);
    const o = options(String(f.allStars), near, rand);
    return o && { kind: 'allStars', text: `How many times was ${f.name} an NBA All-Star?`, ...o, fact: `${f.name}: ${f.allStars} All-Star selections${f.rings ? `, ${f.rings} title${f.rings > 1 ? 's' : ''}` : ''}.` };
  },
];

/** A round of questions: varied kinds, no question asked twice. */
export function quizRound(h: NbaHistory, eraId: QuizEra, rand: () => number, length = QUIZ_LENGTH): QuizQuestion[] {
  const d = data(h), era = QUIZ_ERAS.find(e => e.id === eraId) ?? QUIZ_ERAS[0];
  const out: QuizQuestion[] = [], asked = new Set<string>(), kinds = new Map<string, number>();
  for (let tries = 0; out.length < length && tries < length * 40; tries++) {
    const q = pick(MAKERS, rand)(d, era, rand);
    if (!q || asked.has(q.text) || (kinds.get(q.kind) ?? 0) >= 3) continue;
    asked.add(q.text); kinds.set(q.kind, (kinds.get(q.kind) ?? 0) + 1);
    out.push(q);
  }
  return out;
}

/** Points for an answer: 100 for a right one, plus up to 50 for answering quickly (within 15 seconds). */
export const quizPoints = (right: boolean, ms: number) => (right ? 100 + Math.max(0, Math.round(50 * (1 - ms / 15_000))) : 0);
