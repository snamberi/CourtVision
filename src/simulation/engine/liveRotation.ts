import type { PlayerSeason } from '../types';
import type { CoachTendencies } from '../league';
import type { LeagueRulesSettings } from '../leagueRules';
import type { PlayerStatLine } from '../boxscore';
import type { FatigueState } from './fatigue';
import { RNG } from './rng';
import { superFactor, athleticismOf } from './superstar';

/** A clock-based rotation. Targets are a coach's plan; EXACT budgets are protected when feasible. */
export class LiveRotation {
  readonly seconds: Record<string, number> = {};
  private quarterSeconds: Record<string, number> = {};
  private stint: Record<string, number> = {};
  private targets: Record<string, number> = {};
  private lineup: string[] = [];
  private lastReview = -999;
  private benchDeadline = Infinity;
  private quarter = -1;
  private starters: string[];
  private depth: number;
  private roster: PlayerSeason[];
  private totalSeconds: number;
  private coach: CoachTendencies;
  private opponent: PlayerSeason[];
  private rules: LeagueRulesSettings | undefined;
  /** Whether anyone has an EXACT minutes budget. Without one, the budget checks below always pass, so they are skipped. */
  private hasExact: boolean;
  /** Athleticism past 99 (superstar.ts): 0 for everyone else; at 1 (110) he plays the whole game. */
  private motor: Record<string, number> = {};
  constructor(roster: PlayerSeason[], totalSeconds: number, coach: CoachTendencies,
    rules: LeagueRulesSettings | undefined, rng: RNG, order: string[] = [], playoffs = false, opponent: PlayerSeason[] = []) {
    this.opponent = opponent; this.roster = roster; this.totalSeconds = totalSeconds; this.coach = coach; this.rules = rules;
    this.hasExact = roster.some(s => s.minutes.mode === 'EXACT');
    const sorted = [...roster].sort((a, b) => {
      const rank = (s: PlayerSeason) => coach.rotationPolicy?.starters.includes(s.playerId) ? -200 : s.rotationRole === 'starter' ? -100 : s.rotationRole === 'bench' ? 100 : 0;
      const index = (s: PlayerSeason) => order.includes(s.playerId) ? order.indexOf(s.playerId) : 30 - s.minutes.target;
      return rank(a) - rank(b) || index(a) - index(b);
    });
    this.starters = sorted.slice(0, 5).map(s => s.playerId);
    this.depth = Math.max(5, Math.min(roster.length, coach.rotationPolicy?.mode==='playoff' && playoffs ? Math.min(8,coach.rotationDepth??8) : coach.rotationDepth ?? 10));
    for (const s of sorted) {
      this.seconds[s.playerId] = 0;
      this.stint[s.playerId] = 0;
      const isStarter = this.starters.includes(s.playerId);
      const explicit = s.minutes.mode !== 'AI';
      const inRotation = sorted.indexOf(s) < this.depth || explicit;
      const spread = (rules?.minutesVariance ?? 50) / 100;
      const variation = s.minutes.mode === 'EXACT' ? 1 : 1 + (rng.next() - 0.5) * 0.24 * spread;
      const usage = explicit ? 1 : isStarter ? 1 + (coach.starUsage - 50) / 250 : 1 + (coach.benchUsage - 50) / 150;
      this.targets[s.playerId] = inRotation ? Math.max(0, s.minutes.target * 60 * variation * usage) : 0;
      // Athleticism past 99: he wants more of the game, all of it at 110 (an explicit minutes plan still wins).
      const motor = superFactor(athleticismOf(s.attributes));
      this.motor[s.playerId] = motor;
      if (motor > 0 && !explicit && this.targets[s.playerId] > 0) this.targets[s.playerId] += (totalSeconds - this.targets[s.playerId]) * Math.sqrt(Math.min(1, motor));
    }
    // Scale flexible budgets to the available five-player clock. Water-fill caps at a full game.
    const exact = sorted.filter(s => s.minutes.mode === 'EXACT');
    let remaining = Math.min(5, roster.length) * totalSeconds - exact.reduce((n, s) => n + Math.min(totalSeconds, this.targets[s.playerId]), 0);
    // Iron men (athleticism 110+) keep their full game before everyone else shares what is left.
    const iron = sorted.filter(s => s.minutes.mode !== 'EXACT' && (this.motor[s.playerId] ?? 0) >= 1 && this.targets[s.playerId] > 0);
    for (const s of iron) { this.targets[s.playerId] = totalSeconds; remaining -= totalSeconds; }
    let flexible = sorted.filter(s => s.minutes.mode !== 'EXACT' && this.targets[s.playerId] > 0 && !iron.includes(s));
    while (flexible.length) {
      const sum = flexible.reduce((n, s) => n + this.targets[s.playerId], 0);
      const capped = flexible.filter(s => this.targets[s.playerId] / sum * remaining > totalSeconds);
      if (!capped.length) {
        for (const s of flexible) this.targets[s.playerId] = Math.max(0, this.targets[s.playerId] / sum * remaining);
        break;
      }
      for (const s of capped) { this.targets[s.playerId] = totalSeconds; remaining -= totalSeconds; }
      flexible = flexible.filter(s => !capped.includes(s));
    }
  }
  private exactRemaining(s: PlayerSeason, q: number, qSeconds: number): number {
    if (s.minutes.mode !== 'EXACT') return Infinity;
    if (q * qSeconds >= this.totalSeconds) return Infinity; // overtime is a separate allocation
    const periodBudget = s.minutes.perQuarter?.[q];
    return Math.min(this.targets[s.playerId] - this.seconds[s.playerId], periodBudget == null ? Infinity : periodBudget * 60 - (this.quarterSeconds[s.playerId] ?? 0));
  }
  private pinned: { ids: string[]; quarter: number } | null = null;
  /** A coach's hand-picked five stays on the floor for the rest of this period (or until someone fouls out or is hurt). */
  pin(ids: string[], quarter: number) {
    const unique = [...new Set(ids)].filter(id => this.roster.some(s => s.playerId === id));
    this.pinned = unique.length === 5 ? { ids: unique, quarter } : null;
  }
  choose(q: number, clock: number, qSeconds: number, elapsed: number, margin: number,
    unavailable: Set<string>, stats: Record<string, PlayerStatLine>, fatigue: Record<string, FatigueState>): string[] {
    const freshQuarter = q !== this.quarter;
    if (freshQuarter) { this.quarter = q; this.quarterSeconds = {}; this.stint = {}; this.lastReview = -999; }
    const foulLimit = this.rules?.personalFoulLimit ?? 6;
    const available = this.roster.filter(s => !unavailable.has(s.playerId) && stats[s.playerId].pf < foulLimit);
    if (this.pinned && (this.pinned.quarter !== q || !this.pinned.ids.every(id => available.some(s => s.playerId === id)))) this.pinned = null;
    if (this.pinned) {
      for (const id of this.pinned.ids) if (!this.lineup.includes(id)) this.stint[id] = 0;
      this.lineup = [...this.pinned.ids];
      this.lastReview = elapsed;
      this.benchDeadline = Infinity;
      return [...this.lineup];
    }
    const eligible = this.hasExact ? available.filter(s => this.exactRemaining(s, q, qSeconds) > 0) : available;
    // Impossible or injury-depleted plans use available players to keep the game playable.
    const pool = eligible.length >= Math.min(5, available.length) ? eligible : available;
    const periodLeft = (s: PlayerSeason) => s.minutes.perQuarter?.[q] != null ? clock : Math.max(0, this.totalSeconds - elapsed);
    const updateDeadline = (ids: string[]) => {
      if (!this.hasExact) { this.benchDeadline = Infinity; return; }
      this.benchDeadline = Math.min(Infinity, ...pool.filter(s => s.minutes.mode === 'EXACT' && !ids.includes(s.playerId)).map(s => periodLeft(s) - this.exactRemaining(s, q, qSeconds)).filter(n => Number.isFinite(n) && n > 0));
    };
    const urgent = this.hasExact && pool.some(s => s.minutes.mode === 'EXACT' && !this.lineup.includes(s.playerId) && this.exactRemaining(s, q, qSeconds) >= periodLeft(s));
    const forced = urgent || this.lineup.some(id => !pool.some(s => s.playerId === id));
    if (!freshQuarter && !forced && elapsed - this.lastReview < 35) { updateDeadline(this.lineup); return [...this.lineup]; }
    this.lastReview = elapsed;
    const left = Math.max(1, this.totalSeconds - elapsed);
    const clutch = left < 240 && Math.abs(margin) <= 10;
    const garbage = left < 360 && Math.abs(margin) >= (this.rules?.blowoutBenchThreshold ?? 22);
    const stintLimit = (this.coach.stintLengthMinutes ?? this.rules?.rotationStintMinutes ?? 5) * 60;
    const score = (s: PlayerSeason) => {
      const id = s.playerId;
      const target = this.targets[id];
      const played = this.seconds[id];
      const playing = this.lineup.includes(id);
      const stint = this.stint[id] ?? 0;
      const starter = this.starters.includes(id);
      const desired = target * Math.min(1, (elapsed + stintLimit) / this.totalSeconds);
      let value = (desired - played) / 100 + target / this.totalSeconds;
      if (q === 0 && elapsed === 0 && starter) value += 100;
      if (playing && stint < stintLimit) value += 1.1;
      const motor = Math.min(1, this.motor[id] ?? 0);
      if (playing && stint > stintLimit) value -= (stint - stintLimit) / 100 * (1 - motor);
      if (this.coach.rotationPolicy?.allowOverrides !== false) value -= (fatigue[id]?.level ?? 0) * 2 * (1 - motor);
      if (clutch) value += starter ? this.coach.starUsage / 35 : 0;
      const policy=this.coach.rotationPolicy;
      if (clutch && policy?.closing.includes(id)) value += 7;
      if (clutch && margin>0 && policy?.defensive.includes(id)) value += 3;
      if (clutch && margin<0 && policy?.smallBall.includes(id)) value += 3;
      if (policy?.backupHandler===id && !pool.some(p=>p.playerId!==id&&this.starters.includes(p.playerId)&&p.ballHandlerPriority>70)) value+=1.5;
      if (policy?.mode==='development' && s.age<=24 && s.minutes.mode==='AI' && !clutch) value+=.7;
      if (policy?.mode==='matchup') { const perimeter=this.opponent.reduce((n,p)=>n+p.attributes.offense.threePoint-p.attributes.offense.postControl,0)>=0; value+=((perimeter?s.attributes.defense.perimeterDefense+s.attributes.physical.agility:s.attributes.defense.interiorDefense+s.attributes.physical.strength)-120)/120; }
      if (garbage) value += (starter ? -6 : 4) * (1 - motor);
      if (this.coach.rotationPolicy?.allowOverrides !== false && stats[id].pf >= Math.min(foulLimit - 1, q + 2) && left > 360) value -= 4 * (1 - motor);
      if (s.minutes.mode === 'EXACT') {
        const budgetLeft = this.exactRemaining(s, q, qSeconds);
        const periodLeft = s.minutes.perQuarter?.[q] != null ? clock : left;
        if (budgetLeft >= periodLeft) value += 100; // must play now to satisfy the budget
        value += 0.6;
      }
      if (s.minutes.max != null && played >= s.minutes.max * 60) value -= 10;
      if (s.minutes.min != null && left <= s.minutes.min * 60 - played) value += 20;
      if (target <= 0 && !garbage) value -= 50;
      return value;
    };
    // Score each player once instead of on every comparison; the order is identical.
    const scores = new Map(pool.map(s => [s, score(s)]));
    const next = [...pool].sort((a, b) => scores.get(b)! - scores.get(a)!).slice(0, 5).map(s => s.playerId);
    for (const id of next) if (!this.lineup.includes(id)) this.stint[id] = 0;
    this.lineup = next;
    updateDeadline(next);
    return [...next];
  }
  limitDuration(ids: string[], q: number, qSeconds: number): number {
    if (!this.hasExact) return Math.max(1, this.benchDeadline);
    const limits = this.roster.filter(s => ids.includes(s.playerId)).map(s => this.exactRemaining(s, q, qSeconds)).filter(n => n > 0);
    return Math.max(1, Math.min(this.benchDeadline, ...limits));
  }
  credit(ids: string[], duration: number) {
    for (const id of ids) {
      this.seconds[id] += duration;
      this.quarterSeconds[id] = (this.quarterSeconds[id] ?? 0) + duration;
      this.stint[id] = (this.stint[id] ?? 0) + duration;
    }
  }
}
