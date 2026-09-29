import { useEffect, useState } from 'react';
import { totalTrophies, takeTrophyUp, TITLE_COLORS, type TrophyRewardKind } from '../../profile/trophyRoad';
import { NAME_COLORS, iconDef } from '../../profile/cosmetics';
import { THEME_BY_ID, type ThemeId } from '../../theme/themes';
import { ProfileIcon, NameTag } from '../ProfileIcon';

function Big({ kind, id }: { kind: TrophyRewardKind; id: string }) {
  if (kind === 'icon') return <div className="tu-reward"><ProfileIcon id={id} size={84} /><b>{iconDef(id).name}</b><small>Animated icon</small></div>;
  if (kind === 'color') return <div className="tu-reward"><NameTag name={NAME_COLORS.find(c => c.id === id)?.name ?? id} icon={null} color={id} className="tu-name" /><small>Animated name colour</small></div>;
  if (kind === 'titleColor') return <div className="tu-reward"><NameTag name="" icon={null} title={TITLE_COLORS.find(c => c.id === id)?.name ?? id} titleColor={id} className="tu-name" /><small>Title colour</small></div>;
  if (kind === 'title') return <div className="tu-reward"><b className="tu-title">{id}</b><small>Legendary title</small></div>;
  const t = THEME_BY_ID.get(id as ThemeId), p = t?.preview;
  return <div className="tu-reward">{p && <i className="tu-look" style={{ background: p.bg, borderColor: p.accent }}><i style={{ background: p.panel }} /><i style={{ background: p.accent }} /></i>}<b>{t?.name ?? id}</b><small>App look</small></div>;
}

/** The Trophy Road celebration: shown once on the main menu when you pass one or more stops. */
export function TrophyUnlock({ onProfile }: { onProfile?: () => void }) {
  const [up] = useState(() => takeTrophyUp(totalTrophies()));
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!up || !open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [up, open]);
  if (!up || !open) return null;
  const top = up.rewards[up.rewards.length - 1][0];
  return <div className="trophy-unlock" role="dialog" aria-modal="true" aria-labelledby="tu-head">
    <div className="tu-rays" aria-hidden="true" />
    <div className="tu-box">
      <span className="pixel-eyebrow">TROPHY ROAD</span>
      <h2 id="tu-head">{top.toLocaleString()} trophies</h2>
      <div className="tu-rewards">{up.rewards.slice(-6).map(([t, k, id]) => <Big key={`${t}-${k}-${id}`} kind={k} id={id} />)}</div>
      <div className="contest-actions">{onProfile && <button className="primary" onClick={() => { setOpen(false); onProfile(); }}>Equip it</button>}<button onClick={() => setOpen(false)}>Later</button></div>
    </div>
  </div>;
}
