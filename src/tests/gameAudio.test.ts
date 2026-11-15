// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { normalizeAudio, setAudio, startGameAudio, audioCue, announce } from '../audio/gameAudio';
describe('game audio', () => {
  it('bounds stored volume values and rejects invalid settings', () => {
    expect(normalizeAudio({ music: -10, effects: 500, voices: NaN })).toMatchObject({ music: 0, effects: 100, voices: 0, enabled: false });
  });
  it('creates no audio before opt-in and handles browsers without audio', async () => {
    const audio = vi.fn(); vi.stubGlobal('AudioContext', audio);
    startGameAudio(); document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    audioCue('reward'); announce('hello'); expect(audio).not.toHaveBeenCalled();
    vi.stubGlobal('AudioContext', undefined);
    expect(() => setAudio({ enabled: true })).not.toThrow();
    await Promise.resolve();
    setAudio({ enabled: false }); vi.unstubAllGlobals();
  });
  it('stops scheduling while muted or hidden and does not duplicate the music timer', async () => {
    vi.useFakeTimers();
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() };
    class FakeAudio {
      state = 'suspended'; currentTime = 0; destination = {};
      resume = vi.fn(async () => { this.state = 'running'; });
      suspend = vi.fn(async () => { this.state = 'suspended'; });
      createGain() { return { gain: param, connect: vi.fn(), disconnect: vi.fn() }; }
      createOscillator() { return { frequency: param, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }; }
    }
    vi.stubGlobal('AudioContext', FakeAudio);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    setAudio({ enabled: true }); await Promise.resolve();
    window.dispatchEvent(new Event('pointerdown')); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    setAudio({ enabled: false }); expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers(); vi.unstubAllGlobals();
  });

});
