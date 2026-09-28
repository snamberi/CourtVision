import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, simulateNextGame } from '../simulation/league';
import { collectPress, answerPress, pressState } from '../simulation/press';
import { planRivalryWeek, rivalryHype, rivalryWeekNews } from '../simulation/rivalryWeek';
import { bondsAfterGame, strongDuos, duoBoost, teamBonds, DUO_BOND, DUO_BOOST } from '../simulation/chemistryWeb';
import { businessOf, buyUpgrade, homeCourtEdge, gate, defaultBusiness } from '../simulation/business';
import { recordDrill, drillsFor, scoutingReport, COMBINE_TESTS } from '../simulation/scouting';
import { prospectComparison } from '../simulation/draftScouting';
import { LEGEND_SCENARIOS, legendTeams, playLegendGame, legendRun, scoreLegend } from '../hunt/legendChallenges';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { TeamBoxScore } from '../simulation/boxscore';

const { league: base, extras } = generateFullLeague(33, 10, 13, 30, '2026', { priorSeasons: false });
const me = base.teams[0].teamId;

describe('Rivalry Week', () => {
  it('picks one rivalry game in each half against a real opponent', () => {
    const plan = planRivalryWeek(base, me)!;
    expect(plan.games.length).toBe(2);
    const mine = base.schedule.filter(g => g.homeTeamId === me || g.awayTeamId === me);
    const half = Math.floor(mine.length / 2);
    const [a, b] = plan.games.map(g => mine.findIndex(x => x.id === g.gameId));
    expect(a).toBeLessThan(half); expect(b).toBeGreaterThanOrEqual(half);
    for (const g of plan.games) { const s = base.schedule.find(x => x.id === g.gameId)!; expect([s.homeTeamId, s.awayTeamId]).toContain(g.opponentId); }
    const hype = rivalryHype(base, me, plan.games[0]);
    expect(hype).toBeGreaterThanOrEqual(0); expect(hype).toBeLessThanOrEqual(100);
  });

  it('calls a trash-talk press conference, lets the answer raise the hype, and applies the fallout once played', () => {
    let l = collectPress(base, me);
    const first = l.rivalryWeek!.games[0];
    const mine = l.schedule.filter(g => g.homeTeamId === me || g.awayTeamId === me);
    // Play up to a couple of games before the rivalry game: the conference shows up.
    while (!pressState(l).pending.some(c => c.kind === 'rivalry')) { l = collectPress(simulateNextGame(l, 5), me); if (l.schedule.find(g => g.id === first.gameId)!.played) break; }
    const conf = pressState(l).pending.find(c => c.kind === 'rivalry');
    expect(conf).toBeDefined();
    const before = rivalryHype(l, me, l.rivalryWeek!.games[0]);
    l = answerPress(l, conf!.id, 'trash', me);
    expect(l.rivalryWeek!.games[0].talk?.trash).toBe(true);
    expect(rivalryHype(l, me, l.rivalryWeek!.games[0])).toBeGreaterThan(before);
    const idx = mine.findIndex(g => g.id === first.gameId);
    while (!l.schedule.find(g => g.id === first.gameId)!.played) l = collectPress(simulateNextGame(l, 5), me);
    const done = l.rivalryWeek!.games[0].result!;
    expect(done).toBeDefined();
    expect(done.won ? done.fans > 0 : done.fans < 0).toBe(true);
    expect(rivalryWeekNews(l)[0].headline).toContain('Rivalry Week');
    expect(idx).toBeGreaterThanOrEqual(0);
    // Stable once settled.
    expect(collectPress(l, me)).toBe(l);
  }, 60000);
});

describe('Chemistry web', () => {
  const team = base.teams[0];
  const [a, b, c] = team.seasons.map(s => s.playerId);
  const box = (m: Record<string, number>): TeamBoxScore => ({ teamId: team.teamId, points: 0, players: Object.fromEntries(Object.entries(m).map(([id, minutes]) => [id, { playerId: id, minutes } as never])) });

  it('grows with shared minutes, weakens with bad minutes, and breaks on a trade', () => {
    let t = { ...team, bonds: {} as Record<string, number> };
    for (let i = 0; i < 90; i++) t = { ...t, bonds: bondsAfterGame(t, box({ [a]: 34, [b]: 33, [c]: 3 })) };
    const ab = teamBonds(t)[[a, b].sort().join('|')];
    expect(ab).toBeGreaterThanOrEqual(DUO_BOND);
    expect(teamBonds(t)[[a, c].sort().join('|')]).toBeUndefined();
    expect(strongDuos(t)[0].key).toBe([a, b].sort().join('|'));
    expect(duoBoost(t, [a, b])).toEqual({ [a]: DUO_BOOST, [b]: DUO_BOOST });
    expect(duoBoost(t, [a])).toEqual({});
    const weaker = bondsAfterGame(t, box({ [a]: 36, [b]: 2 }))[[a, b].sort().join('|')];
    expect(weaker).toBeLessThan(ab);
    const traded = { ...t, seasons: t.seasons.filter(s => s.playerId !== b) };
    expect(strongDuos(traded)).toHaveLength(0);
  });

  it('bonds build up over a simulated stretch of the season', () => {
    const l = simulateRounds(base, 20, 3);
    expect(Object.keys(teamBonds(l.teams[0])).length).toBeGreaterThan(5);
  }, 60000);
});

describe('Arena upgrades', () => {
  it('reads old saves without the new upgrades, and the new ones add attendance and home-court edge', () => {
    const team = { ...base.teams[0], business: { ...defaultBusiness(base.teams[0]), arena: { seats: 1, scoreboard: 0, practice: 0 } as never } };
    expect(businessOf(team).arena.mascot).toBe(0);
    expect(homeCourtEdge(team)).toBe(0);
    let up: import("../simulation/league").LeagueTeam = team;
    for (const u of ['crowd', 'crowd', 'lights', 'mascot'] as const) up = buyUpgrade(up, u)!;
    expect(homeCourtEdge(up)).toBeGreaterThan(1);
    expect(gate(up, 0.4, 50).fill).toBeGreaterThan(gate(team, 0.4, 50).fill);
    expect(businessOf(up).loans).toHaveLength(4);
  });
});

describe('Combine drills', () => {
  const p = extras.draftClass[0];
  it('reveal the tested skills exactly and cap the number of prospects', () => {
    let x = extras;
    x = recordDrill(x, me, p.playerId, 'shooting', 7).extras;
    const r = scoutingReport(p, base, x, me);
    expect(r.revealed.Shooting).toBe(prospectComparison(p.trueSeason).Shooting);
    expect(r.revealed.Athleticism).toBeUndefined();
    x = recordDrill(x, me, p.playerId, 'shooting', 5).extras;
    expect(drillsFor(x, me)[p.playerId].shooting).toBe(7);
    for (const q of extras.draftClass.slice(1, COMBINE_TESTS)) x = recordDrill(x, me, q.playerId, 'sprint', 3.2).extras;
    expect(recordDrill(x, me, extras.draftClass[COMBINE_TESTS].playerId, 'vertical', 30).error).toBeDefined();
  });
});

describe('Legend Challenges', () => {
  it('every scenario finds both real teams and a run plays to a finish with a score', async () => {
    const h = await loadHistoryForTests();
    for (const sc of LEGEND_SCENARIOS) { const t = legendTeams(h, sc); expect(t, sc.id).not.toBeNull(); expect(t!.you.seasons.length).toBeGreaterThanOrEqual(8); }
    let state = { scenarioId: 'stop73', games: [] as never[] } as import('../hunt/legendChallenges').LegendRunState;
    for (let i = 0; i < 3 && !legendRun(state).done(); i++) state = playLegendGame(h, state, 'balanced', 100 + i)!.state;
    const run = legendRun(state);
    expect(run.done()).toBe(true);
    expect(run.wins() === 4 || run.losses() === 4).toBe(true);
    const s = scoreLegend(run);
    expect(s.stars).toBeGreaterThanOrEqual(run.won() ? 2 : 0);
    const single = legendRun(playLegendGame(h, { scenarioId: 'spurs13', games: [] }, 'defense', 9)!.state);
    expect(single.done()).toBe(true);
  }, 120000);
});
