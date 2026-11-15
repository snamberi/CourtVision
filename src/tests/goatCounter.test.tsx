// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { useGoatCounter } from '../components/GoatCounter';
vi.mock('../appMode', () => ({ IS_DESKTOP_BUILD: false }));
beforeEach(() => {
  cleanup(); document.head.querySelectorAll('script').forEach(s => s.remove());
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' });
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  delete (window as Window & { goatcounter?: unknown }).goatcounter;
});
it('loads once and sends only category paths, without automatic page tracking', () => {
  const count = vi.fn();
  const hook = renderHook(({ path }) => useGoatCounter(path), { initialProps: { path: '/game/standings' } });
  const script = document.querySelector<HTMLScriptElement>('script[data-goatcounter]')!;
  expect(script.dataset.goatcounter).toBe('https://ninefoldvision.goatcounter.com/count');
  expect(JSON.parse(script.dataset.goatcounterSettings!)).toEqual({ no_onload: true, no_events: true });
  (window as Window & { goatcounter?: unknown }).goatcounter = { count };
  act(() => script.dispatchEvent(new Event('load')));
  expect(count).toHaveBeenCalledWith({ path: '/game/standings', title: 'CourtVision', referrer: '' });
  hook.rerender({ path: '/game/standings' });
  expect(count).toHaveBeenCalledTimes(1);
  hook.rerender({ path: '/menu' });
  expect(count).toHaveBeenCalledTimes(2);
  expect(document.querySelectorAll('script[data-goatcounter]')).toHaveLength(1);
});
it('does not load with a privacy signal', () => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  renderHook(() => useGoatCounter('/menu'));
  expect(document.querySelector('script[data-goatcounter]')).toBeNull();
});
