import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { franchiseTimeline } from '../simulation/timeline';

describe('franchise timeline', () => {
  it('has a stop for every archived season plus the one in progress, with the champion marked', () => {
    const { league, extras } = generateFullLeague(4, 6, 10, 12, '2026');
    const played = simulateRemainingSeason(league, 4);
    const { league: next, extras: nx } = beginNewSeasonRoster(played, extras, 4, { minGames: 1 });
    const rec = next.franchiseHistory!.at(-1)!;
    for (const t of next.teams) {
      const tl = franchiseTimeline(next, nx, t.teamId);
      expect(tl.filter(s => !s.current).length).toBe(next.franchiseHistory!.filter(r => r.teamSeasons?.some(x => x.teamId === t.teamId)).length);
      expect(tl.at(-1)!.current).toBe(true);
    }
    if (rec.championTeamId) {
      const s = franchiseTimeline(next, nx, rec.championTeamId).find(x => x.season === rec.season)!;
      expect(s.champion).toBe(true);
      expect(s.events.some(e => e.kind === 'title')).toBe(true);
    }
  });
});
