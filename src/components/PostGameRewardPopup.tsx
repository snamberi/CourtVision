import { useEffect, useRef } from 'react';
import { burst, floatText, useCountUp } from '../fx/effects';
import { loadRelics, rewardOf, SECRET_BY_ID } from '../relics/relics';
import { totalXp, levelFor } from '../profile/profile';
import { RelicArt } from './relics/RelicArt';
import { PixelIcon } from './PixelIcon';
import './relics/relics.css';

export interface PostGameRewardData {
  rewardKey: string;
  xpBefore: number;
  mode: string;
  result?: string;
}

export function PostGameRewardPopup({ data, onClose }: { data: PostGameRewardData; onClose: () => void }) {
  const reward = rewardOf(loadRelics(), data.rewardKey);
  const xpNow = totalXp();
  const xpEarned = Math.max(0, xpNow - data.xpBefore);
  const levelBefore = levelFor(data.xpBefore).level;
  const levelNow = levelFor(xpNow).level;
  const leveled = levelNow > levelBefore;
  const secret = reward?.secret ? SECRET_BY_ID.get(reward.secret) : undefined;
  const won = data.result === 'won';
  const isLost = data.result === 'lost' || data.result === 'over';

  const head = useRef<HTMLHeadingElement>(null);
  const xpShown = useCountUp(xpEarned, 1100);
  // A win pops sparks off the result; a level up rises over it once the rows have landed.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (won) burst(head.current, { colors: ['#ffd166', '#55c878', '#f4f0e6'], count: 34, power: 6 });
      if (leveled) floatText(head.current, `LEVEL ${levelNow}`, '#ffd166');
    }, 380);
    return () => window.clearTimeout(t);
  }, [won, leveled, levelNow]);

  const RESULT_LABEL: Record<string, string> = { won: 'Victory', lost: 'Run Over', over: 'Run Over', retired: 'Career Over', done: 'Story Complete' };
  const resultLabel = RESULT_LABEL[data.result ?? ''] ?? 'Finished';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!leveled) return;
    try {
      type WkAudio = typeof AudioContext;
      const Ctor: WkAudio | undefined = window.AudioContext ?? (window as unknown as Record<string, unknown>)['webkitAudioContext'] as WkAudio | undefined;
      if (!Ctor) return;
      const ctx = new Ctor();
      const note = (freq: number, t: number) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
      };
      ctx.resume().then(() => { const now = ctx.currentTime; note(523, now); note(659, now + 0.12); note(784, now + 0.24); }, () => {});
      setTimeout(() => { ctx.close().catch(() => {}); }, 1400);
    } catch { /* audio not available */ }
  }, [leveled]);

  return (
    <div
      className="share-modal pgr-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="share-box pgr-box" role="dialog" aria-modal="true" aria-label="Run rewards">
        <div className="pgr-head">
          <span className="pixel-eyebrow">{data.mode.toUpperCase()}</span>
          <h2 ref={head} className={`pgr-result ${won ? 'pgr-won' : isLost ? 'pgr-lost' : 'pgr-done'}`}>{resultLabel}</h2>
        </div>
        <ul className="pgr-rows">
          {xpEarned > 0 && (
            <li className="pgr-row">
              <PixelIcon name="chart" size={18} />
              <span>XP earned</span>
              <b>+{xpShown.toLocaleString()}</b>
            </li>
          )}
          {leveled && (
            <li className="pgr-row pgr-level">
              <PixelIcon name="crown" size={18} />
              <span>Level up!</span>
              <b>{levelBefore} → {levelNow}</b>
            </li>
          )}
          {(reward?.coins ?? 0) > 0 && (
            <li className="pgr-row">
              <PixelIcon name="coin" size={18} />
              <span>Coins</span>
              <b>+{reward!.coins.toLocaleString()}</b>
            </li>
          )}
          {(reward?.spins ?? 0) > 0 && (
            <li className="pgr-row pgr-spins">
              <PixelIcon name="star" size={18} />
              <span>Relic Spins</span>
              <b>+{reward!.spins}</b>
            </li>
          )}
        </ul>
        {secret && (
          <div className="pgr-secret">
            <RelicArt id={secret.id} size={52} />
            <div className="pgr-secret-text">
              <span className="pixel-eyebrow">Secret relic uncovered</span>
              <b>{secret.name}</b>
              <small>{secret.ability}</small>
            </div>
          </div>
        )}
        <div className="pgr-actions">
          {(reward?.spins ?? 0) > 0 && (
            <button className="primary" onClick={() => { onClose(); window.location.hash = '#/relics'; }}>Spin now</button>
          )}
          <button onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}
