import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { draftPool, newDraft, runAi, autoPick, makePick, onClock, isDone, rosterOf, groupOf, buildDraftLeague, teamStrength, ROUNDS } from '../draft/allTimeDraft';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { initializeCoaching } from '../simulation/staffManagement';

describe('All-Time Draft', () => {
  it('drafts 13 rounds snake-style, fills needs, and builds a playable league', async () => {
    const h = await loadHistoryForTests();
    const pool = draftPool(h);
    expect(new Set(pool.map(c => c.playerId)).size).toBe(pool.length); // every player once
    expect(pool[0].ovr).toBeGreaterThanOrEqual(pool[50].ovr);
    const base = buildHistoricalLeague(h, h.manifest.coverage.seasons[1] - 1, { realDevelopment: false, difficulty: 'normal', seed: 3 });
    const teams = base.league.teams.map(t => ({ id: t.teamId, name: t.name }));
    const me = teams[4].id;
    let s = newDraft({ seed: 11, eraId: '90s', userTeam: me, userSlot: 29, teams, difficulty: 'normal' });
    expect(s.order[29]).toBe(me);
    expect(onClock(s)).toMatchObject({ round: 1, pick: 1, teamId: s.order[0] });
    s = runAi(h, s);
    expect(onClock(s)).toMatchObject({ overall: 30, teamId: me });
    s = makePick(s, autoPick(h, s, me).id);
    expect(onClock(s)).toMatchObject({ round: 2, pick: 1, teamId: me }); // snake: the last pick of round 1 goes first in round 2
    while (!isDone(s)) { s = runAi(h, s); if (!isDone(s)) s = makePick(s, autoPick(h, s, me).id); }
    expect(s.picks).toHaveLength(teams.length * ROUNDS);
    expect(new Set(s.picks.map(p => p.cardId)).size).toBe(s.picks.length);
    for (const t of teams) {
      const r = rosterOf(h, s, t.id);
      expect(r).toHaveLength(ROUNDS);
      for (const g of ['G', 'F', 'C'] as const) expect(r.filter(c => groupOf(c.pos) === g).length, `${t.id} ${g}`).toBeGreaterThanOrEqual(g === 'C' ? 2 : 3);
    }
    const strengths = teams.map(t => teamStrength(rosterOf(h, s, t.id)));
    expect(Math.max(...strengths) - Math.min(...strengths)).toBeLessThan(12); // a snake draft keeps it close
    // Same seed, same picks: the same draft.
    let again = newDraft(s.config);
    while (!isDone(again)) { again = runAi(h, again); if (!isDone(again)) again = makePick(again, autoPick(h, again, me).id); }
    expect(again.picks).toEqual(s.picks);

    const built = buildDraftLeague(h, s, base);
    expect(built.league.franchiseHistory).toEqual([]);
    expect(built.league.historical).toBeUndefined();
    expect(built.league.settings.era.threePointLineDistance).toBeGreaterThan(0); // 90s rules
    const ids = built.league.teams.flatMap(t => t.seasons.map(p => p.playerId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(built.extras.freeAgents).toHaveLength(60);
    for (const t of built.league.teams) {
      const payroll = t.seasons.reduce((n, p) => n + (built.extras.contracts[p.playerId]?.annualSalary ?? 0), 0);
      expect(payroll).toBeLessThanOrEqual(built.extras.capSettings.salaryCap * 1.1);
    }
    // A whole season plays.
    const r = autoPlayOneSeason(initializeCoaching(built.league, null), built.extras, me, DEFAULT_AWARD_SETTINGS, 5);
    expect(r.league.franchiseHistory?.length).toBe(1);
    const champ = r.league.franchiseHistory![0].championTeamId;
    expect(champ).toBeTruthy();
  }, 300_000);
});
