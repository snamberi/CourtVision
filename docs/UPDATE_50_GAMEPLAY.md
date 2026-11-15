# Update 50: event time, development and player detail

This continuation stays on `release/update-50`, in draft PR #47. It is not a production release.

## Event rewards and the phone

- Each active event pays one matching currency per ten minutes of focused, visible play, plus twenty at each full hour: 26 per hour before other rewards.
- Franchise, Your Career and Story time earns 50% more: 39 for a complete hour in those modes. Mixed-mode time is prorated across each milestone, not multiplied according to the mode open at payout. Fractional rewards carry forward.
- The timer does not grant offline catch-up. Progress lives with holiday state; cross-tab ticks use Web Locks where available, focus gating and a shared timestamp. The existing client-managed account merge model still applies.
- Story completion and Franchise Rebuild completion currency receive the same 50% bonus, with half-currency remainder carried between rewards.
- The event entry stays above the phone's apps, using event colors, existing pixel artwork, decorations and a live balance. When no event is active it opens the calendar.

## Achievements, statistics and navigation

- `ITS OVER 9000!!!`: reach 9,000 account XP. `77 for the Chef`: Stephen Curry scores at least 77 in a non-Sandbox league game. Progress is included in the existing synced achievement inputs; Curry checks include archived season highs and retired-player data.
- Career history adds season and lifetime totals (minutes, shooting attempts/makes, offensive/defensive rebounds, turnovers, fouls and clutch points), plus TS%, eFG%, attempt rates, AST/TO and per-36 figures. Ratios use summed totals; no invented possession estimates or unavailable advanced metrics.
- Player profiles display prominent skill-derived tags: Rebounder, 3&D, Perimeter defender, Interior defender, Scorer, Playmaker, Sharpshooter, Post scorer, Slasher and Rim protector. Tags confer no ratings bonus.
- Trading block, trade selection/comparison, incoming offers, three-team trades and free-agent rows show full current-season averages. With no current games, they fall back to the most recent played season and label it. This is not a recent-game sample.
- Pin up to eight pages, separate from phone-app pins. Pins are available in the phone, section-jump rail and Franchise header. Existing quick-jump and keyboard navigation remain available.

## Development and rivalry scoring

- Standard simulated annual development uses a distribution centered near three overall points, with rare movement up to ten. Age, minutes, work ethic, coaching settings and remaining ceiling still matter; players at their ceiling may hold steady.
- Underused players can lose about five points through lost rhythm. A rare high-work-ethic bench breakout raises the ceiling and permits an 8–10 point year; becoming a superstar still requires multiple seasons and opportunities.
- Summer development and in-season practice accumulate pending ratings. Base ratings update once at the end-of-preseason checkpoint, for rostered players and free agents, including the Career player's progress. Training evidence, familiarity, projects and workload continue during the season. Applying the checkpoint twice is harmless.
- Explicit historical Real Player Development continues to follow reference ratings, at the same preseason checkpoint. Rating locks remain respected. Manual editor changes are still explicit user edits, not automatic development.
- The league fixes one or two scoring-showcase games from established heated rivalries each season, if eligible matchups exist. The coach's first option (or the best available scorer) receives a modest capped touch/shot-creation increase. Ratings, shooting accuracy, defense, fatigue and playing-time limits remain in force; no score is guaranteed. Selected games persist in the save and have a schedule label.

## Performance and validation

Career coordinators now stay warm between successful runs; cancellation still terminates the active worker. Development copies only attributes and development fields it changes, rather than serializing entire career histories. Every game and career-history row remains present. No end-to-end speed percentage is claimed.

A 106-test regression suite across 16 files passed, followed by an additional decline/breakout balance check and focused reward/rivalry reruns, covering timed payouts and mode switching, annual development distribution, rating locks, historical trajectories, preseason application, roster transitions, Career stats, worker reuse/cancellation, achievements and rivalry limits. Production build passed, including API/site/legal generation and Windows packaging. Lint retains 58 existing warnings and no errors. Final source checks are recorded in the PR.

New visual browser checks remain unavailable because the Chromium installer failed earlier in this session. Live OAuth, multi-device saving, push-provider delivery and production deployment are not claimed verified. No SQL migration is required for this continuation. Deployment regenerates the Windows archive.
