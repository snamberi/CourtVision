import { useEffect, useState } from 'react';
import { ProfileIcon, Tinted } from '../ProfileIcon';
import { ICONS, NAME_COLORS, type Rule } from '../../profile/cosmetics';
import { useEntitlements, activeProducts } from '../../billing/billing';
import { productById, type ProductId } from '../../billing/products';
import './shop.css';

/** Products this browser has already said thank you for, so the popup shows once per purchase. */
const THANKED_KEY = 'cv-shop-thanked';
function readThanked(): string[] | null {
  try { return JSON.parse(localStorage.getItem(THANKED_KEY) ?? 'null') as string[] | null; } catch { return null; }
}
function saveThanked(list: string[]): void {
  try { localStorage.setItem(THANKED_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}
const unlocks = (id: ProductId) => (rule: Rule) => id === 'supporter' ? 'supporter' in rule : 'product' in rule && rule.product === id;
/** Pixel confetti in the product's colour and the game's. */
const CONFETTI_PIECES = 28;
/** Spreads the pieces across the width without bunching (37 is coprime with 100). */
const CONFETTI_STRIDE = 37;
const PERCENT = 100;
const DELAY_STEPS = 7;
const DELAY_STEP_S = 0.12;
const HUES = 3;
const CONFETTI = Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
  left: (i * CONFETTI_STRIDE) % PERCENT, delay: (i % DELAY_STEPS) * DELAY_STEP_S, spin: (i & 1) === 0 ? -1 : 1, hue: i % HUES,
}));

/**
 * "Thank you!" when a purchase arrives: shown once for each product, on whatever screen the player is on when the
 * webhook's record reaches the game (usually right after they come back from the checkout tab).
 */
export function ThankYouPopup({ onProfile }: { onProfile: () => void }) {
  const owned = useEntitlements();
  const [showing, setShowing] = useState<ProductId | null>(null);
  useEffect(() => {
    const active = activeProducts(owned);
    const thanked = readThanked();
    // The first time this runs, whatever is already owned was bought before the popup existed: no popup for it.
    if (thanked === null) { saveThanked(active); return; }
    const fresh = active.find(id => !thanked.includes(id));
    if (fresh) { saveThanked([...thanked, fresh]); setShowing(fresh); }
  }, [owned]);
  useEffect(() => {
    if (!showing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowing(null); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [showing]);
  if (!showing) return null;
  const p = productById(showing);
  if (!p) return null;
  const icons = ICONS.filter(i => unlocks(showing)(i.rule));
  const color = NAME_COLORS.find(c => unlocks(showing)(c.rule));
  const close = () => setShowing(null);
  return <div className="shop-modal thank-you" role="dialog" aria-modal="true" aria-labelledby="thanks-title" style={{ '--accent': p.accent } as React.CSSProperties} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="thanks-confetti" aria-hidden="true">{CONFETTI.map((c, i) => <i key={i} className={`hue-${c.hue}`} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, '--spin': c.spin } as React.CSSProperties} />)}</div>
    <div className="shop-modal-box thanks-box">
      <div className="thanks-icon">{icons[0] && <ProfileIcon id={icons[0].id} size={84} title="" />}</div>
      <p className="pixel-eyebrow">{p.name.toUpperCase()}</p>
      <h2 id="thanks-title">Thank you!</h2>
      <p>You're helping keep Court Vision free for everyone. That means a lot.</p>
      <ul className="thanks-unlocks">
        {icons.map(i => <li key={i.id}><ProfileIcon id={i.id} size={24} title="" /> {i.name} icon</li>)}
        {color && <li><Tinted css={color.css} anim={color.anim}>{color.name}</Tinted> name colour</li>}
        <li>The <b>{p.title}</b> title</li>
        {(p.id === 'noAds' || p.id === 'supporter') && <li>No ads while your pass is active</li>}
      </ul>
      <div className="shop-modal-actions">
        <button type="button" className="shop-keep" onClick={close}>Back to the game</button>
        <button type="button" className="shop-buy" autoFocus onClick={() => { close(); onProfile(); }}>Show off my new look</button>
      </div>
    </div>
  </div>;
}
