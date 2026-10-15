import { describe, expect, it } from 'vitest';
import { newStory, currentBeat, continueStory, choose, spendTraining, choosePath, playStoryGame, overall, type StoryState } from '../story/story';
import {
  enterDraft, afterDraft, toNextMoment, currentMoment, chooseNba, playNbaGame, playNbaSeries, continueNba, signNba, trainNba, nbaCard, nbaCtx, nbaOffers,
  storyEnding, storyShareText, NBA_SEASONS, NBA_DECK, type NbaRun, type NbaCtx,
} from '../story/storyNba';
import { localSim } from '../story/storySimLocal';
import type { StoryWorld } from '../story/storyStorage';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { findPlayer } from '../career/career';
import { calculateOverall } from '../simulation/engine/overall';
import { autoGeneratePlayoffBracket, currentMatchup } from '../simulation/playoffs';
import { autoPlayPlayoffStep } from '../simulation/autoPlay';

/** The scripted road (always the choice at `pick`) up to draft night. */
export function toDraftNight(seed: number, pick = 0): StoryState {
  let s = newStory(seed, 'Jaylen Carter', 'scorer', 'Baltimore');
  for (let guard = 0; guard < 200 && currentBeat(s).kind !== 'draft'; guard++) {
    const b = currentBeat(s);
    if (b.kind === 'chapter') s = continueStory(s);
    else if (b.kind === 'scene') { const cs = b.choices(s); s = choose(s, cs[Math.min(pick, cs.length - 1)].id); }
    else if (b.kind === 'train') s = spendTraining(s, (['finishing', 'threePoint', 'midRange'] as const)[s.points % 3]);
    else if (b.kind === 'path') s = choosePath(s, 'midmajor');
    else if (b.kind === 'game') s = playStoryGame(s);
  }
  return s;
}

/** A small league stopped at its draft (fast enough to play fifteen seasons in a test). */
export async function smallWorld(seed: number): Promise<StoryWorld> {
  const { league, extras } = generateFullLeague(seed, 8, 12, 14, '2026');
  return localSim.toDraft({ id: `story-${seed}`, league, extras, phase: 'inSeason' }, seed);
}

/** Plays the NBA years with a fixed strategy, every moment answered. */
export async function playCareer(start: NbaRun, pick = 0, until = (r: NbaRun) => r.s.done): Promise<NbaRun> {
  let r = start;
  for (let guard = 0; guard < 3000 && !until(r); guard++) {
    r = await toNextMoment(r, localSim);
    const m = currentMoment(r.s);
    if (!m) continue;
    if (m.kind === 'card') { const cs = nbaCard(m.id)!.choices(nbaCtx(r.s, r.world)); r = chooseNba(r, cs[Math.min(pick, cs.length - 1)].id); }
    else if (m.kind === 'game') r = await playNbaGame(r, localSim);
    else if (m.kind === 'series') r = await playNbaSeries(r, localSim);
    else if (m.kind === 'offers') r = signNba(r, nbaOffers(r).length ? 0 : null);
    else if (m.kind === 'train') r = trainNba(r, 'threePoint');
    else r = continueNba(r);
  }
  return r;
}

describe('Story Mode: the NBA years', () => {
  it('drafted into a real league, fifteen seasons stop by stop, then an ending', async () => {
    const s0 = toDraftNight(3);
    expect(currentBeat(s0).kind).toBe('draft');
    const world = await smallWorld(3);
    const entered = enterDraft(s0, world);
    expect(entered.world.extras.draftClass.some(d => d.playerId === entered.s.nba!.playerId)).toBe(true);
    const drafted = await localSim.fromDraft(entered.world, 9);
    let r = afterDraft({ s: entered.s, world: drafted.world }, drafted.picks);
    expect(r.s.beat).toBe('nba');
    expect(r.s.draft).toBeTruthy();
    expect(findPlayer(r.world.league, r.world.extras, r.s.nba!.playerId)?.teamId).toBeTruthy();
    expect(r.s.nba!.stop).toBe('camp');
    expect(currentMoment(r.s)).toEqual({ kind: 'card', id: 'vet' });
    const draftOvr = overall(r.s), draftAge = r.s.hero.age;

    // Season one: every stop, in order, with its moments.
    r = await playCareer(r, 0, x => x.s.nba!.years.length >= 1);
    const y1 = r.s.nba!.years[0];
    expect(y1.stats.gamesPlayed).toBeGreaterThan(5);
    expect(r.s.nba!.seen).toEqual(expect.arrayContaining(['vet']));
    expect(r.s.games.some(g => g.beat.startsWith('nba1-debut'))).toBe(true);

    r = await playCareer(r);
    const n = r.s.nba!;
    expect(r.s.done).toBe(true);
    expect(n.over).toBe(true);
    expect(n.years).toHaveLength(NBA_SEASONS);
    expect(n.years.filter(y => y.stats.gamesPlayed > 0).length).toBeGreaterThanOrEqual(NBA_SEASONS - 1);
    expect(r.s.hero.age).toBe(draftAge + NBA_SEASONS);
    // He grew into his prime, then age caught up with him.
    const peak = Math.max(...n.years.map(y => y.overall));
    expect(peak).toBeGreaterThan(draftOvr + 5);
    expect(n.years.at(-1)!.overall).toBeLessThan(peak);
    expect(n.seen).toEqual(expect.arrayContaining(['vet', 'dre-call', 'y2-deal']));
    expect(['legend', 'star', 'pro', 'grinder']).toContain(storyEnding(r.s).tier);
    if ((globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env.PEEK) {
      console.log('PEEK draft', r.s.draft, 'ovr', draftOvr, '| by year', n.years.map(y => `${y.age}:${y.overall}/${(y.stats.points / Math.max(1, y.stats.gamesPlayed)).toFixed(1)}${y.awards.length ? '*' + y.awards.map(a => a.key).join('+') : ''}`).join(' '),
        '| ending', storyEnding(r.s).title, '| games', r.s.games.length, '| seen', n.seen.join(','));
    }
    expect(storyShareText(r.s, 'https://x')).toMatch(/NBA seasons/);
    // The league's copy of him has the story's ratings.
    const inLeague = findPlayer(r.world.league, r.world.extras, n.playerId);
    if (inLeague) expect(Math.abs(calculateOverall(inLeague.player) - overall(r.s))).toBeLessThanOrEqual(4);
  }, 600_000);

  it('the same story and choices play the same NBA years', async () => {
    const play = async () => {
      const e = enterDraft(toDraftNight(5), await smallWorld(5));
      const d = await localSim.fromDraft(e.world, 9);
      return playCareer(afterDraft({ s: e.s, world: d.world }, d.picks), 1, x => x.s.nba!.years.length >= 2);
    };
    const [a, b] = [await play(), await play()];
    expect(a.s.nba!.years.map(y => y.stats.points)).toEqual(b.s.nba!.years.map(y => y.stats.points));
    expect(a.s.games.map(g => g.us)).toEqual(b.s.games.map(g => g.us));
  }, 600_000);

  it('the deck: eighty cards, every one can show, and each reads cleanly in every season', async () => {
    expect(NBA_DECK.length).toBeGreaterThanOrEqual(80);
    expect(new Set(NBA_DECK.map(c => c.id)).size).toBe(NBA_DECK.length);
    const e = enterDraft(toDraftNight(3), await smallWorld(3));
    const d = await localSim.fromDraft(e.world, 9);
    const base = nbaCtx(afterDraft({ s: e.s, world: d.world }, d.picks).s, d.world);
    expect(base.ice).toBeTruthy();
    const ctxFor = (year: number, high: boolean, flags: string[]): NbaCtx => ({
      ...base, year, age: 20 + year, rank: high ? 2 : year % 2 ? 8 : 13, ovr: high ? 86 : 55, gp: high ? 50 : 20, ppg: high ? 28 : 6, w: high ? 34 : 10, l: high ? 16 : 30,
      lastRecord: high ? { w: 20, l: 62 } : { w: 50, l: 32 }, iceRetired: high && year >= 10,
      contract: high ? { salary: 30e6, years: 1, extended: false, offer: 45e6, supermax: true } : null,
      ice: base.ice && { ...base.ice, teamId: high ? 'elsewhere' : base.ice.teamId },
      n: { ...base.n, seen: high ? NBA_DECK.map(c => c.id) : [] },
      s: { ...base.s, hype: high ? 20 : 0, flags, bonds: high ? { dre: 5, ray: 5, ice: 3, maya: 5 } : { dre: -2, ray: -2, ice: -2, maya: -1 } },
    });
    const clean = (text: string) => { expect(text.length).toBeGreaterThan(5); expect(text).not.toMatch(/undefined|NaN|null|\[object/); };
    const shown = new Set<string>(), flags = new Set<string>(['champion']);
    for (const pass of [0, 1]) for (let year = 1; year <= NBA_SEASONS; year++) for (const high of [false, true]) {
      const ctx = ctxFor(year, high, high && pass ? [...flags] : []);
      for (const card of NBA_DECK) {
        if (card.when && !card.when(ctx)) continue;
        shown.add(card.id);
        clean(card.text(ctx));
        const cs = card.choices(ctx);
        expect(cs.length, card.id).toBeGreaterThanOrEqual(2);
        expect(new Set(cs.map(x => x.id)).size, card.id).toBe(cs.length);
        for (const ch of cs) { clean(ch.label); clean(typeof ch.result === 'function' ? ch.result(ctx) : ch.result); if (ch.effects?.flag) flags.add(ch.effects.flag); }
      }
    }
    // A chain's later chapters need a flag an earlier choice sets: every card is reachable.
    expect(NBA_DECK.filter(c => c.stops.length && !shown.has(c.id)).map(c => c.id)).toEqual([]);
  }, 120_000);

  it('a playoff series stops before its deciding game (Game 7), then plays it', async () => {
    let stops = 0;
    for (let seed = 1; seed <= 12 && stops < 1; seed++) {
      const { league: l0, extras } = generateFullLeague(seed, 8, 12, 10, '2026');
      let league = (await localSim.stretch({ id: 'g7', league: l0, extras, phase: 'inSeason' }, { teamId: l0.teams[0].teamId, games: 1e9 }, seed)).league;
      expect(league.schedule.every(g => g.played)).toBe(true);
      league = { ...league, playoffBracket: autoGeneratePlayoffBracket(league) };
      for (const team of league.teams.map(t => t.teamId)) {
        let l = league;
        for (let guard = 0; guard < 6; guard++) {
          const id = currentMatchup(l.playoffBracket!, team);
          if (!id) break;
          const next = autoPlayPlayoffStep(l, team, seed, true);
          const sr = next.playoffBracket!.rounds.flat().find(x => x.id === id);
          if (sr && currentMatchup(next.playoffBracket!, team) === id) {
            // Stopped at 3-3: nobody has won, and the next call settles it.
            expect(sr.teamAWins).toBe(sr.gamesToWin - 1);
            expect(sr.teamBWins).toBe(sr.gamesToWin - 1);
            const done = autoPlayPlayoffStep(next, team, seed, false).playoffBracket!.rounds.flat().find(x => x.id === id)!;
            expect(done.winnerTeamId).toBeTruthy();
            expect(done.games).toHaveLength(sr.gamesToWin * 2 - 1);
            stops++;
            break;
          }
          l = next;
        }
        if (stops) break;
      }
    }
    expect(stops).toBe(1);
  }, 300_000);
});
