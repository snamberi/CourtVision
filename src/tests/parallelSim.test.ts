import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, simulateRoundPhased, type League } from '../simulation/league';
import { simulateGame } from '../simulation/engine/game';
import { autoPlayOneSeason, autoPlayOneSeasonAsync } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';
import { unpackLog } from '../simulation/logPacking';
import { copyTraining, initialTraining } from '../simulation/playerDevelopment';
import { EnginePool, type EngineJob, type EngineReply } from '../workers/enginePool';
import { runEngineJob } from '../workers/engineJob';
import { createProgressStore } from '../workers/progressStore';

/** League JSON with every game log compared by content, whether it is stored packed or not. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && 'possessionLog' in v) {
      const { possessionLog, packedLog, ...rest } = v as { possessionLog: unknown[]; packedLog?: string };
      return { ...rest, log: JSON.stringify(packedLog ? unpackLog(packedLog) : possessionLog) };
    }
    return v;
  });
}

/** An engine pool whose "workers" answer over real MessageChannels in this thread, as the browser workers do. */
function inProcessPool(size: number): EnginePool {
  const ports: MessagePort[] = [];
  for (let i = 0; i < size; i++) {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e: MessageEvent<EngineJob>) => {
      const { result, evidence } = runEngineJob(e.data.input, e.data.pack);
      channel.port1.postMessage({ id: e.data.id, result, evidence: evidence! } satisfies EngineReply);
    };
    ports.push(channel.port2);
  }
  return new EnginePool(ports);
}

const small = () => generateFullLeague(77, 10, 13, 12, '2026');

describe('parallel game days', () => {
  it('a phased day (practice all, play all, apply in order) gives exactly the sequential result', async () => {
    let seq = small().league;
    let phased = seq;
    for (let r = 0; r < 4; r++) {
      seq = simulateFullRound(seq, 99);
      phased = await simulateRoundPhased(phased, 99, async (inputs) => inputs.map((input) => ({ result: simulateGame(input) })));
    }
    expect(canonical(phased)).toBe(canonical(seq));
  });

  it('the engine pool (slimmed inputs, packed logs, a share played locally) matches too', async () => {
    let seq = small().league;
    let pooled = seq;
    const pool = inProcessPool(2);
    for (let r = 0; r < 3; r++) {
      seq = simulateFullRound(seq, 5);
      pooled = await simulateRoundPhased(pooled, 5, (inputs) => pool.run(inputs, true));
    }
    pool.close();
    expect(canonical(pooled)).toBe(canonical(seq));
    // Pool results arrive packed; the replay log is still there.
    const game = pooled.schedule.find((g) => g.played)!;
    expect(game.result!.packedLog).toBeTruthy();
    expect(unpackLog(game.result!.packedLog!).length).toBeGreaterThan(50);
  });

  it('replays an injury filed under a player\'s old team when that team plays earlier the same day', async () => {
    const base = small().league;
    const round = base.schedule.filter((g) => g.round === base.schedule[0].round);
    const oldTeam = round[0].homeTeamId;
    const newTeam = round[1].homeTeamId;
    const player = base.teams.find((t) => t.teamId === newTeam)!.seasons[0].playerId;
    const league: League = { ...base, injuries: { [player]: { playerId: player, teamId: oldTeam, severity: 'minor', gamesRemaining: 1, totalGames: 3 } } };
    const seq = simulateFullRound(league, 3);
    const phased = await simulateRoundPhased(league, 3, async (inputs) => inputs.map((input) => ({ result: simulateGame(input) })));
    expect(canonical(phased)).toBe(canonical(seq));
    // Healed by his old team's game, he played for his new one.
    const played = seq.schedule.find((g) => g.id === round[1].id)!.result!;
    expect(played.homeBox.players[player]).toBeTruthy();
  });

  it('leaves a blocked day untouched', async () => {
    const league = { ...small().league, rosterLimits: { minRosterSize: 20, maxRosterSize: 25 } };
    const same = await simulateRoundPhased(league, 1, async () => { throw new Error('should not run'); });
    expect(same).toBe(league);
  });

  it('Auto Play on engine workers ends the season in exactly the same state', async () => {
    const { league, extras } = generateFullLeague(31, 8, 13, 8, '2026');
    const teamId = league.teams[0].teamId;
    const seq = autoPlayOneSeason(league, extras, teamId, DEFAULT_AWARD_SETTINGS, 1000);
    const pool = inProcessPool(2);
    const par = await autoPlayOneSeasonAsync(league, extras, teamId, DEFAULT_AWARD_SETTINGS, 1000, (l, seed) => simulateRoundPhased(l, seed, (inputs) => pool.run(inputs, false)));
    pool.close();
    expect(canonical(par.league)).toBe(canonical(seq.league));
    expect(canonical(par.extras)).toBe(canonical(seq.extras));
    expect(par.summary).toEqual(seq.summary);
  }, 60_000);
});

describe('training copies', () => {
  it('are independent of the original wherever practice and games edit them', () => {
    const { league } = small();
    const team = league.teams[0];
    const player = team.seasons[0];
    const original = { ...initialTraining(player, team), promise: { kind: 'rotation' as const, remaining: 3, achieved: 0, required: 2, failures: 0 }, pendingChanges: { 'offense.threePoint': 0.1 } };
    const snapshot = JSON.stringify(original);
    const copy = copyTraining(original);
    expect(JSON.stringify(copy)).toBe(snapshot);
    copy.plan.mentorId = 'x'; copy.familiarity.a = 1; copy.morale.trust = 0; copy.history.push({ date: 'd', season: 's', kind: 'training', text: 't' });
    copy.evidence.games++; copy.evidence.shots.rim = { attempts: 1, makes: 1 }; copy.promise!.remaining--; copy.pendingChanges!['offense.threePoint'] = 9;
    for (const id in copy.badgeProgress) copy.badgeProgress[id].credit = -1;
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('progress store', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    const store = createProgressStore<number>();
    const seen: (number | null)[] = [];
    const off = store.subscribe(() => seen.push(store.get()));
    store.set(1); store.set(2); off(); store.set(3);
    expect(seen).toEqual([1, 2]);
    expect(store.get()).toBe(3);
  });
});
