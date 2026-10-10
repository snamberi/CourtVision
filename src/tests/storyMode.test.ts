import { describe, expect, it } from 'vitest';
import {
  newStory, currentBeat, continueStory, choose, spendTraining, choosePath, runDraft, playStoryGame, ending, overall, storyShareText, SCRIPT,
  type StoryState, type Path,
} from '../story/story';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

/** Plays the whole story with a fixed strategy: always the choice at `pick`, training in the style's best areas. */
function playThrough(seed: number, pick = 0, path: Path = 'midmajor'): StoryState {
  let s = newStory(seed, 'Jaylen Carter', 'scorer', 'Baltimore');
  for (let guard = 0; guard < 200 && !s.done; guard++) {
    const b = currentBeat(s);
    if (b.kind === 'chapter') s = continueStory(s);
    else if (b.kind === 'scene') { const cs = b.choices(s); s = choose(s, cs[Math.min(pick, cs.length - 1)].id); }
    else if (b.kind === 'train') s = spendTraining(s, (['finishing', 'threePoint', 'midRange'] as const)[s.points % 3]);
    else if (b.kind === 'path') s = choosePath(s, path);
    else if (b.kind === 'draft') s = runDraft(s);
    else if (b.kind === 'game') s = playStoryGame(s);
    else break;
  }
  return s;
}

describe('Story Mode', () => {
  it('every beat has a unique id and the script ends with an ending', () => {
    expect(new Set(SCRIPT.map(b => b.id)).size).toBe(SCRIPT.length);
    expect(SCRIPT.at(-1)!.kind).toBe('ending');
  });

  it('plays from the park to the NBA, grows the player and reaches an ending', () => {
    const s = playThrough(3);
    expect(s.done).toBe(true);
    expect(s.games.length).toBeGreaterThanOrEqual(8);
    expect(s.draft).toBeTruthy();
    expect(s.hero.age).toBeGreaterThanOrEqual(21);
    expect(overall(s)).toBeGreaterThan(overall(newStory(3, 'Jaylen Carter', 'scorer', 'Baltimore')) + 8);
    expect(s.games.every(g => g.line.min > 0)).toBe(true);
    expect(['legend', 'star', 'pro', 'grinder']).toContain(ending(s).tier);
    expect(storyShareText(s, 'https://x')).toMatch(/Story Mode/);
  }, 120_000);

  it('the overseas path skips campus scenes and plays in Europe', () => {
    const s = playThrough(5, 1, 'overseas');
    expect(s.path).toBe('overseas');
    expect(s.games.some(g => /Madrid|Olympiacos/.test(g.opp))).toBe(true);
  }, 120_000);

  it('same seed and choices, same story; different choices, different endings across runs', () => {
    expect(playThrough(9).games.map(g => g.us)).toEqual(playThrough(9).games.map(g => g.us));
    const hypes: number[] = [];
    const tiers = new Set<string>(), wins: number[] = [], ovr: number[] = [], picks: (number | null)[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const pick of [0, 1, 2]) {
      const s = playThrough(seed, pick);
      tiers.add(ending(s).tier); wins.push(s.games.filter(g => g.won).length); ovr.push(overall(s)); picks.push(s.draft?.pick ?? null); hypes.push(s.hype);
    }
    if (env.PEEK) console.log('PEEK', [...tiers].join(','), 'wins', wins.join(' '), 'ovr', ovr.join(' '), 'picks', picks.join(' '), 'hype', hypes.join(' '), 'tiers', [...tiers]);
    expect(tiers.size).toBeGreaterThanOrEqual(2);
  }, 300_000);
});
