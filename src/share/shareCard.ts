import { buildPlayerSprite } from '../visuals/playerSprite';
import { cardTheme, type CardTheme } from './cardThemes';
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
  /** Game results as a strip of squares (won/lost, with bosses outlined): the 82-0 Challenge's season. */
  results?: { won: boolean; boss?: boolean }[];
  /** 9:16 for TikTok, Reels and Stories (1080 x 1920) instead of the 1200 x 630 landscape card. */
  vertical?: boolean;
}

/** The site's own address for the footer: the production domain when the build knows it, else this page's host. */
export const siteHost = () => (import.meta.env.VITE_SITE_HOST as string | undefined) || (typeof location !== 'undefined' ? location.host : 'Court Vision');

export const CARD_W = 1200, CARD_H = 630;
export const TALL_W = 1080, TALL_H = 1920;
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
  if (spec.vertical) return drawTallCard(spec, site);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const T = cardTheme(spec.frame), W = CARD_W, H = CARD_H;
  // The frame's whole-card design, then a translucent panel for the text and the frame's border.
  T.background(ctx, W, H);
  const textMax = spec.avatar ? 760 : W - 140, left = 64;
  ctx.fillStyle = T.panel; ctx.fillRect(26, 26, (spec.avatar ? 840 : W - 60), H - 60);
  T.border(ctx, 28, 28, W - 64, H - 64);
  const accent = resultColor(spec, T);
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 0;
  ctx.fillStyle = T.accent; ctx.font = `16px ${PIXEL}`;
  ctx.fillText(fit(ctx, spec.kicker.toUpperCase(), textMax), left, 86);
  ctx.fillStyle = T.text; ctx.font = `bold 64px ${DISPLAY}`;
  ctx.fillText(fit(ctx, spec.title.toUpperCase(), textMax), left, 160);
  let y = 160;
  if (spec.subtitle) { ctx.fillStyle = T.muted; ctx.font = `26px ${UI}`; ctx.fillText(fit(ctx, spec.subtitle, textMax), left, (y += 44)); }
  if (spec.stars != null) {
    ctx.font = `34px ${UI}`;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < spec.stars ? C.gold : T.line; ctx.fillText('★', left + i * 40, y + 50); }
    y += 50;
  }
  if (spec.badge) {
    y += 22;
    ctx.font = `14px ${PIXEL}`;
    const w = ctx.measureText(spec.badge).width + 28;
    ctx.fillStyle = 'rgba(42,34,16,.92)'; ctx.fillRect(left, y, w, 34);
    ctx.strokeStyle = T.accent2; ctx.lineWidth = 2; ctx.strokeRect(left + 1, y + 1, w - 2, 32);
    ctx.fillStyle = T.accent2; ctx.fillText(spec.badge, left + 14, y + 23);
    y += 34;
  }
  const stats = spec.stats.slice(0, 4);
  if (stats.length) {
    y += 30;
    const boxW = Math.min(180, (textMax - (stats.length - 1) * 12) / stats.length);
    stats.forEach((s, i) => {
      const x = left + i * (boxW + 12);
      ctx.fillStyle = T.box; ctx.fillRect(x, y, boxW, 96);
      ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, boxW - 2, 94);
      ctx.fillStyle = T.accent; ctx.fillRect(x + 1, y + 1, boxW - 2, 3);
      ctx.fillStyle = T.muted; ctx.font = `12px ${PIXEL}`; ctx.fillText(fit(ctx, s.label.toUpperCase(), boxW - 20), x + 12, y + 28);
      ctx.fillStyle = accent; ctx.font = `bold 44px ${DISPLAY}`; ctx.fillText(fit(ctx, s.value, boxW - 20), x + 12, y + 80);
    });
    y += 96;
  }
  if (spec.results?.length) { y += 16; y += drawResults(ctx, spec.results, left, y, textMax, 28); }
  const lines = (spec.lines ?? []).slice(0, spec.results?.length ? 3 : 6);
  ctx.font = `22px ${UI}`;
  lines.forEach((l, i) => {
    const ly = y + 40 + i * 32;
    if (ly > H - 90) return;
    ctx.fillStyle = T.accent; ctx.fillRect(left, ly - 12, 8, 8);
    ctx.fillStyle = T.text; ctx.fillText(fit(ctx, l, textMax - 24), left + 22, ly);
  });
  if (spec.avatar) {
    radial(ctx, W - 250, 300, 230, `${T.accent}44`);
    drawSprite(ctx, spec.avatar, W - 420, 110, 8);
    T.overAvatar?.(ctx, W - 420 + 22 * 8, 110, 8);
  }
  // Footer.
  ctx.fillStyle = T.footer; ctx.fillRect(30, H - 82, W - 68, 52);
  ctx.fillStyle = T.accent; ctx.fillRect(30, H - 82, W - 68, 2);
  ctx.fillStyle = C.orange; ctx.font = `18px ${PIXEL}`; ctx.fillText('COURT VISION', left, H - 47);
  ctx.fillStyle = T.muted; ctx.font = `20px ${UI}`;
  const foot = `${site} · discord.gg/5uGK5HDS8e`;
  ctx.fillText(foot, W - 64 - ctx.measureText(foot).width, H - 48);
  return canvas;
}

/** The colour of the big numbers: the result's colour (gold for a title, red for a loss), or the frame's. */
function resultColor(spec: ShareCardSpec, T: CardTheme): string {
  if (!spec.accent || spec.accent === 'orange') return T.accent === '#f47b20' ? C.orange : T.accent;
  return spec.accent === 'red' ? T.text : C[spec.accent];
}
function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Squares for each game result, wrapped into rows. Returns the height used. */
function drawResults(ctx: CanvasRenderingContext2D, results: NonNullable<ShareCardSpec['results']>, x: number, y: number, width: number, perRow: number): number {
  const gap = 4, size = Math.floor((width - (perRow - 1) * gap) / perRow);
  results.forEach((g, i) => {
    const cx = x + (i % perRow) * (size + gap), cy = y + Math.floor(i / perRow) * (size + gap);
    ctx.fillStyle = g.won ? C.green : C.red; ctx.fillRect(cx, cy, size, size);
    if (g.boss) { ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.strokeRect(cx + 1.5, cy + 1.5, size - 3, size - 3); }
  });
  return Math.ceil(results.length / perRow) * (size + gap);
}

/** The 9:16 card: everything stacked, big, centred, for phone screens. */
function drawTallCard(spec: ShareCardSpec, site: string): HTMLCanvasElement {
  const W = TALL_W, H = TALL_H;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const T = cardTheme(spec.frame), accent = resultColor(spec, T);
  T.background(ctx, W, H);
  ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3; ctx.shadowBlur = 0;
  ctx.fillStyle = T.panel; ctx.fillRect(60, 200, W - 120, H - 400);
  T.border(ctx, 28, 28, W - 64, H - 64);
  const mid = W / 2, max = W - 160;
  const center = (text: string, y: number) => { const t = fit(ctx, text, max); ctx.fillText(t, mid - ctx.measureText(t).width / 2, y); };
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = T.accent; ctx.font = `24px ${PIXEL}`; center(spec.kicker.toUpperCase(), 140);
  ctx.fillStyle = T.text; ctx.font = `bold 120px ${DISPLAY}`; center(spec.title.toUpperCase(), 330);
  let y = 330;
  if (spec.subtitle) { ctx.fillStyle = T.muted; ctx.font = `36px ${UI}`; center(spec.subtitle, (y += 70)); }
  if (spec.badge) {
    y += 40;
    ctx.font = `22px ${PIXEL}`;
    const w = ctx.measureText(spec.badge).width + 40;
    ctx.fillStyle = 'rgba(42,34,16,.92)'; ctx.fillRect(mid - w / 2, y, w, 52);
    ctx.strokeStyle = T.accent2; ctx.lineWidth = 3; ctx.strokeRect(mid - w / 2 + 1.5, y + 1.5, w - 3, 49);
    ctx.fillStyle = T.accent2; ctx.fillText(spec.badge, mid - w / 2 + 20, y + 36);
    y += 52;
  }
  if (spec.avatar) { const sc = spec.results?.length ? 6 : 9; radial(ctx, mid, y + 20 + 26 * sc, 26 * sc + 60, `${T.accent}55`); drawSprite(ctx, spec.avatar, mid - 22 * sc, y + 20, sc); T.overAvatar?.(ctx, mid, y + 20, sc); y += 20 + 52 * sc; }
  const stats = spec.stats.slice(0, 4);
  if (stats.length) {
    y += 30;
    const cols = stats.length > 2 ? 2 : stats.length, boxW = (max - (cols - 1) * 20) / cols, boxH = 150;
    stats.forEach((s, i) => {
      const x = 80 + (i % cols) * (boxW + 20), by = y + Math.floor(i / cols) * (boxH + 20);
      ctx.fillStyle = T.box; ctx.fillRect(x, by, boxW, boxH);
      ctx.strokeStyle = T.line; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, by + 1.5, boxW - 3, boxH - 3);
      ctx.fillStyle = T.accent; ctx.fillRect(x + 2, by + 2, boxW - 4, 4);
      ctx.fillStyle = T.muted; ctx.font = `18px ${PIXEL}`; ctx.fillText(fit(ctx, s.label.toUpperCase(), boxW - 40), x + 24, by + 46);
      ctx.fillStyle = accent; ctx.font = `bold 72px ${DISPLAY}`; ctx.fillText(fit(ctx, s.value, boxW - 40), x + 24, by + 124);
    });
    y += Math.ceil(stats.length / cols) * (boxH + 20);
  }
  if (spec.results?.length) { y += 20; y += drawResults(ctx, spec.results, 80, y, max, 21); }
  const lines = (spec.lines ?? []).slice(0, 10);
  ctx.font = `32px ${UI}`;
  lines.forEach((l, i) => {
    const ly = y + 60 + i * 48;
    if (ly > H - 150) return;
    ctx.fillStyle = T.accent; ctx.fillRect(80, ly - 18, 12, 12);
    ctx.fillStyle = T.text; ctx.fillText(fit(ctx, l, max - 40), 110, ly);
  });
  ctx.fillStyle = T.footer; ctx.fillRect(30, H - 130, W - 68, 100);
  ctx.fillStyle = T.accent; ctx.fillRect(30, H - 130, W - 68, 3);
  ctx.fillStyle = C.orange; ctx.font = `28px ${PIXEL}`; center('COURT VISION', H - 80);
  ctx.fillStyle = T.muted; ctx.font = `26px ${UI}`; center(`${site} · free in your browser`, H - 44);
  return canvas;
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
