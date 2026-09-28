// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup, readBackup, summarize, BACKUP_FORMAT } from '../storage/backup';
import { savesDb } from '../storage/saves';
import { saveCareer, listCareers, loadWorld } from '../career/storage';
import { newCareerMeta } from '../career/career';
import { startProgress, type Prime } from '../career/create';
import { CATEGORIES } from '../career/categories';

const prime = Object.fromEntries(CATEGORIES.map(c => [c.id, { 'offense.threePoint': 80 }])) as unknown as Prime;

describe('backup everything', () => {
  it('round-trips leagues, careers, League Hunt and records; device-only keys stay out; restore never deletes', async () => {
    localStorage.clear();
    localStorage.setItem('cv-hunt-records', JSON.stringify({ runs: 3, wins: 1, bestStop: 9 }));
    localStorage.setItem('courtvision:gmLegacy', JSON.stringify({ version: 1, achievements: { title: {} }, leagues: {} }));
    localStorage.setItem('cv-rebuild-records', '{"bulls99":{"best":2400,"stars":3}}');
    localStorage.setItem('courtvision:consent', 'granted');
    localStorage.setItem('unrelated', 'x');
    await savesDb.saves.put({ id: 'save-a', name: 'My League', createdAt: 1, updatedAt: 2, snapshot: { league: { teams: [], schedule: [], settings: {} }, extras: {} } as never });
    const meta = newCareerMeta('career-a', 1, 'wheel', { name: 'Backup Guy', pos: 'SG', jersey: 3 }, prime, 'balanced', 'Backup Guy', '2026', startProgress());
    await saveCareer(meta, { id: 'career-a', league: { teams: [], schedule: [], settings: {} } as never, extras: {} as never, phase: 'inSeason' });

    const b = await buildBackup();
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(Object.keys(b.localStorage).sort()).toEqual(['courtvision:gmLegacy', 'cv-hunt-records', 'cv-rebuild-records']);
    expect(summarize(b)).toMatchObject({ leagues: 1, careers: 1, hunts: true, achievements: 1 });

    // A fresh device: nothing but one league of its own.
    localStorage.clear();
    await savesDb.saves.clear();
    await savesDb.saves.put({ id: 'save-b', name: 'Other', createdAt: 1, updatedAt: 1, snapshot: { league: { teams: [], schedule: [], settings: {} }, extras: {} } as never });
    const read = await readBackup(new Blob([JSON.stringify(b)], { type: 'application/json' }));
    await restoreBackup(read);
    expect((await savesDb.saves.toArray()).map(s => s.id).sort()).toEqual(['save-a', 'save-b']);
    expect((await listCareers()).map(m => m.playerId)).toContain('Backup Guy');
    expect((await loadWorld('career-a'))?.phase).toBe('inSeason');
    expect(JSON.parse(localStorage.getItem('cv-hunt-records')!).wins).toBe(1);
    expect(localStorage.getItem('courtvision:consent')).toBeNull();
  });

  it('refuses files that are not backups', async () => {
    await expect(readBackup(new Blob(['hello']))).rejects.toThrow(/not a Court Vision backup/);
    await expect(readBackup(new Blob([JSON.stringify({ format: 'x' })]))).rejects.toThrow(/not a Court Vision backup/);
  });
});
