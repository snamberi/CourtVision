// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { seasonCards, awardSeasonCards, openPack, albumStats, loadAlbum, packsWaiting } from '../cards/cards';

describe('trading cards', () => {
  beforeEach(() => localStorage.clear());
  const { league, extras } = generateFullLeague(9, 6, 10, 12, '2026');
  const played = simulateRemainingSeason(league, 3);
  const { league: next } = beginNewSeasonRoster(played, extras, 3, { minGames: 1 });
  const me = next.teams[0].teamId;

  it('makes a card for everyone who played, with the season\'s variant', () => {
    const rec = next.franchiseHistory!.at(-1)!;
    const { cards, sets } = seasonCards(next, rec, 'save1');
    expect(cards.length).toBeGreaterThan(40);
    expect(sets).toHaveLength(6);
    const mvp = cards.find(c => c.playerId === rec.mvpPlayerId);
    if (mvp) { expect(mvp.variant).toBe('mvp'); expect(mvp.rarity).toBe('legendary'); }
    for (const c of cards) { expect(c.pts).toBeGreaterThanOrEqual(0); expect(c.primary).toMatch(/^#/); }
  });
  it('gives your roster\'s cards and packs once per season, and packs add to the album', () => {
    const got = awardSeasonCards(next, 'save1', me)!;
    expect(got.added).toBeGreaterThan(5);
    expect(got.packs).toBeGreaterThanOrEqual(1);
    expect(awardSeasonCards(next, 'save1', me)).toBeNull();
    const before = Object.keys(loadAlbum()).length, packs = packsWaiting();
    const pulled = openPack(() => 0.5);
    expect(pulled).toHaveLength(5);
    expect(packsWaiting()).toBe(packs - 1);
    expect(Object.keys(loadAlbum()).length).toBeGreaterThanOrEqual(before);
    expect(albumStats().completeSets).toBeGreaterThanOrEqual(1); // your own team's set came complete
  });
});
