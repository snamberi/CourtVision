import { describe, expect, it } from 'vitest';
import {
  newStory, currentBeat, continueStory, choose, spendTraining, choosePath, playStoryGame, overall, draftPick, migrateStory, classicEnding, SCRIPT,
  type StoryState, type Path,
} from '../story/story';
import { storyEnding } from '../story/storyNba';
import { storyRewardKey } from '../relics/rewards';

/** Plays the road to the NBA with a fixed strategy: always the choice at `pick`, training in the style's best areas. */
function playToDraft(seed: number, pick = 0, path: Path = 'midmajor'): StoryState {
  let s = newStory(seed, 'Jaylen Carter', 'scorer', 'Baltimore');
  for (let guard = 0; guard < 200 && currentBeat(s).kind !== 'draft'; guard++) {
    const b = currentBeat(s);
    if (b.kind === 'chapter') s = continueStory(s);
    else if (b.kind === 'scene') { const cs = b.choices(s); s = choose(s, cs[Math.min(pick, cs.length - 1)].id); }
    else if (b.kind === 'train') s = spendTraining(s, (['finishing', 'threePoint', 'midRange'] as const)[s.points % 3]);
    else if (b.kind === 'path') s = choosePath(s, path);
    else if (b.kind === 'game') s = playStoryGame(s);
    else break;
  }
  return s;
}

describe('Story Mode: the road to the NBA', () => {
  it('every beat has a unique id; the road ends on draft night, then the NBA years', () => {
    expect(new Set(SCRIPT.map(b => b.id)).size).toBe(SCRIPT.length);
    expect(SCRIPT.at(-1)!.kind).toBe('nba');
    expect(SCRIPT.at(-2)!.kind).toBe('draft');
  });

  it('plays from the park to draft night and grows the player', () => {
    const s = playToDraft(3);
    expect(currentBeat(s).kind).toBe('draft');
    expect(s.done).toBe(false);
    expect(s.games.length).toBeGreaterThanOrEqual(6);
    expect(s.hero.age).toBeGreaterThanOrEqual(20);
    expect(overall(s)).toBeGreaterThan(overall(newStory(3, 'Jaylen Carter', 'scorer', 'Baltimore')) + 8);
    expect(s.games.every(g => g.line.min > 0)).toBe(true);
  }, 120_000);

  it('the overseas path skips campus scenes and plays in Europe', () => {
    const s = playToDraft(5, 1, 'overseas');
    expect(s.path).toBe('overseas');
    expect(s.games.some(g => /Madrid|Olympiacos/.test(g.opp))).toBe(true);
  }, 120_000);

  it('the G League and junior college paths play their own big games', () => {
    const g = playToDraft(6, 2, 'gleague');
    expect(g.path).toBe('gleague');
    expect(g.games.some(x => /G League/.test(x.opp))).toBe(true);
    const j = playToDraft(6, 3, 'juco');
    expect(j.games.some(x => /juco|exhibition/i.test(x.opp))).toBe(true);
    // Senior year ends in exactly one of the All-American Game or Senior Night.
    for (const s of [g, j, playToDraft(2)]) expect(s.games.filter(x => x.beat === 'g-allamerican' || x.beat === 'g-senior')).toHaveLength(1);
  }, 120_000);

  it('five acts on the road; every scene offers three or four choices', () => {
    const acts = SCRIPT.filter(b => b.kind === 'chapter');
    expect(acts.map(b => b.kind === 'chapter' && b.act)).toEqual([1, 2, 3, 4, 5]);
    const s = { ...newStory(1, 'Jaylen Carter', 'scorer', 'Baltimore'), path: 'midmajor' as Path };
    for (const b of SCRIPT) if (b.kind === 'scene') {
      const n = b.choices({ ...s, bonds: { dre: 3, ray: 3, ice: 0, maya: 2 } }).length;
      expect(n, b.id).toBeGreaterThanOrEqual(3);
      expect(n, b.id).toBeLessThanOrEqual(4);
    }
  });

  it('same seed and choices, same road; different choices, different draft stock', () => {
    expect(playToDraft(9).games.map(g => g.us)).toEqual(playToDraft(9).games.map(g => g.us));
    const picks = new Set<number | null>();
    for (const seed of [1, 2, 3, 4]) for (const pick of [0, 1, 2]) picks.add(draftPick(playToDraft(seed, pick)));
    expect(picks.size).toBeGreaterThanOrEqual(3);
  }, 300_000);
});

describe('Story Mode: saves from before the NBA years', () => {
  const v1 = (at: number, extra: Partial<StoryState> = {}) => {
    const { beat: _b, v: _v, ...rest } = newStory(4, 'Old Save', 'wing', 'Oakland');
    return { ...rest, v: 1, at, ...extra };
  };
  it('a story on the road carries on at the same beat', () => {
    const s = migrateStory(v1(11))!; // the state championship
    expect(s.v).toBe(2);
    expect(s.beat).toBe('g-state');
    expect(currentBeat(s).kind).toBe('game');
    expect(migrateStory(v1(22))!.beat).toBe('draft');
  });
  it('a story in the old rookie year moves into the real NBA; a finished one keeps its ending', () => {
    const rookie = migrateStory(v1(26, { draft: { pick: 7, team: 'Utah Jazz', icePick: 2, iceTeam: 'Detroit Pistons' } }))!;
    expect(rookie.beat).toBe('nba');
    expect(currentBeat(rookie).kind).toBe('nba');
    expect(rookie.nba).toBeUndefined();
    expect(rookie.classic).toBeUndefined();
    const done = migrateStory(v1(30, { done: true, games: [{ beat: 'g-playoff', title: 'Game 7', opp: 'x', us: 100, them: 90, won: true, line: { pts: 20, reb: 5, ast: 5, stl: 1, blk: 0, fgm: 8, fga: 15, min: 30 }, grade: 'A' }] }))!;
    expect(done.done).toBe(true);
    expect(done.classic).toBe(true);
    expect(storyEnding(done)).toEqual(classicEnding(done));
    // The NBA years have their own reward.
    expect(storyRewardKey({ ...done, nba: {} })).not.toBe(storyRewardKey(done));
    expect(migrateStory({ v: 9 })).toBeNull();
    expect(migrateStory(null)).toBeNull();
  });
});
