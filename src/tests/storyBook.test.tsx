// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { newStory, currentBeat, continueStory, choose, spendTraining, choosePath, playStoryGame, JOURNAL_MAX, addJournal, type StoryState } from '../story/story';
import { Journal, People, Trophies, SeasonTrack } from '../components/story/StoryBook';
import type { CareerYear } from '../career/career';

afterEach(cleanup);

function road(seed: number): StoryState {
  let s = newStory(seed, 'Jaylen Carter', 'scorer', 'Baltimore');
  for (let g = 0; g < 300 && currentBeat(s).kind !== 'draft'; g++) {
    const b = currentBeat(s);
    if (b.kind === 'chapter') s = continueStory(s);
    else if (b.kind === 'scene') s = choose(s, b.choices(s)[0].id);
    else if (b.kind === 'train') s = spendTraining(s, 'threePoint');
    else if (b.kind === 'path') s = choosePath(s, 'juco');
    else if (b.kind === 'game') s = playStoryGame(s);
  }
  return s;
}

describe('Story Mode pages', () => {
  it('the journal records every choice and big game on the road, and stays bounded', () => {
    const s = road(4);
    const j = s.journal ?? [];
    expect(j.filter(e => e.kind === 'game')).toHaveLength(s.games.length);
    expect(j.some(e => e.kind === 'choice' && e.title === 'Signing Day' && e.pick === 'Harbor Community College')).toBe(true);
    expect(j[0].when).toMatch(/^Act 1/);
    let big = s;
    for (let i = 0; i < JOURNAL_MAX + 20; i++) big = addJournal(big, { when: 'x', title: `t${i}`, text: 'y', kind: 'season' });
    expect(big.journal).toHaveLength(JOURNAL_MAX);
    expect(big.journal!.at(-1)!.title).toBe(`t${JOURNAL_MAX + 19}`);

    render(<Journal s={s} />);
    expect(screen.getAllByText(/You chose:/).length).toBeGreaterThan(5);
    fireEvent.click(screen.getByRole('button', { name: 'Games' }));
    expect(screen.queryAllByText(/You chose:/)).toHaveLength(0);
    expect(screen.getAllByText(/ PTS, /)).toHaveLength(s.games.length);
  }, 120_000);

  it('people, the season track and the trophy case', () => {
    const s = road(5);
    render(<People s={{ ...s, flags: [...s.flags, 'mayaPro', 'dreManager'] }} ctx={null} />);
    for (const name of ['Mom', 'Maya', 'Dre', 'Coach Ray', 'Marcus "Ice" Vance']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText(/Plays in the WNBA/)).toBeTruthy();
    expect(screen.getByText(/Your manager/)).toBeTruthy();
    cleanup();

    const year = (season: string, keys: string[]): CareerYear => ({ season, age: 22, teamId: 'T', teamName: 'Team', overall: 70, stats: { gamesPlayed: 70 } as CareerYear['stats'], awards: keys.map(key => ({ key, label: key === 'mvp' ? 'Most Valuable Player' : key === 'allStar' ? 'All-Star' : 'Champion' })) as CareerYear['awards'], training: [] });
    const nba = { world: 'w', playerId: 'p', iceId: null, years: [year('2027-28', ['allStar']), year('2028-29', ['allStar', 'mvp']), year('2029-30', ['champion', 'allStar'])], stop: 'deadline' as const, queue: [], seen: [], teamId: 'T', run: [] };
    render(<Trophies s={{ ...s, flags: [...s.flags, 'stateChamp'], nba }} />);
    expect(screen.getByText('3× All-Star')).toBeTruthy();
    expect(screen.getByText('Most Valuable Player')).toBeTruthy();
    expect(screen.getByText('State champion')).toBeTruthy();
    // The biggest honour comes first.
    expect(screen.getAllByRole('listitem')[0].textContent).toMatch(/Most Valuable Player/);
    cleanup();

    render(<SeasonTrack n={nba} />);
    const stops = screen.getAllByRole('listitem');
    expect(stops).toHaveLength(11);
    expect(stops.filter(li => li.className === 'done')).toHaveLength(4);
    expect(stops.find(li => li.getAttribute('aria-current') === 'step')!.textContent).toBe('Deadline');
  }, 120_000);
});
