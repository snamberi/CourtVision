import { useEffect } from 'react';
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
  const lost = data.result === 'lost';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resultLabel = won ? 'Victory' : lost ? 'Run Over' : 'Finished';

  return (
    <div
      className="share-modal pgr-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="share-box pgr-box" role="dialog" aria-modal="true" aria-label="Run rewards">
        <div className="pgr-head">
          <span className="pixel-eyebrow">{data.mode.toUpperCase()}</span>
          <h2 className={`pgr-result ${won ? 'pgr-won' : lost ? 'pgr-lost' : 'pgr-done'}`}>{resultLabel}</h2>
        </div>
        <ul className="pgr-rows">
          {xpEarned > 0 && (
            <li className="pgr-row">
              <PixelIcon name="chart" size={18} />
              <span>XP earned</span>
              <b>+{xpEarned.toLocaleString()}</b>
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
              <PixelIcon name="flame" size={18} />
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
