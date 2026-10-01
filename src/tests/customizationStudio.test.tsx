// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { AvatarEditor } from '../components/AvatarEditor';
import { AppearancePanel } from '../components/AppearancePanel';
import { AVATAR_KEY, DEFAULT_AVATAR, readAvatar } from '../profile/avatar';
import { AVATAR_PRESETS_KEY, readAvatarPresets } from '../profile/avatarPresets';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { buildPlayerSprite, playerTraits, type Appearance } from '../visuals/playerSprite';

beforeEach(() => { localStorage.clear(); localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...DEFAULT_AVATAR, outfit: 'jersey-blue' })); });
afterEach(cleanup);

describe('character studio', () => {
  it('tries locked pieces without equipping or saving them, and keeps shuffle within unlocks', () => {
    render(<AvatarEditor />);
    const before = readAvatar();
    fireEvent.change(screen.getByLabelText('Filter pieces'), { target: { value: 'locked' } });
    fireEvent.click(screen.getByRole('button', { name: /Knight armour, locked/ }));
    expect(readAvatar()).toEqual(before);
    expect(screen.getByText('TRYING ON · NOT EQUIPPED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(screen.queryByText('TRYING ON · NOT EQUIPPED')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle look' }));
    expect(readAvatar().outfit).not.toBe('armor');
  });
  it('filters pieces, saves a named look, restores it, and undoes an edit', () => {
    render(<AvatarEditor />);
    const before = readAvatar();
    fireEvent.change(screen.getByLabelText('Name this look'), { target: { value: 'Courtside' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save look to slot 1' }));
    expect(readAvatarPresets()[0]).toEqual({ name: 'Courtside', look: before });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Red jersey' } });
    fireEvent.click(screen.getByRole('button', { name: 'Red jersey' }));
    expect(readAvatar().outfit).toBe('jersey-red');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(readAvatar()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Red jersey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wear Courtside' }));
    expect(readAvatar()).toEqual(before);
    cleanup(); render(<AvatarEditor />);
    expect(screen.getByRole('button', { name: 'Wear Courtside' })).toBeTruthy();
  });
  it('recovers damaged presets and refuses locked pieces in saved looks', () => {
    localStorage.setItem(AVATAR_PRESETS_KEY, '{oops');
    expect(readAvatarPresets()).toEqual([null, null, null]);
    localStorage.setItem(AVATAR_PRESETS_KEY, JSON.stringify([{ name: 'Imported', look: { ...DEFAULT_AVATAR, outfit: 'armor' } }]));
    render(<AvatarEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Wear Imported' }));
    expect(readAvatar().outfit).toBe('jersey-blue');
    expect(screen.getByText('Look loaded. Locked pieces kept their current choices.')).toBeTruthy();
  });
});

describe('player appearance studio', () => {
  it('clears custom-color overrides when choosing a palette, supports face edits, undo, and original identity', () => {
    const fixture = buildDemoTeam('A', 'Alpha').seasons[0];
    let latest = { ...fixture, appearance: { hairHex: '#abcdef' } as Appearance | undefined };
    function Harness() {
      const [player, setPlayer] = useState(latest); latest = player;
      return <AppearancePanel season={player} onChange={next => setPlayer({ ...next, appearance: next.appearance })} />;
    }
    render(<Harness />);
    const categories = within(screen.getByRole('group', { name: 'Player appearance categories' }));
    fireEvent.click(categories.getByRole('button', { name: 'Colors' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hair color 3' }));
    expect(playerTraits(fixture.playerId, latest.appearance).hair).toBe('#5a3a1a');
    expect(latest.appearance?.hairHex).toBeUndefined();
    fireEvent.click(categories.getByRole('button', { name: 'Face' }));
    fireEvent.click(screen.getByRole('button', { name: 'Focused' }));
    expect(latest.appearance?.eyeStyle).toBe('focused');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest.appearance?.eyeStyle).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restore original look' }));
    expect(latest.appearance).toBeUndefined();
  });
  it('rejects invalid imported palette indexes and renders new face choices distinctly', () => {
    const normal = playerTraits('Stephen Curry');
    expect(playerTraits('Stephen Curry', { skin: .5, hairColor: NaN, eyeColor: 99 })).toMatchObject({ skin: normal.skin, hair: normal.hair, eyeColor: normal.eyeColor });
    const options = { playerId: 'Stephen Curry', primary: '#1d428a', secondary: '#ffc72c', jerseyNumber: 30 };
    const a = buildPlayerSprite({ ...options, appearance: { eyeStyle: 'focused', expression: 'determined', hairStyle: 'waves' } });
    const b = buildPlayerSprite({ ...options, appearance: { eyeStyle: 'wide', expression: 'grin', hairStyle: 'boxBraids' } });
    expect(a).not.toEqual(b);
    expect(a.every(p => !/NaN|undefined/.test(p.d + p.fill))).toBe(true);
  });
});
