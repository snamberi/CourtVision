import { describe, it, expect } from 'vitest';
import { SYNC_KEYS, mergeValue, mergeStorage } from '../cloud/merge';

describe('account sync: your look, ratings, pets and every record the achievements read', () => {
  it('travels with the account', () => {
    for (const k of ['cv-survival-records', 'cv-story-endings', 'cv-owner-records', 'cv-battle-records', 'cv-ranked-best', 'cv-theme', 'cv-favorites', 'cv-my-ratings', 'cv-pets', 'cv-relics', 'cv-avatar', 'courtvision:gmLegacy'])
      expect(SYNC_KEYS as readonly string[]).toContain(k);
  });
  it('every new key merges to something when both sides have it (none is dropped)', () => {
    const sample: Record<string, string> = {
      'cv-survival-records': '{}', 'cv-story-endings': '{}', 'cv-owner-records': '[]', 'cv-battle-records': '{}', 'cv-decade-best': '{}', 'cv-street-best': '5',
      'cv-ranked-best': 'gold', 'cv-founding': '1', 'cv-theme': 'x', 'cv-menu-style': 'x', 'cv-favorites': '{}', 'cv-profile-name': 'x', 'cv-phone-order': '[]',
      'cv-avatar-presets-v1': '[]', 'cv-my-ratings': '{}', 'cv-pets': '{}',
    };
    for (const k of Object.keys(sample)) expect(SYNC_KEYS as readonly string[]).toContain(k);
    const merged = mergeStorage(sample, sample);
    for (const k of Object.keys(sample)) expect(merged[k], k).toBeDefined();
  });
  it('keeps the best of both devices', () => {
    expect(JSON.parse(mergeValue('cv-survival-records', JSON.stringify({ runs: 3, bossesBeaten: 1, best: { pro: { wins: 4, score: 500 } } }), JSON.stringify({ runs: 5, bossesBeaten: 0, best: { pro: { wins: 9, score: 900 } } }))!))
      .toMatchObject({ runs: 5, bossesBeaten: 1, best: { pro: { wins: 9, score: 900 } } });
    expect(JSON.parse(mergeValue('cv-story-endings', JSON.stringify({ finished: 2, tiers: { legend: 1 } }), JSON.stringify({ finished: 1, tiers: { star: 1 } }))!)).toEqual({ finished: 2, tiers: { legend: 1, star: 1 } });
    expect(mergeValue('cv-ranked-best', 'silver', 'diamond')).toBe('diamond');
    expect(mergeValue('cv-street-best', '4', '11')).toBe('11');
    // Your look: this device's choice wins, but a new device picks up the cloud's.
    expect(mergeValue('cv-theme', 'cartridge', 'terminal')).toBe('cartridge');
    expect(mergeValue('cv-theme', null, 'terminal')).toBe('terminal');
    expect(JSON.parse(mergeValue('cv-pets', JSON.stringify({ v: 1, equipped: 'cat', looks: { cat: { name: 'Tom' } } }), JSON.stringify({ v: 1, equipped: 'dog', looks: { dog: { name: 'Rex' } } }))!))
      .toMatchObject({ equipped: 'cat', looks: { cat: { name: 'Tom' }, dog: { name: 'Rex' } } });
  });
});
