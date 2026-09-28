import type { League } from '../simulation/league';
import type { YearInReview } from '../simulation/yearInReview';
import type { SeasonAwards } from '../simulation/awards';
import { perGameAverages } from '../simulation/careerStats';
import { teamColors } from '../simulation/teamColors';

/*
 * The season reel: the Year in Review as a 20-second pixel video. Each scene is a few big words drawn on a canvas, so
 * the same frames play on screen and go into the GIF you can save and share.
 */

export const REEL_W = 480, REEL_H = 270;
export const SCENE_MS = 3200;

export type SceneKind = 'title' | 'record' | 'leader' | 'moment' | 'awards' | 'finish' | 'grade';
export interface Scene { kind: SceneKind; kicker: string; big: string; lines: string[]; count?: [number, number] }
export interface Reel { teamName: string; season: string; primary: string; secondary: string; champion: boolean; scenes: Scene[] }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The scenes for a season: the title, the record, the team's leader, the best game, the league awards, the finish, the grade. */
export function buildReel(league: League, review: YearInReview, awards: SeasonAwards | null): Reel {
  const team = league.teams.find(t => t.teamId === review.teamId);
  const { primary, secondary } = teamColors(review.teamId);
  const scenes: Scene[] = [{ kind: 'title', kicker: `${review.seasonYear} · YEAR IN REVIEW`, big: review.teamName, lines: ['THE SEASON IN 20 SECONDS'] }];
  scenes.push({ kind: 'record', kicker: 'THE RECORD', big: `${review.wins}-${review.losses}`, lines: [review.wins > review.losses ? 'A WINNING SEASON' : review.wins === review.losses ? 'RIGHT DOWN THE MIDDLE' : 'A ROUGH ONE'], count: [review.wins, review.losses] });
  const leader = team?.seasons.map(p => ({ p, avg: perGameAverages(p.seasonStats) })).filter(x => x.avg.gamesPlayed > 0).sort((a, b) => b.avg.ppg - a.avg.ppg)[0];
  if (leader) scenes.push({ kind: 'leader', kicker: 'LEADING SCORER', big: leader.p.playerId, lines: [`${leader.avg.ppg.toFixed(1)} PTS · ${leader.avg.rpg.toFixed(1)} REB · ${leader.avg.apg.toFixed(1)} AST`, `${leader.avg.gamesPlayed} GAMES`] });
  const m = review.moments[0];
  if (m) scenes.push({ kind: 'moment', kicker: 'BEST MOMENT', big: clip(m.title, 26), lines: wrap(m.text, 44).slice(0, 3) });
  const aw = awards ? [['MVP', awards.mvp], ['DPOY', awards.dpoy], ['ROOKIE', awards.roy]] as const : [];
  const awardLines = aw.filter(([, w]) => w).map(([k, w]) => `${k}  ${clip(w!.playerId, 22)}${w!.teamId === review.teamId ? '  (OURS)' : ''}`);
  if (awardLines.length) scenes.push({ kind: 'awards', kicker: 'AROUND THE LEAGUE', big: 'THE AWARDS', lines: awardLines });
  scenes.push({ kind: 'finish', kicker: 'HOW IT ENDED', big: review.finish === 'Champion' ? 'CHAMPIONS!' : review.finish.toUpperCase(), lines: [review.finish === 'Champion' ? 'BANNER SEASON' : review.finish === 'Missed Playoffs' ? 'NEXT YEAR.' : 'THE RUN IS OVER'] });
  scenes.push({ kind: 'grade', kicker: 'GM REPORT CARD', big: review.grade.letter, lines: review.grade.parts.slice(0, 3).map(p => `${p.label.toUpperCase()}  ${p.score}`) });
  return { teamName: review.teamName, season: review.seasonYear, primary, secondary, champion: review.finish === 'Champion', scenes };
}

export const reelLength = (r: Reel) => r.scenes.length * SCENE_MS;

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

const PIXEL = '"Press Start 2P", monospace';
const DISPLAY = 'Oswald, "Arial Narrow", sans-serif';
const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
/** Snaps to a 4 px grid so movement steps like an old console. */
const snap = (v: number) => Math.round(v / 4) * 4;

/** Draws the reel at time t (ms) on a REEL_W × REEL_H canvas. */
export function drawReel(g: CanvasRenderingContext2D, reel: Reel, time: number): void {
  // A frame's timestamp can land a hair before the start, and past the end on the last frame: keep t inside the reel.
  const t = Math.max(0, Math.min(reelLength(reel) - 1, time));
  const i = Math.min(reel.scenes.length - 1, Math.floor(t / SCENE_MS));
  const s = reel.scenes[i], local = t - i * SCENE_MS, inP = ease(local / 450), outP = ease((local - (SCENE_MS - 300)) / 300);
  // Background: navy with the team colours in scrolling diagonal stripes.
  g.fillStyle = '#0b1018'; g.fillRect(0, 0, REEL_W, REEL_H);
  g.save(); g.globalAlpha = 0.18; g.fillStyle = reel.primary;
  const shift = snap((t / 40) % 48);
  for (let x = -REEL_H; x < REEL_W + 48; x += 48) { g.beginPath(); g.moveTo(x + shift, 0); g.lineTo(x + shift + 20, 0); g.lineTo(x + shift + 20 - REEL_H, REEL_H); g.lineTo(x + shift - REEL_H, REEL_H); g.fill(); }
  g.restore();
  // Frame and the progress pips.
  g.fillStyle = reel.primary; g.fillRect(0, 0, REEL_W, 6); g.fillRect(0, REEL_H - 6, REEL_W, 6);
  reel.scenes.forEach((_, k) => { g.fillStyle = k < i ? reel.secondary : k === i ? '#f47b20' : '#2a3546'; g.fillRect(12 + k * 18, REEL_H - 20, 12, 6); });
  g.fillStyle = '#94a0b2'; g.font = `8px ${PIXEL}`; g.textAlign = 'right'; g.fillText('COURT VISION', REEL_W - 12, REEL_H - 14);
  // The scene: kicker, big words, lines, sliding in from the left and out to the right.
  const dx = snap((1 - inP) * -REEL_W * 0.6 + outP * REEL_W * 0.6);
  g.textAlign = 'center';
  g.fillStyle = '#ffd166'; g.font = `10px ${PIXEL}`; g.fillText(s.kicker, REEL_W / 2 + dx, 46);
  let big = s.big;
  if (s.count) { const k = ease(local / 1400); big = `${Math.round(s.count[0] * k)}-${Math.round(s.count[1] * k)}`; }
  const size = s.kind === 'grade' ? 110 : big.length > 18 ? 34 : big.length > 11 ? 46 : 64;
  g.font = `bold ${size}px ${DISPLAY}`; g.fillStyle = '#000'; g.fillText(big, REEL_W / 2 + dx + 4, 128 + size / 3 + 4);
  g.fillStyle = s.kind === 'finish' && reel.champion ? '#ffd166' : s.kind === 'grade' ? gradeColor(big) : '#f4f0e6';
  g.fillText(big, REEL_W / 2 + dx, 128 + size / 3);
  g.font = `9px ${PIXEL}`; g.fillStyle = '#c9ced8';
  s.lines.forEach((line, k) => { const p = ease((local - 500 - k * 180) / 350); if (p > 0) { g.globalAlpha = p; g.fillText(line, REEL_W / 2 + dx, (s.kind === 'grade' ? 196 : 178) + k * 16); g.globalAlpha = 1; } });
  // Confetti on a title.
  if (reel.champion && s.kind === 'finish') for (let k = 0; k < 40; k++) {
    const x = (k * 97 + 13) % REEL_W, y = snap(((k * 53 + local / 6) % (REEL_H + 20)) - 20);
    g.fillStyle = ['#ffd166', '#f47b20', reel.secondary, '#f4f0e6'][k % 4]; g.fillRect(x, y, 4, 4);
  }
}

const gradeColor = (letter: string) => (letter.startsWith('A') ? '#ffd166' : letter.startsWith('B') ? '#55c878' : letter.startsWith('C') ? '#4da3ff' : '#e85d5d');
