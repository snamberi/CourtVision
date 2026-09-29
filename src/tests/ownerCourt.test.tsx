import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { courtFrame } from '../simulation/courtMotion';
import { WatchCourt } from '../components/WatchCourt';

describe("an owner's arena on the court", () => {
  it('puts the arena name on the scorer\'s table and lit skyboxes up top', () => {
    const { league } = generateFullLeague(5, 4, 13, 10, '2026');
    const [a, b] = league.teams;
    const r = simulateGame({ home: { teamId: a.teamId, seasons: a.seasons }, away: { teamId: b.teamId, seasons: b.seasons }, settings: { ...DEFAULT_GAME_SETTINGS, seed: 2 } });
    const frame = courtFrame(r.possessionLog[3], 0.5, a.teamId, b.teamId);
    const props = { frame, home: { teamId: a.teamId, name: a.name }, away: { teamId: b.teamId, name: b.name }, rosters: [...a.seasons, ...b.seasons] };
    const plain = renderToStaticMarkup(<WatchCourt {...props} />);
    expect(plain).not.toContain('arena-suites');
    const owned = renderToStaticMarkup(<WatchCourt {...props} building={{ name: 'The Palace', suites: 2 }} />);
    expect(owned).toContain('arena-suites');
    expect(owned.match(/<rect[^>]*width="14" height="5"/g)?.length).toBe(18);
    expect(owned).not.toBe(plain);
  });
});
