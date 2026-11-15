import { useEffect, useState } from 'react';
import { announce, audioCue, readAudio, setAudio } from './gameAudio';
export function AudioSettings() {
  const [s, refresh] = useState(readAudio);
  useEffect(() => { const sync = () => refresh(readAudio()); window.addEventListener('courtvision:audio-settings', sync); return () => window.removeEventListener('courtvision:audio-settings', sync); }, []);
  return <section aria-label="Sound settings">
    <label className="settings-check"><input type="checkbox" checked={s.enabled} onChange={e => setAudio({ enabled: e.target.checked })} /> Enable music, menu sounds and announcer</label>
    <p>Original synth beats and optional device voices. Sound starts after you interact and pauses when this tab is hidden. Watched-game arena sound has its own switch.</p>
    <label>Background beat <select value={s.track} onChange={e => setAudio({ track: e.target.value as 'chill' | 'arena' })}><option value="chill">Chill courtside</option><option value="arena">Arena energy</option></select></label>
    {(['music', 'effects', 'voices'] as const).map(key => <label key={key} style={{ display: 'block', marginTop: 12 }}>{key === 'music' ? 'Music' : key === 'effects' ? 'Menu effects' : 'Announcer voice'}: {s[key]}% <input aria-label={`${key} volume`} type="range" min="0" max="100" value={s[key]} onChange={e => setAudio({ [key]: Number(e.target.value) })} /></label>)}
    <div className="hunt-pills"><button disabled={!s.enabled} onClick={() => audioCue('reward')}>Test celebration</button><button disabled={!s.enabled || !s.voices} onClick={() => announce('Welcome to Court Vision. Let’s play basketball!')}>Test voice</button></div>
    <small>Set any slider to zero to mute it. Voice availability and pronunciation depend on your browser.</small>
  </section>;
}
