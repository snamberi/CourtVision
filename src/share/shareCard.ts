import { buildPlayerSprite } from '../visuals/playerSprite';
import type { FrameId } from '../profile/profile';

/*
 * Share cards: a 1200x630 pixel-art image of a result (a career's legacy, a League Hunt, a Rebuild Challenge), sized
 * for Discord, Reddit and social previews. Drawn on a canvas with the game's own fonts and sprites; the site's address
 * and the Discord invite sit in the footer.
 */

export interface ShareStat { label: string; value: string }
export interface ShareCardSpec {
  kicker: string;
  title: string;
  subtitle?: string;
  /** Up to four big numbers. */
  stats: ShareStat[];
  /** Up to six short lines (trophies, moments, series results). */
  lines?: string[];
  /** A banner line, e.g. "HALL OF FAME · FIRST BALLOT". */
  badge?: string;
  /** Pixel player drawn on the right. */
  avatar?: { playerId: string; jersey?: number; primary?: string; secondary?: string };
  /** Star rating shown under the title (0-3). */
  stars?: number;
  accent?: 'orange' | 'gold' | 'red' | 'green';
  /** GM Profile cosmetic around the card (see profile.ts). */
  frame?: FrameId;
}

/** The site's own address for the footer: the production domain when the build knows it, else this page's host. */
export const siteHost = () => (import.meta.env.VITE_SITE_HOST as string | undefined) || (typeof location !== 'undefined' ? location.host : 'Court Vision');

export const CARD_W = 1200, CARD_H = 630;
const C = { bg: '#0b1018', panel: '#121926', raised: '#192333', line: '#2a3546', text: '#f4f0e6', muted: '#94a0b2', orange: '#f47b20', gold: '#ffd166', red: '#e85d5d', green: '#55c878' };
const PIXEL = "'Press Start 2P', monospace", DISPLAY = "'Oswald', 'Arial Narrow', sans-serif", UI = "'Inter', system-ui, sans-serif";

/** Truncates text to fit a width. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function drawSprite(ctx: CanvasRenderingContext2D, a: NonNullable<ShareCardSpec['avatar']>, x: number, y: number, scale: number) {
  const paths = buildPlayerSprite({ playerId: a.playerId, primary: a.primary ?? C.orange, secondary: a.secondary ?? C.text, jerseyNumber: a.jersey ?? null, pose: 'raise' });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(7,13,26,.45)';
  ctx.fillRect(7, 49, 27, 2);
  for (const p of paths) { ctx.fillStyle = p.fill; ctx.fill(new Path2D(p.d)); }
  ctx.restore();
}

/** Draws the card onto a new canvas (fonts should be loaded first; see renderShareCard). */
export function drawShareCard(spec: ShareCardSpec, site = siteHost()): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const accent = C[spec.accent ?? 'orange'];
  // Background: navy with a faint court.
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = 'rgba(244,123,32,.07)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(CARD_W - 250, CARD_H / 2, 170, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(CARD_W - 520, 40, 480, CARD_H - 80);
  // Frame with a hard pixel shadow.
  ctx.fillStyle = '#03070d'; ctx.fillRect(34, 34, CARD_W - 60, CARD_H - 60);
  ctx.fillStyle = C.panel; ctx.fillRect(26, 26, CARD_W - 60, CARD_H - 60);
  ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.strokeRect(28, 28, CARD_W - 64, CARD_H - 64);
  drawFrame(ctx, spec.frame ?? 'classic');

  const left = 64, textMax = spec.avatar ? 760 : CARD_W - 140;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent; ctx.font = `16px ${PIXEL}`;
  ctx.fillText(fit(ctx, spec.kicker.toUpperCase(), textMax), left, 86);
  ctx.fillStyle = C.text; ctx.font = `bold 64px ${DISPLAY}`;
  ctx.fillText(fit(ctx, spec.title.toUpperCase(), textMax), left, 160);
  let y = 160;
  if (spec.subtitle) { ctx.fillStyle = C.muted; ctx.font = `26px ${UI}`; ctx.fillText(fit(ctx, spec.subtitle, textMax), left, (y += 44)); }
  if (spec.stars != null) {
    ctx.font = `34px ${UI}`;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < spec.stars ? C.gold : C.line; ctx.fillText('★', left + i * 40, y + 50); }
    y += 50;
  }
  if (spec.badge) {
    y += 22;
    ctx.font = `14px ${PIXEL}`;
    const w = ctx.measureText(spec.badge).width + 28;
    ctx.fillStyle = '#2a2210'; ctx.fillRect(left, y, w, 34);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.strokeRect(left + 1, y + 1, w - 2, 32);
    ctx.fillStyle = C.gold; ctx.fillText(spec.badge, left + 14, y + 23);
    y += 34;
  }
  // Big numbers.
  const stats = spec.stats.slice(0, 4);
  if (stats.length) {
    y += 30;
    const boxW = Math.min(180, (textMax - (stats.length - 1) * 12) / stats.length);
    stats.forEach((s, i) => {
      const x = left + i * (boxW + 12);
      ctx.fillStyle = C.bg; ctx.fillRect(x, y, boxW, 96);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, boxW - 2, 94);
      ctx.fillStyle = C.muted; ctx.font = `12px ${PIXEL}`; ctx.fillText(fit(ctx, s.label.toUpperCase(), boxW - 20), x + 12, y + 26);
      ctx.fillStyle = accent === C.red ? C.text : accent; ctx.font = `bold 44px ${DISPLAY}`; ctx.fillText(fit(ctx, s.value, boxW - 20), x + 12, y + 78);
    });
    y += 96;
  }
  // Lines.
  const lines = (spec.lines ?? []).slice(0, 6);
  ctx.font = `22px ${UI}`;
  lines.forEach((l, i) => {
    const ly = y + 40 + i * 32;
    if (ly > CARD_H - 90) return;
    ctx.fillStyle = accent; ctx.fillRect(left, ly - 12, 8, 8);
    ctx.fillStyle = C.text; ctx.fillText(fit(ctx, l, textMax - 24), left + 22, ly);
  });
  if (spec.avatar) drawSprite(ctx, spec.avatar, CARD_W - 420, 110, 8);
  // Footer.
  ctx.fillStyle = C.raised; ctx.fillRect(28, CARD_H - 82, CARD_W - 64, 54);
  ctx.fillStyle = C.orange; ctx.font = `18px ${PIXEL}`; ctx.fillText('COURT VISION', left, CARD_H - 47);
  ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
  const foot = `${site} · discord.gg/5uGK5HDS8e`;
  ctx.fillText(foot, CARD_W - 64 - ctx.measureText(foot).width, CARD_H - 48);
  return canvas;
}

/** Cosmetic frames unlocked with GM Profile levels. Drawn inside the border, clear of the text and the avatar. */
function drawFrame(ctx: CanvasRenderingContext2D, frame: FrameId) {
  const x0 = 28, y0 = 28, w = CARD_W - 64, h = CARD_H - 64;
  if (frame === 'gold') {
    ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, h);
    ctx.lineWidth = 2; ctx.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
    ctx.fillStyle = C.gold; for (const [x, y] of [[x0 + 4, y0 + 4], [x0 + w - 16, y0 + 4], [x0 + 4, y0 + h - 16], [x0 + w - 16, y0 + h - 16]]) ctx.fillRect(x, y, 12, 12);
  } else if (frame === 'hardwood') {
    for (let i = 0; i < w; i += 60) { ctx.fillStyle = (i / 60) % 2 ? '#dcab6e' : '#e3b479'; ctx.fillRect(x0 + i, y0 + 2, Math.min(60, w - i), 14); ctx.fillStyle = '#a8743f'; ctx.fillRect(x0 + i, y0 + 2, 2, 14); }
    ctx.fillStyle = '#a8743f'; ctx.fillRect(x0, y0 + 9, w, 1);
    ctx.strokeStyle = '#e3b479'; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, h);
  } else if (frame === 'neon') {
    ctx.save(); ctx.shadowColor = '#3ef2ff'; ctx.shadowBlur = 18; ctx.strokeStyle = '#3ef2ff'; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, h);
    ctx.shadowColor = '#ff4fd8'; ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20); ctx.restore();
  } else if (frame === 'banner') {
    for (const [bx, label] of [[CARD_W - 150, 'CV'], [CARD_W - 100, '#1']] as const) {
      ctx.fillStyle = '#7a1f2b'; ctx.beginPath(); ctx.moveTo(bx, y0); ctx.lineTo(bx + 40, y0); ctx.lineTo(bx + 40, y0 + 90); ctx.lineTo(bx + 20, y0 + 76); ctx.lineTo(bx, y0 + 90); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.gold; ctx.font = `14px ${PIXEL}`; ctx.fillText(label, bx + 20 - ctx.measureText(label).width / 2, y0 + 44);
    }
    ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, h);
  } else if (frame === 'fire') {
    const cols = ['#e85d5d', '#f47b20', '#ffd166'];
    for (let x = x0; x < x0 + w; x += 12) {
      const t = (Math.sin(x * 0.37) + Math.sin(x * 0.113) + Math.sin(x * 0.029) + 3) / 6;
      const hgt = 12 + Math.round(t * 26 / 4) * 4;
      cols.forEach((c, i) => { const hh = hgt - i * 8; if (hh > 0) { ctx.fillStyle = c; ctx.fillRect(x + i * 2, y0 + 2, 12 - i * 4, hh); } });
    }
    ctx.strokeStyle = '#e85d5d'; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, w, h);
  }
}

/** Waits for the game's fonts, then draws. */
export async function renderShareCard(spec: ShareCardSpec): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([`16px ${PIXEL}`, `bold 64px ${DISPLAY}`, `22px ${UI}`].map(f => document.fonts.load(f)));
    await document.fonts.ready;
  } catch { /* fall back to system fonts */ }
  return drawShareCard(spec);
}

export const cardBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image.'))), 'image/png'));

/** Shares the image natively (phones), or copies it, or downloads it. Returns what happened. */
export async function shareImage(blob: Blob, fileName: string, text: string, how: 'share' | 'copy' | 'download'): Promise<'shared' | 'copied' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (how === 'share' && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  if (how !== 'download' && blob.type === 'image/png' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return 'copied'; } catch { /* fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
