// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UndoPurchase } from '../components/qol/UndoPurchase';
import { loadoutState } from '../qol/relicLoadouts';
import { loadRelics, RELICS, slotCount } from '../relics/relics';
import { upcomingEvents } from '../qol/calendar';
import { getAccount, setAccount } from '../cloud/account';
import { diagnosticReport } from '../qol/diagnostics';
afterEach(() => {cleanup(); vi.useRealTimers(); localStorage.clear();});
it('only equips owned, unique relics within the available slots', () => {
  const state = loadRelics();
  state.owned = Object.fromEntries(RELICS.slice(0,20).map(r => [r.id,1]));
  const ids = ['missing', RELICS[0].id, ...RELICS.map(r => r.id)];
  const proposed = loadoutState(state, ids);
  expect(proposed.equipped.length).toBe(slotCount(state));
  expect(new Set(proposed.equipped).size).toBe(proposed.equipped.length);
  expect(proposed.equipped.every(id => state.owned[id] > 0)).toBe(true);
  expect(state.equipped).toEqual([]);
});
it('keeps the prior-year New Year event active across January', () => {
  const now = new Date('2027-01-02T00:00:00Z');
  const run = upcomingEvents(now).find(r => r.start.getUTCMonth() === 11 && r.end.getUTCMonth() === 0)!;
  expect(run.start < now && run.end > now).toBe(true);
  expect(upcomingEvents(run.end).every(r => r.end > run.end)).toBe(true);
});
it('diagnostics excludes unexpected private fields', () => {
  const input = {build:'test',signedIn:true,syncState:'error',online:true,localStorageAvailable:true,token:'SECRET',save:{private:true},email:'private@example.test'};
  const output = JSON.stringify(diagnosticReport(input));
  expect(output).not.toMatch(/SECRET|private|email|token/);
});
it('charges once only after the undo window', () => {
  vi.useFakeTimers(); const buy = vi.fn();
  render(<UndoPurchase accountId="a" purchase={buy}>Buy</UndoPurchase>);
  fireEvent.click(screen.getByText('Buy'));
  act(() => vi.advanceTimersByTime(7999)); expect(buy).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1)); expect(buy).toHaveBeenCalledOnce();
});
it('undo, leaving, and account switching cancel pending charges', () => {
  vi.useFakeTimers(); const buy = vi.fn();
  const view = render(<UndoPurchase accountId="a" purchase={buy}>Buy</UndoPurchase>);
  fireEvent.click(screen.getByText('Buy')); fireEvent.click(screen.getByText('Undo purchase'));
  act(() => vi.advanceTimersByTime(8000)); expect(buy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Buy'));
  view.rerender(<UndoPurchase accountId="b" purchase={buy}>Buy</UndoPurchase>);
  act(() => vi.advanceTimersByTime(8000)); expect(buy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Buy')); view.unmount();
  act(() => vi.advanceTimersByTime(8000)); expect(buy).not.toHaveBeenCalled();
});

it('does not show a previous account’s successful sync time after switching', () => {
  setAccount({ userId: 'first', status: 'signedIn' });
  setAccount({ sync: {state:'ok',at:123,message:null} });
  expect(getAccount().sync.at).toBe(123);
  setAccount({ userId: 'second' });
  expect(getAccount().sync).toEqual({state:'idle',at:null,message:null});
  setAccount({ userId:null, status:'signedOut' });
});
