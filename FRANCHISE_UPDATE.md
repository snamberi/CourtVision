# Court Vision — Franchise Depth Update

The pixel-art player models and interface from the previous update are preserved.

## Playing time

New simulations rotate players within quarters and track actual court time in whole seconds. Box scores show MM:SS (for example, 29:33 or 18:28). Each logged possession includes its elapsed duration, so player minutes reconcile with the five-player game clock.

Rotations respond to targets, fatigue, foul trouble, injuries, close games and late blowouts. Team depth charts determine the opening lineup. Coaches can set rotation depth and preferred stint length. Flexible targets are scaled to the available minutes; feasible EXACT quarter budgets are protected. Injuries, foul-outs and impossible minute allocations can override a plan. Overtime uses the same clock system, with a six-period safety cap for degenerate sandbox configurations.

Previously saved games retain their historical minutes. Simulate new games to see the new rotations.

## All-Star Central

Open **League → All-Star** throughout the season. Vote for up to ten eligible players and edit your ballot until the break. Fan, player and coach electorates are simulated separately, with configurable weights. Your ballot contributes one fan vote per selection.

The weighted vote selects ten starters. Coach voting selects reserves. Announce the rosters at the break, then run the three-point contest, dunk contest and All-Star game. Event results and ballots persist through navigation and saves. Exhibition box scores are included. Small leagues can skip an exhibition when fewer than ten players qualify.

The actual break now occurs when the next scheduled game reaches the configured break round. All-Star selections remain fixed in season history, and Auto Play uses the same selection and event systems. Contest random draws now use a continuous seeded generator.

## Coaching

Open **Team → Coaching** to set:

- Offensive system: Balanced, Pace & Space, Pick & Roll, Post Centric or Motion.
- Defensive scheme: Man to Man, Switch, Zone or Pressure, with coverage and foul tradeoffs.
- Rotation depth, preferred stint length and tactical tendencies.
- Offseason training focus: Balanced, Shooting, Defense or Playmaking.

Named coach traits affect offense, defense, turnover rate, fatigue and development. Locker-room relationships affect execution and evolve with wins, motivation and playing time. Coaching also applies in playoff games and normal offseason development.

## League rules

Open **Settings → League Settings → League Rules**. Search, show only changed settings, enter numbers directly, reset one section, or apply a Balanced Basketball, High-Scoring Showcase or Development League preset.

New active settings control minute variation, stint length, blowout substitutions, personal foul limits, coaching impact, All-Star availability, break timing and vote weights. Active rules are shown by default. Older saves receive defaults for newly added fields.

Championship rosters are also archived so players keep their championship credit after free agency, trades or retirement.

## Verification

- Full existing suite plus initial new tests: 424 passed across 65 test files.
- Additional automatic-season lifecycle regression: passed (425 total tests verified).
- Production build and bundled Windows build: passed.
- Browser checks: voting, coach plans, rule editing, saved-game reload, event persistence, All-Star completion and 390-pixel mobile layouts passed with no console errors.
- Clock tests reconcile every player second with logged lineups and period duration, verify deterministic seeds, EXACT quarter budgets and rotation depth.

## Running

For development, run `npm ci` and `npm run dev` in this project directory. The rebuilt Windows app is included at `public/downloads/CourtVision-Windows.zip`; extract it and use its launcher.
