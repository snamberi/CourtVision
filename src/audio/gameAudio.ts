export type AudioSettings = { enabled: boolean; music: number; effects: number; voices: number; track: 'chill' | 'arena' };
const KEY = 'courtvision:audio-v1';
const defaults: AudioSettings = { enabled: false, music: 25, effects: 55, voices: 0, track: 'chill' };
export function normalizeAudio(value: Partial<AudioSettings> = {}): AudioSettings {
  const level = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  return { enabled: value.enabled === true, music: level(value.music, 25), effects: level(value.effects, 55), voices: level(value.voices, 0), track: value.track === 'arena' ? 'arena' : 'chill' };
}
export function readAudio(): AudioSettings { try { return normalizeAudio(JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch { return { ...defaults }; } }
let settings = readAudio();
let ctx: AudioContext | undefined;
let mix: GainNode | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let beat = 0, lastVoice = 0, lastClick = 0;
let started = false;
export function setAudio(patch: Partial<AudioSettings>) {
  settings = normalizeAudio({ ...settings, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* session settings still work */ }
  if (!settings.enabled || !settings.voices) window.speechSynthesis?.cancel();
  if (mix && ctx) mix.gain.setTargetAtTime(settings.enabled ? 1 : 0, ctx.currentTime, .03);
  if (!settings.enabled) pause(); else void unlock();
  window.dispatchEvent(new Event('courtvision:audio-settings'));
}
function tone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
  if (!ctx || !mix || ctx.state !== 'running' || !settings.enabled || document.hidden) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), now = ctx.currentTime + delay;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(Math.max(.0001, volume), now + .008); g.gain.exponentialRampToValueAtTime(.0001, now + duration);
  o.connect(g).connect(mix); o.start(now); o.stop(now + duration + .01);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}
export function audioCue(kind: 'click' | 'navigate' | 'reward' | 'error') {
  const volume = settings.effects / 100 * .12;
  if (!volume) return;
  const notes = kind === 'reward' ? [523, 659, 784, 1047] : kind === 'error' ? [220, 165] : kind === 'navigate' ? [440, 660] : [880];
  notes.forEach((f, i) => tone(f, kind === 'click' ? .055 : .19, volume, 'triangle', i * .07));
}
export function announce(text: string) {
  if (!settings.enabled || !settings.voices || document.hidden || !ctx || ctx.state !== 'running' || !('speechSynthesis' in window) || Date.now() - lastVoice < 4500 || window.speechSynthesis.speaking) return;
  lastVoice = Date.now();
  const speech = new SpeechSynthesisUtterance(text); speech.lang = 'en-US'; speech.rate = 1.05; speech.volume = settings.voices / 100;
  window.speechSynthesis.speak(speech);
}
function musicBeat() {
  if (!settings.music) return;
  const v = settings.music / 100 * .085;
  const roots = settings.track === 'arena' ? [130.81, 155.56, 174.61, 116.54] : [130.81, 110, 87.31, 98];
  const root = roots[Math.floor(beat / 16) % roots.length];
  if (beat % 4 === 0) { tone(root / 2, .38, v * 1.6); tone(55, .1, v * 1.3); }
  if (beat % 8 === 0) [1, 1.25, 1.5].forEach(r => tone(root * r, .9, v * .45));
  if (beat % 2 === 0) tone(root * [2, 2.5, 3, 2.5][Math.floor(beat / 2) % 4], .16, v * .5, 'triangle');
  beat++;
}
async function unlock() {
  if (!settings.enabled || document.hidden) return;
  try {
    if (!ctx) { ctx = new AudioContext(); mix = ctx.createGain(); mix.connect(ctx.destination); }
    await ctx.resume();
    if (!settings.enabled || document.hidden) { pause(); return; }
    if (!timer && ctx.state === 'running') timer = setInterval(musicBeat, 180);
  } catch { /* unavailable or browser requires another gesture */ }
}
function pause() { if (timer) clearInterval(timer); timer = undefined; void ctx?.suspend().catch(() => {}); window.speechSynthesis?.cancel(); }
export function startGameAudio() {
  if (started) return; started = true;
  const gesture = () => { void unlock(); };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button,a,[role="button"],summary,input[type="checkbox"]') : null;
    if (!target || target.matches(':disabled,[aria-disabled="true"]') || Date.now() - lastClick < 65) return;
    lastClick = Date.now(); audioCue('click');
  });
  window.addEventListener('hashchange', () => audioCue('navigate'));
  window.addEventListener('courtvision:save-error', () => announce('Your save needs attention.'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else void unlock(); });
  window.addEventListener('storage', e => { if (e.key === KEY) { settings = readAudio(); if (!settings.enabled) pause(); window.dispatchEvent(new Event('courtvision:audio-settings')); } });
}
