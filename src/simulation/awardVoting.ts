/* Award voting: a media panel casts ranked ballots, and the award goes to whoever the panel puts first.
 *
 * Every voter sees the same formula scores, but weighs the storylines (team success, voter fatigue)
 * differently and reads the numbers with a little personal noise. A runaway leader stays close to
 * unanimous; a tight race splits first-place votes, and an exact tie in points produces co-winners.
 * Everything is seeded from the season and award, so the same league always votes the same way. */

export type Position3 = 'G' | 'F' | 'C';

/** Per-game line shown on the "why he won" card, saved with the vote so old seasons keep it. */
export interface StatSnapshot {
  gp: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  ws?: number; dws?: number;
  /** The player's team record when the votes were cast. */
  w: number; l: number;
}

export interface VoteLine {
  /** Player id, or team id for team awards. */
  id: string;
  teamId: string | null;
  teamName: string;
  points: number;
  firstVotes: number;
  /** Votes received at each ballot place (index 0 = first place, or 1st team for team selections). */
  places: number[];
  /** Points as a share of a unanimous result (0–1). */
  share: number;
  /** The formula score voters were looking at. */
  score: number;
  position?: Position3;
  stats?: StatSnapshot;
}

export interface AwardVote {
  voters: number;
  /** Points per ballot place, e.g. [10, 7, 5, 3, 1]. */
  pointsByPlace: number[];
  /** Everyone who received a vote, most points first. */
  lines: VoteLine[];
  /** Everyone tied for the most points; more than one means co-winners. */
  winners: string[];
  /** Short, evidence-based reasons the winner won. */
  notes?: string[];
  /** Team selections (All-League, All-Defense, All-Rookie): ids per team, 1st team first. */
  teams?: string[][];
}

export interface VoteCandidate {
  id: string;
  teamId: string | null;
  teamName: string;
  score: number;
  /** -1…1: how strongly the storyline favors him (team success, a breakout, a comeback). */
  story?: number;
  /** 0…1: last year's winner — some voters want someone new. */
  fatigue?: number;
  position?: Position3;
}

export interface PanelOptions {
  voters: number;
  points: number[];
  /** Candidates considered (the leaders by score). */
  field?: number;
  /** Average weight a voter gives the storyline, in standard deviations of the field. */
  storyWeight?: number;
  /** How differently voters read the numbers, in standard deviations of the field. */
  noise?: number;
  /** False when voter `v` may not vote for candidate `c` (executives can't vote for their own team). */
  canVote?: (v: number, c: VoteCandidate) => boolean;
}

function hash32(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

/** A small seeded generator (mulberry32). */
export function seededRandom(key: string): () => number {
  let a = hash32(key) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Field scores as standard scores, so the noise means the same thing for every award's scale. */
function standardize(field: VoteCandidate[]): number[] {
  const n = field.length;
  const mean = field.reduce((s, c) => s + c.score, 0) / n;
  const sd = Math.sqrt(field.reduce((s, c) => s + (c.score - mean) ** 2, 0) / n);
  const floor = Math.max(sd, Math.abs(mean) * 0.05, 1e-6);
  return field.map((c) => (c.score - mean) / floor);
}

function rankLines(lines: VoteLine[]): VoteLine[] {
  return lines.sort((a, b) => b.points - a.points || b.firstVotes - a.firstVotes || b.score - a.score || a.id.localeCompare(b.id));
}

function topField(candidates: VoteCandidate[], size: number): VoteCandidate[] {
  return [...candidates].filter((c) => Number.isFinite(c.score)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, size);
}

/** Perceived scores for one voter: the numbers, his read of the storyline, and a little noise. */
function perceive(field: VoteCandidate[], z: number[], rng: () => number, storyWeight: number, noise: number): number[] {
  const storyW = storyWeight * (0.3 + rng() * 1.4);
  const fatigueW = rng() < 0.55 ? 0.15 + rng() * 0.4 : 0;
  return field.map((c, i) => z[i] + storyW * (c.story ?? 0) - fatigueW * (c.fatigue ?? 0) + gaussian(rng) * noise);
}

/** Ranked single-winner ballot (MVP 10-7-5-3-1, most others 5-3-1). */
export function panelVote(seedKey: string, candidates: VoteCandidate[], opts: PanelOptions): AwardVote {
  const field = topField(candidates, opts.field ?? 15);
  const places = opts.points.length;
  const empty: AwardVote = { voters: opts.voters, pointsByPlace: opts.points, lines: [], winners: [] };
  if (!field.length) return empty;
  const z = standardize(field);
  const tally = field.map((c) => ({ c, points: 0, places: new Array<number>(places).fill(0) }));
  for (let v = 0; v < opts.voters; v++) {
    const rng = seededRandom(`${seedKey}|voter${v}`);
    const seen = perceive(field, z, rng, opts.storyWeight ?? 0, opts.noise ?? 0.35);
    const order = field.map((_, i) => i).filter((i) => !opts.canVote || opts.canVote(v, field[i])).sort((a, b) => seen[b] - seen[a]);
    order.slice(0, places).forEach((i, place) => { tally[i].points += opts.points[place]; tally[i].places[place]++; });
  }
  const max = opts.voters * opts.points[0];
  const lines = rankLines(tally.filter((t) => t.points > 0).map((t) => ({
    id: t.c.id, teamId: t.c.teamId, teamName: t.c.teamName, points: t.points, firstVotes: t.places[0], places: t.places,
    share: Math.round((t.points / max) * 1000) / 1000, score: Math.round(t.c.score * 10) / 10, ...(t.c.position ? { position: t.c.position } : {}),
  })));
  const top = lines[0]?.points ?? 0;
  return { voters: opts.voters, pointsByPlace: opts.points, lines, winners: lines.filter((l) => l.points === top).map((l) => l.id) };
}

export type SlotPlan = Partial<Record<Position3 | 'any', number>>;

/** Fill `teams` teams from ranked ids: each position's slots first, then any open spot from whoever's left. */
function assemble(ranked: VoteCandidate[], slots: SlotPlan, teams: number): string[][] {
  const out: string[][] = [];
  const used = new Set<string>();
  const perTeam = Object.values(slots).reduce((s, n) => s + (n ?? 0), 0);
  for (let t = 0; t < teams; t++) {
    const team: string[] = [];
    for (const pos of ['G', 'F', 'C', 'any'] as const) {
      const need = slots[pos] ?? 0;
      const pick = ranked.filter((c) => !used.has(c.id) && (pos === 'any' || c.position === pos)).slice(0, need);
      for (const c of pick) { used.add(c.id); team.push(c.id); }
    }
    // A thin position (a league with few centers) doesn't leave a hole: the next best player fills it.
    for (const c of ranked) { if (team.length >= perTeam) break; if (!used.has(c.id)) { used.add(c.id); team.push(c.id); } }
    out.push(team);
  }
  return out;
}

/**
 * Team selections (All-League, All-Defense, All-Rookie). Each voter fills every team by position
 * (e.g. 2 guards, 2 forwards, 1 center); a 1st-team spot is worth the most points. The final teams
 * are the leaders in points at each position.
 */
export function selectionVote(seedKey: string, candidates: VoteCandidate[], opts: PanelOptions & { slots: SlotPlan; teams: number }): AwardVote {
  const perTeam = Object.values(opts.slots).reduce((s, n) => s + (n ?? 0), 0);
  const field = topField(candidates, opts.field ?? Math.max(perTeam * opts.teams * 2, 20));
  const empty: AwardVote = { voters: opts.voters, pointsByPlace: opts.points, lines: [], winners: [], teams: [] };
  if (!field.length) return empty;
  const z = standardize(field);
  const tally = field.map((c) => ({ c, points: 0, places: new Array<number>(opts.teams).fill(0) }));
  const index = new Map(field.map((c, i) => [c.id, i]));
  for (let v = 0; v < opts.voters; v++) {
    const rng = seededRandom(`${seedKey}|voter${v}`);
    const seen = perceive(field, z, rng, opts.storyWeight ?? 0, opts.noise ?? 0.35);
    const ranked = field.map((c, i) => ({ c, s: seen[i] })).sort((a, b) => b.s - a.s).map((x) => x.c);
    assemble(ranked, opts.slots, opts.teams).forEach((team, t) => {
      for (const id of team) { const row = tally[index.get(id)!]; row.points += opts.points[t] ?? 0; row.places[t]++; }
    });
  }
  const max = opts.voters * opts.points[0];
  const lines = rankLines(tally.filter((t) => t.points > 0).map((t) => ({
    id: t.c.id, teamId: t.c.teamId, teamName: t.c.teamName, points: t.points, firstVotes: t.places[0], places: t.places,
    share: Math.round((t.points / max) * 1000) / 1000, score: Math.round(t.c.score * 10) / 10, ...(t.c.position ? { position: t.c.position } : {}),
  })));
  const byId = new Map(field.map((c) => [c.id, c]));
  const teams = assemble(lines.map((l) => byId.get(l.id)!), opts.slots, opts.teams).filter((t) => t.length > 0);
  const top = lines[0]?.points ?? 0;
  return { voters: opts.voters, pointsByPlace: opts.points, lines, winners: lines.filter((l) => l.points === top).map((l) => l.id), teams };
}
