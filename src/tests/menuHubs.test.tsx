// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MinigamesHub } from '../components/menu/MinigamesHub';
import { PlayHub } from '../components/menu/PlayHub';
import { OthersHub } from '../components/menu/OthersHub';
import { menuHash, menuSectionOf, MENU_SECTIONS } from '../menu/sections';
import { modesIn } from '../menu/modeCatalog';
import { MENU_DESIGNS, readMenuDesign, saveMenuDesign } from '../menu/design';
import { loadRelics } from '../relics/relics';
import { parseRoute } from '../navigation/routes';
import { WeeklyHub } from '../components/menu/WeeklyHub';
import { loadBoard } from '../cloud/boards';
import { weekKey } from '../retention/week';

vi.mock('../cloud/account', async (original) => ({ ...await original<typeof import('../cloud/account')>(), cloudEnabled: true }));
vi.mock('../cloud/boards', async (original) => ({ ...await original<typeof import('../cloud/boards')>(), loadBoard: vi.fn() }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('arena menu', () => {
  it('falls back to Fieldhouse for old or invalid preferences and remembers a valid choice', () => {
    localStorage.setItem('cv-menu-design', 'retired');
    expect(readMenuDesign()).toBe('fieldhouse');
    saveMenuDesign('pocket');
    expect(readMenuDesign()).toBe('pocket');
  });

  it.each(MENU_DESIGNS)('keeps the selected mode when pointing at another row in $name', ({ id }) => {
    const open = vi.fn();
    render(<PlayHub design={id} onOpen={open} onContinue={vi.fn()} saves={[]} busy={null} />);
    const hunt = screen.getByRole('button', { name: 'League Hunt' });
    fireEvent.mouseEnter(hunt);
    expect(screen.getByRole('button', { name: 'Play Franchise' })).toBeTruthy();
    fireEvent.click(hunt);
    fireEvent.mouseLeave(hunt);
    fireEvent.click(screen.getByRole('button', { name: 'Play League Hunt' }));
    expect(open.mock.lastCall?.[0].id).toBe('legends');
  });

  it('round-trips each hub through its own hash', () => {
    for (const section of MENU_SECTIONS) expect(menuSectionOf(menuHash(section.id))).toBe(section.id);
    expect(menuSectionOf('#/menu/unknown')).toBeUndefined();
  });

  it('keeps all seven modes, saved leagues and franchise variants reachable', () => {
    const open = vi.fn(), resume = vi.fn();
    render(<PlayHub onOpen={open} onContinue={resume} saves={[]} busy={null} />);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Saved leagues (0)' }));
    expect(resume).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ways to play' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Time Machine/ }));
    expect(open.mock.lastCall?.[0].action).toEqual({ kind: 'create', challenge: 'timeMachine' });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Franchise' }), { key: 'End' });
    fireEvent.click(screen.getByRole('button', { name: 'Play Your Career' }));
    expect(open.mock.lastCall?.[0].action).toEqual({ kind: 'start', mode: 'yourCareer' });
  });

  it('filters and launches every catalogued minigame and shows stored records', () => {
    localStorage.setItem('cv-arcade', JSON.stringify({ hilo: { best: 24, runs: 3, weeks: {} } }));
    localStorage.setItem('cv-street-best', '11');
    const open = vi.fn();
    render(<MinigamesHub onOpen={open} />);
    const games = modesIn('quick', 'compete').filter(e => e.action.kind === 'arcade');
    for (const game of games) {
      fireEvent.click(screen.getByRole('button', { name: game.title }));
      fireEvent.click(screen.getByRole('button', { name: `Play ${game.title}` }));
      expect(open.mock.lastCall?.[0].action).toEqual(game.action);
    }
    expect(screen.getByRole('button', { name: 'Higher or Lower' }).textContent).toContain('24');
    expect(screen.getByRole('button', { name: '3v3 Street' }).textContent).toContain('11');
    fireEvent.click(screen.getByRole('button', { name: 'Arcade (3)' }));
    expect(screen.queryByRole('button', { name: 'Daily Grid' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Play Legends Tournament' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous card' }));
    expect(screen.getByRole('button', { name: 'Play 1v1' })).toBeTruthy();
  });

  it('shows the current weekly board and opens rankings outside the clipped dashboard card', async () => {
    const rewards = vi.fn();
    vi.mocked(loadBoard).mockResolvedValue({ total: 1, you: null, rows: [
      { rank: 1, userId: 'gm-1', username: 'TopGM', score: 816, detail: '', you: false },
    ] });
    render(<WeeklyHub xp={0} busy={null} onRewards={rewards} onOpen={vi.fn()} onBoards={vi.fn()} onRebuild={vi.fn()} />);
    expect(await screen.findByText('TopGM')).toBeTruthy();
    expect(screen.getByText('816 pts')).toBeTruthy();
    expect(loadBoard).toHaveBeenCalledWith({ kind: 'weekly', board: 'rebuild', week: weekKey() }, 3);
    fireEvent.click(screen.getByRole('button', { name: /View rewards/ }));
    expect(rewards).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /View weekly boards/ }));
    expect(screen.getByRole('dialog', { name: 'Weekly leaderboard' }).closest('.arena-panel')).toBeNull();
  });

  it('opens the almanac for the league the player chooses', () => {
    const go = vi.fn();
    render(<OthersHub saves={[{ id: 'save/42', name: 'Golden State', createdAt: 1, updatedAt: 2, teamCount: 30 }]} wallet={loadRelics()}
      onOpen={go} onProfile={go} onBoards={go} onRelics={go} onCloset={go} onLocker={go} onFriendList={go}
      onRoad={go} onAchievements={go} onSettings={go} onPhone={go} />);
    fireEvent.click(screen.getByRole('button', { name: /Almanac/ }));
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: /Golden State/ });
    expect(parseRoute(link.getAttribute('href')!)).toEqual({ saveId: 'save/42', tab: 'almanac' });
  });
});
