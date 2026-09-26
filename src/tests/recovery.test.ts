import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSaves, createSave, updateSave, deleteSave, getSave, listRestorePoints, createRestorePoint, recoverRestorePoint, savesDb, MAX_RESTORE_POINTS } from '../storage/saves';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { buildSnapshot, parseUniverseFile } from '../storage/universeIO';
const fixture = () => generateFullLeague(41, 4, 10, 6, '2026', { priorSeasons: false });
beforeEach(async () => { await savesDb.saves.clear(); await savesDb.restorePoints.clear(); });
describe('save recovery', () => {
  it('upgrades a version-one database without replacing its saved league', async () => {
    const { league, extras } = fixture();
    await savesDb.delete();
    const old = new Dexie('courtvision-saves'); old.version(1).stores({ saves: 'id, updatedAt' });
    await old.table('saves').put({ id: 'legacy', name: 'Legacy', createdAt: 1, updatedAt: 1, snapshot: buildSnapshot(league, extras) });
    old.close(); await savesDb.open();
    expect((await getSave('legacy'))?.league).toEqual(league);
    await updateSave('legacy', { ...league, season: '2027' }, extras, null);
    expect((await listRestorePoints('legacy'))[0].snapshot.league.season).toBe('2026');
  });
  it('keeps five distinct checkpoints and restores into a new slot with its team and extras', async () => {
    const { league, extras } = fixture();
    const team = league.teams[0].teamId;
    const id = await createSave('Original', league, extras, team);
    for (let i = 0; i < 7; i++) {
      await updateSave(id, { ...league, calendarDate: `2026-10-${10 + i}` }, extras, team);
      await createRestorePoint(id);
    }
    const points = await listRestorePoints(id);
    expect(points).toHaveLength(MAX_RESTORE_POINTS);
    expect(new Set(points.map(p => p.createdAt)).size).toBe(MAX_RESTORE_POINTS);
    const before = await getSave(id);
    const restoredId = await recoverRestorePoint(id, points.at(-1)!.id);
    expect(restoredId).not.toBe(id);
    expect(await getSave(id)).toEqual(before);
    const restored = await getSave(restoredId);
    expect(restored?.controlledTeamId).toBe(team);
    expect(restored?.league.calendarDate).toBe(points.at(-1)!.snapshot.league.calendarDate);
    expect(restored?.extras).toEqual(extras);
  });
  it('automatically protects the previous phase and played-game progress', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Auto', league, extras, null);
    const first = { ...league, schedule: league.schedule.map((g, i) => ({ ...g, played: i < 9 })) };
    await updateSave(id, first, extras, null);
    const next = { ...first, schedule: first.schedule.map((g, i) => ({ ...g, played: i < 10 })) };
    await updateSave(id, next, extras, null);
    expect((await listRestorePoints(id))[0].snapshot.league.schedule.filter(g => g.played)).toHaveLength(9);
    await updateSave(id, { ...next, seasonPhase: 'playoffs' }, extras, null);
    expect((await listRestorePoints(id))[0].snapshot.league.seasonPhase).toBeUndefined();
    expect((await listRestorePoints(id))[0].snapshot.league.schedule.filter(g => g.played)).toHaveLength(10);
  });
  it('rejects cross-league restores and deletes only the selected league backups', async () => {
    const { league, extras } = fixture();
    const a = await createSave('A', league, extras, null), b = await createSave('B', league, extras, null);
    const point = (await listRestorePoints(a))[0];
    await expect(recoverRestorePoint(b, point.id)).rejects.toThrow();
    await deleteSave(a); await updateSave(a, league, extras, null);
    expect(await getSave(a)).toBeNull(); expect(await listRestorePoints(a)).toEqual([]);
    expect(await listRestorePoints(b)).toHaveLength(1);
  });
  it('leaves the previous save intact if writing its checkpoint fails', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Safe', league, extras, null);
    await updateSave(id, { ...league, calendarDate: '2026-10-24' }, extras, null);
    const before = await getSave(id);
    const failed = vi.spyOn(savesDb.restorePoints, 'add').mockRejectedValueOnce(new Error('Storage full'));
    await expect(updateSave(id, { ...league, seasonPhase: 'playoffs' }, extras, null)).rejects.toThrow('Storage full');
    failed.mockRestore();
    expect(await getSave(id)).toEqual(before);
  });
  it('keeps a damaged latest save discoverable so an earlier point can recover it', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Damaged', league, extras, null);
    const point = (await listRestorePoints(id))[0];
    await savesDb.saves.update(id, { 'snapshot.league': null as unknown as typeof league });
    expect((await listSaves()).find(s => s.id === id)?.teamCount).toBe(0);
    const recovered = await recoverRestorePoint(id, point.id);
    expect((await getSave(recovered))?.league.teams).toEqual(league.teams);
  });
  it('preserves additive data and the controlled team in portable backups; rejects incomplete files', () => {
    const { league, extras } = fixture();
    const snapshot = { ...buildSnapshot(league, extras), controlledTeamId: league.teams[0].teamId };
    expect(parseUniverseFile(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(() => parseUniverseFile(JSON.stringify({ league: { teams: [] }, extras: {} }))).toThrow(/missing valid/);
  });
});
