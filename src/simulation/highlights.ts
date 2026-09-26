import type { GameResult, PossessionLogEntry, TopPlay } from './boxscore';
import { playbackForEntry } from './gamePlayback';

export type HighlightKind = 'gameWinner' | 'goAhead' | 'clutchThree' | 'dunk' | 'block' | 'andOne' | 'stealScore' | 'leadChange' | 'deepThree';
export interface Highlight {
  index: number; kind: HighlightKind; score: number; playerId: string; teamId: string;
  quarter: number; clockSeconds: number; homeScoreAfter: number; awayScoreAfter: number; text: string;
}
export const HIGHLIGHT_LABEL: Record<HighlightKind, string> = {
  gameWinner: 'Game-winner', goAhead: 'Go-ahead', clutchThree: 'Clutch three', dunk: 'Dunk', block: 'Block',
  andOne: 'And-one', stealScore: 'Steal & score', leadChange: 'Lead change', deepThree: 'Three',
};
const THREES = ['corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot3', 'stepback'];
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Scores the memorable possessions of a recorded game. Pure and deterministic: derived only from the log. */
export function detectHighlights(log: PossessionLogEntry[], regulationPeriods = 4): Highlight[] {
  const out: Highlight[] = [];
  const finalMargin = log.length ? log[log.length - 1].homeScoreAfter - log[log.length - 1].awayScoreAfter : 0;
  const winner = sign(finalMargin);
  // The last possession that put the eventual winner ahead for good.
  let decider = -1;
  for (let i = 0; i < log.length; i++) {
    const before = i ? log[i - 1].homeScoreAfter - log[i - 1].awayScoreAfter : 0;
    const after = log[i].homeScoreAfter - log[i].awayScoreAfter;
    if (sign(after) === winner && sign(before) !== winner) decider = i;
  }
  for (let i = 0; i < log.length; i++) {
    const e = log[i], p = playbackForEntry(e), prev = log[i - 1];
    const before = prev ? prev.homeScoreAfter - prev.awayScoreAfter : 0;
    const after = e.homeScoreAfter - e.awayScoreAfter;
    const scored = (e.homeScoreAfter + e.awayScoreAfter) - (prev ? prev.homeScoreAfter + prev.awayScoreAfter : 0);
    const endClock = Math.max(0, e.clockSeconds - (e.durationSeconds ?? 0));
    const late = e.quarter > regulationPeriods || (e.quarter === regulationPeriods && endClock <= 120);
    const close = Math.abs(before) <= 6;
    const three = THREES.includes(p.shotType ?? '');
    const shooter = p.shooterId ?? e.ballHandlerId;
    const who = (id: string | undefined) => id ?? e.ballHandlerId;
    const candidates: Omit<Highlight, 'index' | 'quarter' | 'clockSeconds' | 'homeScoreAfter' | 'awayScoreAfter'>[] = [];
    const add = (kind: HighlightKind, score: number, playerId: string, text: string) => candidates.push({ kind, score, playerId, teamId: e.offenseTeamId, text });
    if (scored > 0 && i === decider && late && winner !== 0) {
      add('gameWinner', 10, shooter, `${shooter} ${three ? 'buries the game-winning three' : p.shotType === 'dunk' ? 'slams home the game-winner' : e.result === 'FOUL' ? 'hits the game-winning free throws' : 'scores the game-winner'}`);
    } else if (scored > 0 && sign(after) !== sign(before) && sign(after) !== 0) {
      if (late && close) add('goAhead', 7, shooter, `${shooter} puts them ahead late${three ? ' from deep' : ''}`);
      else if (sign(before) !== 0) add('leadChange', 2 + (e.quarter >= regulationPeriods ? 1.5 : 0), shooter, `${shooter} flips the lead`);
    }
    if (p.shotMade && three && late && close) add('clutchThree', 7, shooter, `${shooter} drills a clutch three`);
    if (p.shotMade && p.shotType === 'dunk') add('dunk', 5 + (late && close ? 1.5 : 0) - (Math.abs(before) >= 20 ? 1.5 : 0), shooter, `${shooter} throws down a thunderous dunk`);
    if (p.blockerId) add('block', 3 + (late && close ? 2.5 : 0), p.blockerId, `${p.blockerId} sends it into the stands`);
    if (p.shotMade && (e.result === 'AND1' || e.events.some(ev => ev.includes(' AND-1 (made')))) add('andOne', 5, shooter, `${shooter} scores through contact — and one`);
    if (prev?.result === 'TURNOVER' && playbackForEntry(prev).stealerId && p.shotMade && prev.offenseTeamId !== e.offenseTeamId)
      add('stealScore', 5, who(playbackForEntry(prev).stealerId), `${playbackForEntry(prev).stealerId} picks it off and ${shooter} finishes`);
    if (p.shotMade && three && !late) add('deepThree', 1.5, shooter, `${shooter} knocks down a three`);
    if (!candidates.length) continue;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    // Several things at once (a go-ahead dunk) earn a little more.
    const score = best.score + candidates.slice(1).reduce((n, c) => n + c.score * 0.25, 0);
    out.push({ ...best, score: Math.round(score * 10) / 10, index: i, quarter: e.quarter, clockSeconds: endClock, homeScoreAfter: e.homeScoreAfter, awayScoreAfter: e.awayScoreAfter });
  }
  return out;
}

/** Highest-scoring moments chosen to fit a time budget (ms), returned in game order. */
export const HIGHLIGHT_MIN = 4;
export function reelFor(highlights: Highlight[], durationOf: (index: number) => number, budgetMs = 60_000, minScore = HIGHLIGHT_MIN): Highlight[] {
  const picked: Highlight[] = [];
  let used = 0;
  for (const h of [...highlights].filter(h => h.score >= minScore).sort((a, b) => b.score - a.score || a.index - b.index)) {
    const d = durationOf(h.index);
    if (used + d > budgetMs) continue;
    used += d; picked.push(h);
  }
  return picked.sort((a, b) => a.index - b.index);
}

/** The game's standout plays, stored on the result at simulation time so the news wire never unpacks logs. */
export function topPlaysFor(result: GameResult, max = 3): TopPlay[] {
  return detectHighlights(result.possessionLog, result.regulationPeriods ?? 4)
    .filter(h => h.score >= 5).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max)
    .map(h => ({ possession: h.index, kind: h.kind, score: h.score, playerId: h.playerId, teamId: h.teamId, quarter: h.quarter, clockSeconds: h.clockSeconds, text: h.text, homeScoreAfter: h.homeScoreAfter, awayScoreAfter: h.awayScoreAfter }));
}

export function formatGameClock(quarter: number, clockSeconds: number, regulationPeriods = 4): string {
  const period = quarter <= regulationPeriods ? `${regulationPeriods === 2 ? 'H' : 'Q'}${quarter}` : `OT${quarter - regulationPeriods}`;
  const s = Math.max(0, Math.round(clockSeconds));
  return `${period} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
