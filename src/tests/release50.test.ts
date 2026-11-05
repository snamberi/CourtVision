// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadRelics, RELICS, relicPower, autoEquip, spinEventRelic, spinRelic, mergeRelics, eventKeysLeft, saveRelics } from '../relics/relics';
import { HOLIDAYS, HOLIDAY_KEY, eventCoins, loadHoliday } from '../retention/holiday';
import { buyEventKey } from '../retention/holidayBuy';
import { eventSecretIds } from '../relics/releaseSecrets';
import { piecesFor } from '../retention/holidayShop';
import { RELEASE_TITLES, releaseTitleProgress } from '../profile/releaseTitles';
import { newWheel } from '../career/wheel';
import { newStory } from '../story/story';

describe('release 50 progression safeguards', () => {
  beforeEach(() => localStorage.clear());
  it('each event has its own secrets, cosmetics, currency and key', () => {
    expect(HOLIDAYS).toHaveLength(9);
    for (const h of HOLIDAYS) {
      expect(eventSecretIds(h.id).length).toBeGreaterThan(0);
      expect(piecesFor(h.id).length).toBeGreaterThanOrEqual(2);
      expect(h.keyName).toBeTruthy();
    }
    expect(new Set(HOLIDAYS.map(h => h.keyName)).size).toBe(9);
  });
  it('spends only matching keys and keeps event secrets out of normal spins', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const base = { ...loadRelics(), spins: 4, eventKeys: { 'halloween-2026': 1, 'christmas-2026': 1 } };
    const event = spinEventRelic(base, 'halloween', now, () => 0)!;
    expect(event.result.kind).toBe('secret');
    expect(eventSecretIds('halloween')).toContain(event.result.id);
    expect(event.state.spins).toBe(4);
    expect(eventKeysLeft(event.state, 'halloween-2026')).toBe(0);
    expect(eventKeysLeft(event.state, 'christmas-2026')).toBe(1);
    expect(spinEventRelic(event.state, 'halloween', now)).toBeNull();
    expect(spinEventRelic(base, 'christmas', now)).toBeNull();
    expect(eventSecretIds('halloween')).not.toContain(spinRelic(base, () => 0, now)!.result.id);
    expect(eventKeysLeft(mergeRelics(base, event.state), 'halloween-2026')).toBe(0);
    expect(eventKeysLeft(mergeRelics(event.state, base), 'halloween-2026')).toBe(0);
  });
  it('buys event keys with event coins, survives reload, and rejects closed shops', () => {
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify({ v: 1, earned: { 'halloween-2026': 20 }, spent: {}, counted: [] }));
    const now = new Date('2026-10-15T12:00:00Z');
    expect(buyEventKey('halloween', now)).toBe('ok');
    expect(eventCoins(loadHoliday(), 'halloween-2026')).toBe(10);
    const spun = spinEventRelic(loadRelics(), 'halloween', now, () => 0)!;
    saveRelics(spun.state);
    expect(eventKeysLeft(loadRelics(), 'halloween-2026')).toBe(0);
    expect(buyEventKey('christmas', now)).toBe('closed');
    expect(buyEventKey('halloween', now)).toBe('ok');
    expect(buyEventKey('halloween', now)).toBe('coins');
  });
  it('only the fifteenth equipped relic receives double power', () => {
    const owned = Object.fromEntries(RELICS.filter(r => !r.stack).slice(0, 15).map(r => [r.id, 1]));
    const s = { ...loadRelics(), owned, slotsBought: 5, equipped: Object.keys(owned) };
    expect(s.equipped).toHaveLength(15);
    expect(s.equipped.map(id => relicPower(s, id))).toEqual([...Array(14).fill(1), 2]);
    const best = autoEquip(s);
    expect(new Set(best).size).toBe(15);
    expect(autoEquip({ ...s, equipped: best })).toEqual(best);
  });
  it('adds fifty distinct titles with real requirements', () => {
    expect(RELEASE_TITLES).toHaveLength(50);
    expect(new Set(RELEASE_TITLES.map(t => t.title)).size).toBe(50);
    for (const t of RELEASE_TITLES) expect(releaseTitleProgress({ level: 0, trophies: 0 }, t)).toBe(0);
  });
  it('applies Career and Story secrets only when supplied at run creation', () => {
    const base = newWheel(42);
    const special = newWheel(42, undefined, { secrets: ['cursedDice', 'midnightReset', 'foundersWhistle'] });
    expect(special.respins).toBe(base.respins + 2);
    expect(special.cursedDice).toBe(true);
    const story = newStory(42, 'Test', 'scorer', 'Home', { secrets: ['snowGlobe', 'heartOfTeam'] });
    expect(story.grit).toBe(5);
  });
});

import { generateFullLeague } from '../simulation/leagueGenerator';
import { ensureFrontOffice } from '../simulation/frontOffice';
import { openNegotiation, storeNegotiation, walkAway, retryNegotiation, currentNegotiation } from '../simulation/agents';
import { signingDecision } from '../simulation/freeAgentDecision';
it('Loyalty Pays reopens a real refusal once per offseason and persists its usage', () => {
  localStorage.clear();
  const generated = generateFullLeague(12, 6, 13, 4, '2026');
  const teamId = generated.league.teams[5].teamId;
  const league = ensureFrontOffice({ ...generated.league, seasonPhase: 'free_agency' }, teamId);
  const extras = { ...generated.extras, freeAgencyOpen: true, capSettings: { ...generated.extras.capSettings, salaryCap: 400_000_000, maxRosterSize: 20 } };
  const candidates = league.teams[0].seasons.map(p => ({ ...p, teamId: null }));
  const player = candidates.find(p => !!openNegotiation(league, extras, p, teamId))!;
  expect(player).toBeTruthy();
  const failed = storeNegotiation(extras, walkAway(openNegotiation(league, extras, player, teamId)!));
  expect(signingDecision(league, failed, player, teamId).refuses).toBe(true);
  expect(retryNegotiation(league, failed, player, teamId)).toBeNull();
  saveRelics({ ...loadRelics(), secrets: ['loyaltyPays'] });
  const next = retryNegotiation(league, failed, player, teamId)!;
  expect(next).not.toBeNull();
  expect(currentNegotiation(league, next, player.playerId, teamId)?.status).toBe('open');
  const failedAgain = storeNegotiation(JSON.parse(JSON.stringify(next)), walkAway(currentNegotiation(league, next, player.playerId, teamId)!));
  expect(retryNegotiation(league, failedAgain, player, teamId)).toBeNull();
});
