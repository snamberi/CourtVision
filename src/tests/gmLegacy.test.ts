import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { ensureFrontOffice, markSandboxUse, type OwnerReview } from '../simulation/frontOffice';
import { legacyTotals, mergeLeague, type GmLegacy } from '../storage/gmLegacy';
import type { League } from '../simulation/league';

const empty = (): GmLegacy => ({ version: 1, achievements: {}, leagues: {} });
const review = (season: string, wins: number, finish: OwnerReview['finish']): OwnerReview => ({ season, teamId: 't', teamName: 'Hawks', wins, losses: 82 - wins, finish,
  goals: [], securityBefore: 60, securityAfter: 65, outcome: 'retained', note: '' });

describe('GM legacy across leagues', () => {
  const { league: base } = generateFullLeague(81, 30, 13, 10, '2026');
  const withRecord = (l: League): League => ({ ...l, frontOffice: { ...l.frontOffice!, reviews: [review('2026', 50, 'Champion'), review('2027', 40, 'First Round')],
    achievements: { title: { season: '2026' }, first_season: { season: '2026' } } } });
  const clean = withRecord(ensureFrontOffice(base, base.teams[0].teamId));

  it('adds a clean league\'s seasons and achievements, and merges achievements from several leagues', () => {
    const one = mergeLeague(empty(), 'a', 'League A', clean, 1);
    expect(legacyTotals(one)).toMatchObject({ leagues: 1, seasons: 2, wins: 90, titles: 1, achievements: 2 });
    const two = mergeLeague(one, 'b', 'League B', clean, 2);
    expect(two.achievements.title.saveIds).toEqual(['a', 'b']);
    expect(two.achievements.title.leagueName).toBe('League A'); // first league to earn it
    expect(legacyTotals(two).seasons).toBe(4);
  });

  it('removes a league once Sandbox is used, including achievements only it had earned', () => {
    const one = mergeLeague(mergeLeague(empty(), 'a', 'A', clean), 'b', 'B', { ...clean, frontOffice: { ...clean.frontOffice!, achievements: { title: { season: '2026' }, dynasty: { season: '2030' } } } });
    const tainted = markSandboxUse({ ...clean, settings: { ...clean.settings, sandboxMode: true } });
    const after = mergeLeague(one, 'b', 'B', tainted);
    expect(after.leagues.b).toBeUndefined();
    expect(after.achievements.dynasty).toBeUndefined();
    expect(after.achievements.title.saveIds).toEqual(['a']);
    expect(mergeLeague(empty(), 'c', 'C', tainted)).toEqual(empty());
  });

  it('marks All-Time Draft leagues so their titles count for the Draft achievements', () => {
    const drafted = mergeLeague(empty(), 'd', 'Draft', { ...clean, allTimeDraft: { seed: 1, eraId: '90s' } }, 1);
    expect(drafted.leagues.d).toMatchObject({ kind: 'draft', titles: 1 });
    expect(mergeLeague(empty(), 'a', 'A', clean, 1).leagues.a.kind).toBeUndefined();
  });

  it('ignores unofficial reviews', () => {
    const l = { ...clean, frontOffice: { ...clean.frontOffice!, reviews: [{ ...review('2026', 70, 'Champion'), unofficial: true }] } };
    expect(mergeLeague(empty(), 'a', 'A', l).leagues.a).toBeUndefined();
  });
});

// Release missions must stay within the same official franchise.
import { franchiseSecrets } from '../relics/franchiseSecrets';
describe('franchise Secret missions', () => {
  const { league } = generateFullLeague(81, 6, 8, 4, '2026');
  const base = ensureFrontOffice(league, league.teams[0].teamId);
  const withReviews = (reviews: OwnerReview[]) => ({ ...base, frontOffice: { ...base.frontOffice!, reviews } });
  it('awards five championships with one team, not five across different teams', () => {
    const rows = Array.from({ length: 5 }, (_, i) => review(String(2026 + i), 60, 'Champion'));
    expect(franchiseSecrets(withReviews(rows))).toContain('loyaltyPays');
    expect(franchiseSecrets(withReviews(rows.map((r, i) => ({ ...r, teamId: String(i) }))))).not.toContain('loyaltyPays');
    expect(franchiseSecrets(markSandboxUse({ ...withReviews(rows), settings: { ...base.settings, sandboxMode: true } }))).toEqual([]);
  });
  it('requires a championship after the low-win season with that same team', () => {
    const rows = [review('2026', 20, 'Missed Playoffs'), review('2028', 55, 'Champion')];
    expect(franchiseSecrets(withReviews(rows))).toContain('rebuilder');
    expect(franchiseSecrets(withReviews([{ ...rows[0], wins: 21 }, rows[1]]))).not.toContain('rebuilder');
    expect(franchiseSecrets(withReviews([rows[0], { ...rows[1], teamId: 'other' }]))).not.toContain('rebuilder');
  });
});
