import { describe, it, expect, beforeAll } from 'vitest';
import type { League } from '../simulation/league';
import { firstRoundOrder, lotteryFormatForYear, oddsForTop, activeLotteryFormat } from '../simulation/draftLottery';
import { withYearAccurateSeason } from '../simulation/seasonTransition';
import { realSeasonShape } from '../history/historicalLeague';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';

const ids = Array.from({ length: 30 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`); // T01 = worst record
const league = { teams: ids.map((teamId, i) => ({ teamId, conferenceId: i % 2 ? 'west' : 'east' })) } as unknown as League;

describe('draft lottery formats by year', () => {
  it('each draft year uses the rule the NBA used then', () => {
    expect(lotteryFormatForYear(1950)).toBe('none');
    expect(lotteryFormatForYear(1966)).toBe('coinFlip1966');
    expect(lotteryFormatForYear(1984)).toBe('coinFlip1966');
    expect(lotteryFormatForYear(1985)).toBe('envelope1985');
    expect(lotteryFormatForYear(1988)).toBe('equal1987');
    expect(lotteryFormatForYear(1992)).toBe('weighted1990');
    expect(lotteryFormatForYear(2003)).toBe('weighted1994');
    expect(lotteryFormatForYear(2019)).toBe('modern2019');
  });
  it('historical leagues follow the year; a fixed choice wins; other leagues use today\'s rule', () => {
    expect(activeLotteryFormat({ settings: {} as League['settings'], historical: {} as League['historical'] }, 1980)).toBe('coinFlip1966');
    expect(activeLotteryFormat({ settings: { draftLottery: 'none' } as League['settings'], historical: {} as League['historical'] }, 2020)).toBe('none');
    expect(activeLotteryFormat({ settings: {} as League['settings'], historical: undefined }, 1980)).toBe('modern2019');
  });
  it('odds match the real tables', () => {
    expect(oddsForTop('modern2019', 14).slice(0, 4)).toEqual([14, 14, 14, 12.5]);
    expect(oddsForTop('weighted1994', 14)[0]).toBe(25);
    expect(oddsForTop('equal1987', 7)[0]).toBeCloseTo(14.3, 1);
  });
});

describe('drawing round one', () => {
  it('no lottery: the worst record picks first, every time', () => {
    expect(firstRoundOrder(league, ids, 'none', 1)).toEqual(ids);
  });
  it('coin flip: the worst team in each conference takes picks 1 and 2', () => {
    const order = firstRoundOrder(league, ids, 'coinFlip1966', 7);
    expect([...order.slice(0, 2)].sort()).toEqual(['T01', 'T02']);
    expect(order.slice(2)).toEqual(ids.slice(2));
  });
  it('modern lottery: four picks drawn from the 14 worst, the rest in order', () => {
    for (let seed = 1; seed < 200; seed++) {
      const order = firstRoundOrder(league, ids, 'modern2019', seed);
      expect(new Set(order).size).toBe(30);
      expect(order.slice(0, 4).every(t => ids.slice(0, 14).includes(t))).toBe(true);
      expect(order.indexOf('T01')).toBeLessThan(5); // the worst team falls no lower than 5th
      expect(order.slice(14)).toEqual(ids.slice(14));
    }
  });
  it('the worst team wins No. 1 about as often as the real odds say', () => {
    const wins = (format: 'modern2019' | 'weighted1994') => { let n = 0; for (let s = 0; s < 4000; s++) if (firstRoundOrder(league, ids, format, s * 7919 + 3)[0] === 'T01') n++; return n / 4000; };
    expect(wins('modern2019')).toBeGreaterThan(0.11); expect(wins('modern2019')).toBeLessThan(0.17);
    expect(wins('weighted1994')).toBeGreaterThan(0.21); expect(wins('weighted1994')).toBeLessThan(0.29);
  });
});

describe('year-accurate seasons', () => {
  let h: NbaHistory;
  beforeAll(async () => { h = await loadHistoryForTests(); }, 120_000);
  it('knows each real season\'s length and pace', () => {
    const shape = realSeasonShape(h);
    expect(shape.games['2020']).toBe(72); // 2020-21
    expect(shape.games['2011']).toBe(66); // the lockout
    expect(shape.games['1998']).toBe(50);
    expect(shape.games['2021']).toBe(82);
    expect(shape.pace['1965']).toBeGreaterThan(1.15); // 1960s run-and-gun
    expect(shape.pace['2003']).toBeLessThan(0.95); // the slow 2000s
  });
  it('the next season takes its real length, then 82 games once the data runs out', () => {
    const shape = realSeasonShape(h);
    const base = { settings: { yearAccurate: true, gamesPerSeason: 72, eraPace: 1 }, historical: { realSeasonGames: shape.games, realPace: shape.pace } } as unknown as League;
    expect(withYearAccurateSeason({ ...base, season: '2021' }).settings.gamesPerSeason).toBe(82);
    expect(withYearAccurateSeason({ ...base, season: '2011' }).settings.gamesPerSeason).toBe(66);
    const future = withYearAccurateSeason({ ...base, season: '2031' });
    expect(future.settings.gamesPerSeason).toBe(82);
    expect(future.settings.eraPace).toBe(1);
    expect(withYearAccurateSeason({ ...base, settings: { ...base.settings, yearAccurate: false }, season: '2011' }).settings.gamesPerSeason).toBe(72);
  });
});
