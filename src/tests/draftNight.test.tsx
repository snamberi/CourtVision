// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { draftOrderWithLottery, generateDraftClass, draftProspect, currentDraftOrder, buildTwoRoundDraftOrder } from '../simulation/gm';
import { lotteryResult, consensusBoard, pickReaction, tradeDownOffers, tradeUpOffers } from '../simulation/draftNight';
import { DraftLotteryShow } from '../components/DraftLotteryShow';

const { league: base, extras: baseExtras } = generateFullLeague(91, 16, 13, 20, '2026', { priorSeasons: false });
const league = simulateRounds(base, 10, 4);

describe('draft night', () => {
  it('the lottery record matches the order it produced', () => {
    const round1 = draftOrderWithLottery(league, 7);
    const r = lotteryResult(league, round1, '2027')!;
    expect(r.entries).toHaveLength(14);
    for (const e of r.entries) expect(round1[e.after - 1]).toBe(e.teamId);
    expect(r.entries[0].oddsTop).toBeGreaterThan(r.entries[13].oddsTop);
    expect(Math.round(r.entries.reduce((n, e) => n + e.oddsTop, 0))).toBe(100);
  });

  it('reactions grade a pick against the consensus board', () => {
    expect(pickReaction(10, 2, 0)).toBe('Reach');
    expect(pickReaction(2, 9, 0)).toBe('Steal');
    expect(pickReaction(3, 3, 3)).toBe('Best available');
    expect(pickReaction(5, 4, 2)).toBe('Solid pick');
  });

  it('every pick is recorded with its board rank and a reaction; teams call to trade into your slot', () => {
    const draftClass = generateDraftClass(40, 5, '2027');
    const order = buildTwoRoundDraftOrder(league, 3);
    let extras = { ...baseExtras, draftClass, draftOrder: order, draftDayOpen: true, draftPickIndex: 0, draftPicksMade: [] as NonNullable<typeof baseExtras.draftPicksMade>, draftBoard: consensusBoard(draftClass), capSettings: { ...baseExtras.capSettings, enforceCapOnTrades: false } };
    let l = league;
    const me = order[0];
    const offers = tradeDownOffers(l, extras, me);
    for (const o of offers) { expect(o.currentPicksFromB).toEqual([0]); expect(o.note).toMatch(/move up/); }
    for (let i = 0; i < 3; i++) {
      const who = currentDraftOrder(l, extras)[extras.draftPickIndex];
      const worst = [...extras.draftClass].sort((a, b) => extras.draftBoard![b.playerId] - extras.draftBoard![a.playerId])[0];
      const r = draftProspect(l, extras, i === 0 ? worst.playerId : extras.draftClass[0].playerId, who);
      l = r.league; extras = r.extras as typeof extras;
    }
    expect(extras.draftPicksMade).toHaveLength(3);
    expect(extras.draftPicksMade![0].reaction).toBe('Reach');
    for (const p of extras.draftPicksMade!) expect(p.boardRank).toBeGreaterThanOrEqual(0);
  });

  it('you can call around to move up before your pick', () => {
    const draftClass = generateDraftClass(40, 6, '2027');
    const order = buildTwoRoundDraftOrder(league, 3);
    const extras = { ...baseExtras, draftClass, draftOrder: order, draftDayOpen: true, draftPickIndex: 0, draftPicksMade: [] as NonNullable<typeof baseExtras.draftPicksMade>, draftBoard: consensusBoard(draftClass), capSettings: { ...baseExtras.capSettings, enforceCapOnTrades: false } };
    const me = order[10];
    const mySlot = order.indexOf(me);
    const offers = tradeUpOffers(league, extras, me);
    for (const o of offers) {
      expect(o.currentPicksFromB).toEqual([mySlot]);
      expect(o.currentPicksFromA![0]).toBeLessThan(mySlot);
      expect(o.teamBId).toBe(me);
    }
    expect(tradeUpOffers(league, { ...extras, draftDayOpen: false }, me)).toEqual([]);
  });

  it('the lottery show reveals envelopes from the bottom up', () => {
    const r = lotteryResult(league, draftOrderWithLottery(league, 9), '2027')!;
    let done = false;
    render(<DraftLotteryShow league={league} lottery={r} controlledTeamId={r.entries[0].teamId} onDone={() => { done = true; }} />);
    expect(screen.getAllByText(/sealed/).length).toBe(14);
    fireEvent.click(screen.getByRole('button', { name: 'Open next envelope' }));
    expect(screen.getAllByText(/sealed/).length).toBe(13);
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: /On to the draft/ }));
    expect(done).toBe(true);
  });
});
