// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FramePicker } from '../components/FramePicker';
import { equip } from '../profile/profile';

vi.mock('../profile/profile', async importOriginal => ({ ...await importOriginal<typeof import('../profile/profile')>(), equip: vi.fn() }));
const ctx = { level:1, rank:-1, honors:[], modes:[], supporter:false, trophies:0 };
beforeEach(() => { localStorage.clear(); vi.mocked(equip).mockClear(); });
afterEach(cleanup);

describe('frame browsing', () => {
  it('previews a locked frame without equipping it or enabling its equip button', () => {
    render(<FramePicker value="none" ctx={ctx} />);
    fireEvent.click(screen.getByRole('button',{name:/Jade Dragon\./}));
    expect(screen.getByRole('img',{name:'Jade Dragon preview'})).toBeTruthy();
    expect((screen.getByRole('button',{name:'Locked'}) as HTMLButtonElement).disabled).toBe(true);
    expect(equip).not.toHaveBeenCalled();
  });
  it('requires an explicit equip action for an unlocked preview', () => {
    render(<FramePicker value="none" ctx={{...ctx,level:30}} />);
    fireEvent.click(screen.getByRole('button',{name:/Rookie Ring\./}));
    expect(equip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Equip frame'}));
    expect(equip).toHaveBeenCalledWith({avatarFrame:'rookie'});
  });
  it('keeps owner-only cosmetics out of the public collection', () => {
    render(<FramePicker value="none" ctx={ctx} />);
    expect(screen.queryByRole('button',{name:/Sovereign\./})).toBeNull();
  });
});
