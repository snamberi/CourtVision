import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import {
  newSurvivalRun, keepTen, tagFranchise, playRound, answerClaim, signPlayer, wins, survivalRating, opponentOf, survivalScore,
  survivalShareText, isBossRound, DEALT, ROSTER, type SurvivalRun, type SurvivalLevel,
} from '../survival/run';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

/** Plays a whole run with simple choices: keep the ten best, tag the best, shield the best, sign the best offered. */
async function autoRun(seed: number, level: SurvivalLevel = 'pro'): Promise<SurvivalRun> {
  const h = await loadHistoryForTests();
  let run = newSurvivalRun(h, seed, level);
  run = keepTen(run, run.dealt.slice(0, ROSTER));
  run = tagFranchise(h, run, run.roster[0]);
  for (let guard = 0; guard < 60 && run.stage !== 'over'; guard++) {
    if (run.stage === 'pregame') run = playRound(h, run);
    else if (run.stage === 'claim') run = answerClaim(h, run, run.shields > 0 && !run.games.at(-1)!.shielded && cardPool(h).byId.get(run.claim!.cardId)!.ovr >= 80);
    else if (run.stage === 'sign') run = signPlayer(h, run, run.claim!.offer[0] ?? null);
  }
  return run;
}

describe('Survival', () => {
  it('deals fourteen distinct greats with a playable spread', async () => {
    const h = await loadHistoryForTests();
    const run = newSurvivalRun(h, 11);
    expect(run.dealt.length).toBe(DEALT);
    const cards = run.dealt.map(id => cardPool(h).byId.get(id)!);
    expect(new Set(cards.map(c => c.playerId)).size).toBe(DEALT);
    expect(cards.filter(c => c.pos.includes('C')).length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...cards.map(c => c.ovr))).toBeGreaterThanOrEqual(68);
    // Same seed, same deal.
    expect(newSurvivalRun(h, 11).dealt).toEqual(run.dealt);
  });

  it('keeps exactly ten, protects the Franchise Player and opens round one', async () => {
    const h = await loadHistoryForTests();
    let run = newSurvivalRun(h, 3);
    expect(keepTen(run, run.dealt.slice(0, 9))).toBe(run);
    run = keepTen(run, run.dealt.slice(2, 12));
    expect(run.stage).toBe('tag');
    run = tagFranchise(h, run, run.roster[1]);
    expect(run.stage).toBe('pregame');
    expect(opponentOf(h, run)).toBeTruthy();
    expect(survivalRating(h, run.roster)).toBeGreaterThan(opponentOf(h, run)!.strength);
  });

  it('a win costs a player (never the Franchise Player); a shield saves one; a loss ends the run', async () => {
    const run = await autoRun(7);
    expect(run.stage).toBe('over');
    expect(run.games.at(-1)!.won).toBe(false);
    const w = wins(run);
    expect(w).toBeGreaterThan(0);
    expect(run.roster).toContain(run.franchise);
    for (const g of run.games.filter(x => x.won)) { expect(g.lost).toBeTruthy(); expect(g.lost).not.toBe(run.franchise); expect(g.shielded).not.toBe(g.lost); }
    for (const g of run.games) expect(g.boss).toBe(isBossRound(g.round));
    expect(new Set(run.games.map(g => g.oppId)).size).toBe(run.games.length);
    expect(survivalScore(run)).toBeGreaterThan(0);
    expect(survivalShareText(run, 'https://x')).toMatch(/Survival/);
    if (env.PEEK) console.log('PEEK', w, run.games.map(g => `${g.us}-${g.them}`).join(' '));
  }, 120_000);

  it('a typical Pro run lasts several rounds but not forever', async () => {
    const lengths: number[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) lengths.push(wins(await autoRun(seed)));
    if (env.PEEK) console.log('PEEK pro', lengths.join(' '));
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    expect(avg).toBeGreaterThan(3);
    expect(avg).toBeLessThan(30);
  }, 300_000);
});
