import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { realVsYours, everyPlayer, driftLabel } from '../history/realVsYours';
import { MOMENTS } from '../history/moments';
import { withRingNight, lastFinalists } from '../simulation/ringNight';
import { historicalRosterPreview } from '../history/realRollover';
import type { League, ScheduledGame } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

let h: NbaHistory;
let built: { league: League; extras: GMLeagueExtras };
beforeAll(async () => {
  h = await loadHistoryForTests();
  built = buildHistoricalLeague(h, 2016, { realDevelopment: true, forceRosters: true, userTeamToo: true, difficulty: 'normal', seed: 4 });
}, 120_000);

describe('Real vs Yours', () => {
  it('compares a played season with the real one and scores the drift', () => {
    const { league, extras } = built;
    const played: League = { ...league, franchiseHistory: [...(league.franchiseHistory ?? []), {
      season: '2016', championTeamId: 'GSW', championTeamName: 'Golden State', mvpPlayerId: 'LeBron James', mvpTeamName: 'Cleveland', dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null,
    }] };
    const r = realVsYours(h, played, everyPlayer(played, extras.freeAgents));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].champion.real).toBe('Golden State');
    expect(r.rows[0].champion.same).toBe(true);
    expect(r.rows[0].mvp.real).toBe('Russell Westbrook');
    expect(r.rows[0].mvp.same).toBe(false);
    expect(r.rows[0].topPick.real).toBe('Markelle Fultz');
    expect(r.compared).toBe(2);
    expect(r.drift).toBe(50);
    expect(driftLabel(r.drift, r.compared)).toBeTruthy();
  });
  it('skips imported seasons', () => {
    expect(realVsYours(h, built.league, []).rows).toHaveLength(0);
  });
});

describe('take-over moments', () => {
  it('every moment names a team that really existed that season', () => {
    for (const m of MOMENTS) {
      expect(h.teams.some(t => t.season === m.year + 1 && t.abbr === m.team), `${m.id}: ${m.team} ${m.year}`).toBe(true);
    }
  });
});

describe('ring night', () => {
  it('a historical league opens with last season\'s champion hosting the Finals loser', () => {
    const f = lastFinalists(built.league.franchiseHistory);
    expect(f).toEqual({ champion: 'CLE', runnerUp: 'GSW' });
    const first = Math.min(...built.league.schedule.map(g => g.round));
    const opener = built.league.schedule.find(g => g.ringNight)!;
    expect(opener.round).toBe(first);
    expect([opener.homeTeamId, opener.awayTeamId]).toEqual(['CLE', 'GSW']);
  });
  it('keeps one game a day per team', () => {
    const rounds = new Map<number, Set<string>>();
    for (const g of built.league.schedule) {
      const s = rounds.get(g.round) ?? new Set();
      expect(s.has(g.homeTeamId) || s.has(g.awayTeamId)).toBe(false);
      s.add(g.homeTeamId); s.add(g.awayTeamId); rounds.set(g.round, s);
    }
  });
  it('does nothing without a champion', () => {
    const sched: ScheduledGame[] = [{ id: 'a', round: 0, homeTeamId: 'A', awayTeamId: 'B', played: false }];
    expect(withRingNight(sched, [])).toBe(sched);
  });
});

describe('roster-reset preview', () => {
  it('lists who leaves and who arrives for your team before the preseason', () => {
    const { league, extras } = built;
    const offseason: League = { ...league, season: '2017', seasonPhase: 'free_agency' };
    const p = historicalRosterPreview(offseason, extras, 'CLE')!;
    expect(p.leaving).toContain('Kyrie Irving');
    // Rosters are the ones teams finished the real season with: George Hill came to Cleveland at the 2018 deadline.
    expect(p.arriving).toContain('George Hill');
    expect(p.arriving).not.toContain('Isaiah Thomas');
    expect(historicalRosterPreview({ ...offseason, historical: { ...offseason.historical!, userTeamToo: false } }, extras, 'CLE')).toBeNull();
  });
});
