import type { PlayerSeason } from './types';

export interface ScriptRunResult {
  season: PlayerSeason; // unchanged from input if an error occurred
  logs: string[];
  error: string | null;
}

/**
 * Executes user code against a deep-cloned copy of the player's season data.
 * The script mutates `player` directly (e.g. `player.attributes.offense.threePoint = 110;`),
 * mirroring exactly the shape the visual editor (FullPlayerEditor) reads and writes —
 * both editors operate on the same underlying PlayerSeason (spec section 57).
 *
 * Execution note: this runs via the Function constructor in the user's own browser
 * tab, exactly like typing into their own devtools console — it only ever touches
 * their local in-memory copy of their own data, there is no server or other user's
 * data it could reach.
 */
export function runPlayerScript(season: PlayerSeason, code: string): ScriptRunResult {
  const player: PlayerSeason = JSON.parse(JSON.stringify(season));
  const logs: string[] = [];
  const sandboxConsole = {
    log: (...args: unknown[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('player', 'console', code);
    fn(player, sandboxConsole);
    return { season: player, logs, error: null };
  } catch (err) {
    return { season, logs, error: err instanceof Error ? err.message : String(err) };
  }
}

export const CODE_MODE_EXAMPLES: { label: string; code: string }[] = [
  {
    label: 'Elite three-point shooter',
    code: `player.attributes.offense.threePoint = 110;
player.attributes.offense.corner3 = 108;
player.attributes.offense.aboveBreak3 = 110;
player.attributes.offense.catchAndShoot = 105;
player.tendencies.threePointTargets = { target: 20 };
console.log('Updated 3PT profile for', player.playerId);`,
  },
  {
    label: 'Never Turnover + Primary Ball Handler',
    code: `player.badges.push('never_turnover');
player.ballHandlerPriority = 95;
player.tendencies.ballDominance = 90;`,
  },
  {
    label: 'Conditional edit based on current rating',
    code: `if (player.attributes.offense.ballHandling > 90) {
  player.attributes.offense.speedWithBall += 10;
  console.log('Bonus applied: elite handler gets a speed-with-ball boost');
} else {
  console.log('No bonus - ball handling below threshold');
}`,
  },
  {
    label: 'Exact minutes, 9 per quarter',
    code: `player.minutes = {
  mode: 'EXACT',
  target: 36,
  perQuarter: [9, 9, 9, 9],
};`,
  },
];

export const CODE_MODE_DOCS = `
Available on the 'player' object (same shape as the visual editor):

  player.attributes.physical.{heightInches, weightLbs, speed, vertical, ...}
  player.attributes.offense.{threePoint, ballHandling, ballSecurity, passing, finishing, ...}
  player.attributes.defense.{perimeterDefense, block, steal, rimProtection, ...}
  player.attributes.mental.{clutch, playoffPerformance, consistency, ...}
  player.positions.{PG, SG, SF, PF, C}                     0-100 suitability each
  player.tendencies.shot.{corner3, aboveBreak3, pullUp3, rim, midrange, ...}
  player.tendencies.passing.{passFrequency, assistCreation, riskyPass, ...}
  player.tendencies.driving.{driveFrequency, attackCloseout, ...}
  player.tendencies.role.{primaryBallHandler, isolation, postUp, spotUpShooter, ...}
  player.tendencies.ballDominance                          0-100
  player.tendencies.threePointTargets = { target, min, max }
  player.minutes = { mode: 'AI'|'TARGET'|'EXACT'|'MANUAL', target, perQuarter: [q1,q2,q3,q4] }
  player.badges                                            array of badge id strings, e.g. push('perfect_shooter')
  player.development.{potential, developmentRate, peakAge, ...}
  player.overall = { mode: 'AUTO'|'MANUAL', manualOverall }
  player.ballHandlerPriority                                0-100

Ratings go 0-99 in Realistic mode, 0-200+ in Sandbox mode (turn on Sandbox
Mode in the top bar for values above 99 to actually take effect in simulation).

console.log(...) is captured and shown below after Run.
`.trim();
