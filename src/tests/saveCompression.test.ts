import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  savesDb, createSave, updateSave, renameSave, deleteSave, listSaves, listRestorePoints, loadRestorePoint, packRestorePoints, prepareRewind,
  restorePointInfo, restorePointsSettled, refreshSaveMeta, MAX_RESTORE_POINTS, MAX_KEY_POINTS,
} from '../storage/saves';
import { packJson, unpackJson, isGzip } from '../storage/packSnapshot';
import { buildSnapshot } from '../storage/universeIO';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';

beforeEach(async () => { await restorePointsSettled(); await Promise.all([savesDb.saves.clear(), savesDb.restorePoints.clear(), savesDb.saveMeta.clear()]); });
const fixture = () => generateFullLeague(7, 6, 12, 10, '2026', { priorSeasons: false });

describe('compressed restore points', () => {
  it('packs and unpacks JSON exactly, and still reads plain bytes', async () => {
    const value = { a: [1, 2, 3], b: 'text'.repeat(500), c: { d: null } };
    const packed = await packJson(value);
    expect(isGzip(packed)).toBe(true);
    expect(packed.byteLength).toBeLessThan(JSON.stringify(value).length / 5);
    expect(await unpackJson(packed)).toEqual(value);
    expect(await unpackJson(new TextEncoder().encode('{"x":1}'))).toEqual({ x: 1 });
  });

  it('stores new points compressed, with a summary readable without unpacking', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Packed', league, extras, null);
    const played = simulateRounds(league, 4, 3);
    await updateSave(id, played, extras, null);
    await updateSave(id, { ...played, seasonPhase: 'playoffs' }, extras, null);
    await restorePointsSettled();
    const points = await listRestorePoints(id);
    expect(points.map(p => p.label)).toEqual(['Before the playoffs', 'League created']);
    for (const p of points) {
      expect(p.snapshot).toBeUndefined();
      expect(isGzip(p.packed!)).toBe(true);
    }
    const games = played.schedule.filter(g => g.played).length;
    expect(games).toBeGreaterThan(0);
    expect(restorePointInfo(points[0])).toMatchObject({ season: '2026', games });
    expect(points[0].key).toBe(true);
    expect((await loadRestorePoint(points[0])).league).toEqual(buildSnapshot(played, extras).league);
  });

  it('compresses points saved before compression existed', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Legacy points', league, extras, null);
    await restorePointsSettled();
    const snapshot = { ...buildSnapshot(league, extras), controlledTeamId: null };
    await savesDb.restorePoints.add({ id: 'old', saveId: id, createdAt: 1, sourceUpdatedAt: 1, label: 'Automatic backup', snapshot });
    const before = (await savesDb.restorePoints.get('old'))!;
    expect(restorePointInfo(before).season).toBe('2026');
    await packRestorePoints(id);
    const after = (await savesDb.restorePoints.get('old'))!;
    expect(after.snapshot).toBeUndefined();
    expect(after.info?.season).toBe('2026');
    expect((await loadRestorePoint(after)).league).toEqual(snapshot.league);
  });

  it('rewinds to a compressed point', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Rewind', league, extras, null);
    await updateSave(id, { ...league, seasonPhase: 'draft' }, extras, null);
    await restorePointsSettled();
    const draft = (await listRestorePoints(id)).find(p => p.label === 'Before the draft')!;
    expect(draft.packed).toBeDefined();
    const snap = await prepareRewind(id, draft.id);
    expect(snap.league.seasonPhase).toBeUndefined();
    expect((await listSaves())[0].season).toBe('2026');
  });

  it('keeps more backups now that they are small', () => {
    expect(MAX_RESTORE_POINTS).toBeGreaterThanOrEqual(12);
    expect(MAX_KEY_POINTS).toBeGreaterThanOrEqual(15);
  });

  it('measures a played league: rosters and history shrink most (game logs were already compressed)', async () => {
    const { league, extras } = generateFullLeague(11, 30, 15, 82, '2026', { priorSeasons: true });
    const played = simulateRounds(league, 20, 5);
    const snapshot = buildSnapshot(played, extras);
    const json = JSON.stringify(snapshot).length, packed = (await packJson(snapshot)).byteLength;
    const teams = JSON.stringify(snapshot.league.teams).length, teamsPacked = (await packJson(snapshot.league.teams)).byteLength;
    console.info(`snapshot ${(json / 1e6).toFixed(2)} MB → ${(packed / 1e6).toFixed(2)} MB (${(json / packed).toFixed(1)}×); rosters and careers ${(teams / teamsPacked).toFixed(1)}×`);
    expect(packed).toBeLessThan(json / 2);
    expect(teamsPacked).toBeLessThan(teams / 5);
  }, 120_000);
});

describe('save list summaries', () => {
  it('lists saves from small summaries and keeps them current', async () => {
    const { league, extras } = fixture();
    const a = await createSave('A', league, extras, league.teams[0].teamId);
    const b = await createSave('B', league, extras, null);
    const read = vi.spyOn(savesDb.saves, 'bulkGet');
    expect((await listSaves()).map(s => s.name).sort()).toEqual(['A', 'B']);
    expect(read).not.toHaveBeenCalled(); // no league was loaded to draw the list
    await updateSave(a, { ...league, season: '2027' }, extras, league.teams[0].teamId);
    await renameSave(b, 'Bee');
    const list = await listSaves();
    expect(list.find(s => s.id === a)).toMatchObject({ season: '2027', controlledTeamName: league.teams[0].name, teamCount: league.teams.length });
    expect(list.find(s => s.id === b)?.name).toBe('Bee');
    await deleteSave(b);
    expect((await listSaves()).map(s => s.id)).toEqual([a]);
    expect(await savesDb.saveMeta.count()).toBe(1);
    read.mockRestore();
  });

  it('rebuilds missing summaries (older saves, restored backups)', async () => {
    const { league, extras } = fixture();
    const a = await createSave('A', league, extras, null);
    await refreshSaveMeta();
    await savesDb.saves.put({ id: 'direct', name: 'Put directly', createdAt: 1, updatedAt: 5, snapshot: { ...buildSnapshot(league, extras), controlledTeamId: null } });
    const list = await listSaves();
    expect(list.map(s => s.id).sort()).toEqual([a, 'direct'].sort());
    expect(await savesDb.saveMeta.count()).toBe(2);
  });
});
