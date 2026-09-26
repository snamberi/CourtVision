See [Courtside Live Watch update](WATCH_GAME_UPDATE.md) for the improved court, home branding, animations, ball physics and replay controls.

See [Coaching and player development update](COACHING_DEVELOPMENT_UPDATE.md) for the new staff, training, rotations and reports.

# Ultimate Basketball Simulator — Phase 1 (Core Engine)

This is the first real, working slice of the full product vision: a basketball
sandbox where **possessions are simulated first and statistics emerge from
them** — never the reverse. Everything in this repo actually runs; nothing is
a mocked-up UI shell. Anything not yet built is listed under **What's not
built yet** below, not faked.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build (tsc -b && vite build)
npx vitest run --maxWorkers=2 --testTimeout=20000
```

## What's actually implemented

- **Data model** (`src/simulation/types.ts`): independent offense/defense/mental/
  physical attributes, positional suitability (not locked to one position),
  shot/passing/driving/role tendencies, minutes config (AI/Target/Exact/Manual),
  a data-driven badge system, development (Potential independent of Overall),
  era rules, and full `GameSettings` incl. a sandbox-mode flag and a
  deterministic seed.
- **Possession engine** (`src/simulation/engine/`):
  - `ballHandler.ts` — explicitly resolves **who has the ball** each possession,
    weighted by a user-editable `ballHandlerPriority`, not by position.
  - `turnover.ts` — opportunity-based turnover model. Elite Ball Handling +
    Ball Security + Decision Making produce a *materially* lower per-opportunity
    turnover rate — point guards are not penalized just for being point guards
    (see `tests/turnover.test.ts`).
  - `shot.ts` — make probability driven by shot-type-specific ability, contest
    level, fatigue, and clutch/playoff context — never derived from season FG%.
  - `ballHandler.ts` (block chance) / `rebound.ts` — independent Block/Steal/
    Rebound models; height nudges rebounding physics but is capped (see
    `effective.ts: heightOverallContribution`, hard-limited to ±2).
  - `fatigue.ts` — stamina-driven fatigue accumulation/recovery, bypassed by
    the Infinite Stamina badge.
  - `possession.ts` + `game.ts` — orchestrate a full game: ball-handler
    selection → action → pass/drive/shoot decision → turnover check → shot
    resolution → block check → rebound → fatigue update → next possession.
    Box scores are tallied from these events, never pre-generated.
  - `minutesScheduler.ts` — quarter-granularity substitution planner that
    converges rosters toward Target/Exact minutes (see note below).
- **Badges** (`src/simulation/badges.ts`): data-driven — badges apply
  `attributeModifiers` (dot-path deltas) and/or `flags` (e.g. `perfectShooter`,
  `neverTurnover`, `infiniteStamina`) that the engine reads generically, not a
  hard-coded switch per badge. Includes the full Normal + Experimental/Broken
  badge lists from the spec, plus a `Badge` shape ready for user-authored
  Custom Badges.
- **Local-first storage** (`src/storage/db.ts`): Dexie/IndexedDB schema with
  the override system from the spec — base `PlayerSeason` data is never
  mutated; user edits are stored as a separate patch and merged at read time
  (`getActivePlayerSeason`). Includes `exportUniverse`/`importUniverse`.
- **UI** (`src/App.tsx` + `src/components/`): a real, usable app —
  - **Player Editor** tab: sliders for Ball Handling/Ball Security/3PT, the
    explicit 3PT-tendency and Target-3PA overrides, Ball Dominance, Primary
    Ball Handler toggle, Exact/Target minutes, Potential, and (sandbox-only)
    Perfect Shooter / Never Turnover / Infinite Stamina badges.
  - **Game** tab: simulate one game, see the box score and a clickable,
    expandable **possession log** (Debug Mode-style — click any possession to
    see its full event trace and raw probabilities).
  - **Simulation Lab** tab: batch-simulate 1 / 100 / 1,000 / 10,000 games and
    see averaged PPG/RPG/APG/SPG/BPG/FG%/3P%/3PA/TOV/TS%/team win% for the
    player you just edited.
  - A **Sandbox Mode** toggle and **Seed** field are global controls in the
    top bar, per the spec's Realistic-vs-Sandbox split and deterministic-seed
    requirement.
- **Tests** (`src/tests/`, 19 passing): the exact list from spec §111 — elite
  ball handling → fewer turnovers, higher 3PT → higher 3P%, Perfect
  Shooter/Never Turnover/Infinite Stamina flags behave as absolutes, height →
  capped Overall contribution, ball-handler priority actually controls who
  touches the ball, minutes scheduling converges on targets, and a full-game
  smoke test asserting the box score total matches the possession-derived
  score exactly (i.e. stats truly emerged from play-by-play) plus
  seed-determinism.

## Known Phase-1 simplifications (intentional, not hidden)

- **Minutes scheduling is quarter-granularity**, not full clock-level
  substitution. A player's minutes converge toward their Target/Exact request
  but won't hit an arbitrary target to the second yet (e.g. 36 target with a
  12-minute quarter length lands on a multiple of 12). Tests assert
  convergence, not exact equality, and the module is isolated
  (`minutesScheduler.ts`) so it can be swapped for a real clock-driven
  scheduler without touching the possession engine.
- **Matchups are index-based** (lineup slot 1 guards lineup slot 1), not yet a
  full position-suitability-weighted matchup solver.
- **Double-team, coach tendencies, and pace** use simplified fixed
  probabilities rather than the full coach-tendency system from the spec.
- **Large simulations (1,000+ games) currently run on the main thread** with a
  cooperative `setTimeout(0)` yield to keep the UI responsive. The spec calls
  for Web Workers for this — the `SimulationLab` component is the intended
  seam to move that loop into a worker.
- **Code Mode, GM (contracts/trades/draft), League/Season/Playoffs, Legends
  historical database, and the NBA-2K data-import pipeline are not built
  yet.** These are large, separable systems (see phases below) and are not
  faked with placeholder UI.

## Architecture

```
src/
  simulation/
    types.ts          canonical data model
    badges.ts          badge library (normal + experimental + custom-ready)
    boxscore.ts         stat-line types, derived stats (TS%, eFG%)
    presets/           sample player-seasons + demo team builder
    engine/
      rng.ts            seeded PRNG (deterministic sims)
      effective.ts       badge/override resolution, sandbox clamping, height→OVR cap
      fatigue.ts
      turnover.ts
      shot.ts
      rebound.ts
      ballHandler.ts     "who has the ball" + block resolution
      minutesScheduler.ts
      possession.ts      per-possession orchestrator
      game.ts            full-game loop, box score + possession log assembly
  storage/
    db.ts               Dexie schema, override system, export/import universe
  components/           Player Editor, Box Score table, Possession Log, Sim Lab
  tests/                 vitest suite for the rules above
```

## Roadmap (per the spec's own phased plan — build order matters)

1. ✅ Core engine
2. ✅ Player Editor polish — every attribute/tendency/role/badge category as
   collapsible sections (`FullPlayerEditor`), schema-driven so every field in
   `types.ts` gets a control automatically; a searchable/sortable/filterable
   Player Database (`PlayerDatabase`); a Bulk Editor for team/position-wide
   attribute deltas.
3. ✅ Team + League — round-robin schedule generation, standings (W/L/PCT/PF/
   PA/DIFF computed from actually-simulated games), "Simulate Next Game" /
   "Simulate Remaining Season", click any played game to open its box score +
   possession log.
4. ✅ GM — contracts + salary cap math, trade proposal/validation (roster
   ownership + salary-band matching, with a sandbox "force through" override),
   free agency (sign/waive), and a draft (generated prospects with a *scouted*
   potential that's deliberately noisier than their *true* potential — real
   scouting uncertainty — worst-record-first draft order computed straight
   from the League standings).
5. ✅ Legends — a `ERA_PRESETS` table (1960s → modern) driving real rule
   differences (three-point line distance, hand-checking, zone legality,
   quarter length) that feed directly into the same `simulateGame` engine;
   `LEGEND_TEAM_TEMPLATES` for era-styled matchups. **These are explicitly
   labeled "(Generated)" and tagged `source: 'generated'` on every player —
   not official historical ratings** (see the data-provenance note in
   `legends.ts`). Swapping in a real, legally-sourced dataset later is a
   drop-in replacement for this one module.
6. ✅ Simulation Lab → Web Worker — batch simulations (1/100/1,000/10,000
   games) now run inside `src/workers/simulationWorker.ts`, so the UI thread
   never blocks even at 10,000 games. The worker just wraps a pure,
   independently-tested function (`engine/batchSimulate.ts`) — no duplicated
   logic between the worker and a hypothetical main-thread path. Also added:
   **On/Off impact** (`engine/onOff.ts`) — team net points per 100 possessions
   with the focus player on vs. off the floor, computed from the real
   possession log, not estimated — and **possession-log filtering** (by
   result type and by player) in the Game/League/Legends views.
7. ✅ Code Mode — `src/simulation/codeApi.ts` runs user scripts directly
   against the same `PlayerSeason` object the visual editor reads and writes
   (spec's "both editors operate on the same data model" requirement).
   Includes docs, four runnable examples, console.log capture, per-run error
   isolation (a throwing script leaves the player unchanged), and Undo.
8. ✅ Historical database + data import pipeline — a real, tested pipeline
   (`src/data/import/`): CSV parser → name-matching/deduplication (handles
   suffixes, accents, casing) → normalizer (estimates attributes from
   ordinary box-score stats, tagged `source: 'generated'`, never claimed as
   official) → validator (duplicate players, implausible heights, out-of-
   range percentages) → a Data Quality Report, with an `ImportPage` UI to
   paste/load a CSV and add selected players straight into a team roster.
   Per spec sections 62/130/131: no real historical ratings dataset is
   bundled (nothing legally-licensed was accessible to fetch), so this ships
   with a small fictional sample CSV that exercises every stage of the
   pipeline, including a deliberate near-duplicate and deliberately bad data
   to prove the validator actually catches them.
9. ✅ Polish — settings presets (Realistic/Balanced/Arcade/Chaos/Simulation)
   selectable from the top bar; **Export/Import Universe** as a portable JSON
   file (`storage/universeIO.ts`, round-trip tested) with no account or
   backend required; **Ctrl/Cmd+S** exports the universe instead of
   triggering the browser's save dialog; visible focus states on every
   interactive element; a responsive mobile layout (scrollable tab bar,
   stacked panels, touch-friendly controls below 720px).

Every new system should plug into the existing `Attributes` / `Tendencies` /
`Badge` / `GameSettings` shapes rather than inventing parallel ones — that's
what keeps this extensible instead of a rewrite-per-phase.

## GM realism, career stats, navigation overhaul (latest update)

This is the largest single update: the remaining 3 of the original 9 phases,
a full GM-calendar system, real player names, career-stat persistence, and a
navigation rework matching how the person actually wants to use the app.

### Remaining 3 of the original 9 phases
- **Fast Edit Mode** (`FastEditPage.tsx`, spec section 128) — a dense spreadsheet
  table, one row per player, inline-editable key ratings (3PT/Handle/Finish/
  Pass/Perim Def/Block/DReb/Potential) so dozens of players can be adjusted
  in seconds. Actual ratings stay Sandbox-gated; Potential does not.
- **Player Comparison** (`ComparePage.tsx`, spec section 79) — pick any two
  players league-wide, see Overall Ratings / Season Stats / Key Attributes
  side by side with the higher value highlighted.
- **Awards + Legacy** (`simulation/awards.ts`, `AwardsPage.tsx`) — MVP/DPOY/
  ROY computed from real accumulated `seasonStats` (a player who never played
  can't win), gated on a minimum games-played threshold, plus a transparent
  Legacy score (production accumulation + a bonus per award). This only works
  because...

### Career stats are now stored on the player's profile
- `PlayerSeason.seasonStats` (new field) accumulates real box-score totals
  every time an official league game is simulated — wired into
  `simulateNextGame` (used by both the League tab's single-game button and
  the season Web Worker), via `simulation/careerStats.ts`. Exhibition games
  intentionally do NOT count, to keep season stats meaningful.
- `PlayerProfile` now defaults to a **read-only player card** (Season Stats /
  Ratings / Badges / Awards pointer) with an explicit **"Edit Player" button**
  that reveals the full editor — matching "you should see stats/awards/
  ratings unless edit mode is on."

### Real player names
- `simulation/names.ts` generates unique, original fictional names (not real
  players) for every generated player and draft prospect — replacing the old
  `GEN00-p0`-style ids everywhere they were displayed, with zero other code
  changes needed since the UI already displayed `playerId` directly.

### GM calendar realism
- **Trade deadline**: `isTradeDeadlinePassed(league)` — trades auto-lock once
  ~65% of the schedule is played; `GMPage` shows a banner and disables the
  trade buttons.
- **Draft Day**: drafting is now gated behind an explicit `draftDayOpen` flag
  (`Start Draft Day` / `End Draft Day` button) — `draftProspect` is a no-op
  while closed.
- **Free agency window**: same pattern with `freeAgencyOpen` — `signFreeAgent`
  is a no-op while closed, with an `Open`/`Close Free Agency` toggle.
- **You can only manage your own team**: `canManageTeam(controlledTeamId,
  teamId)` gates waiving, signing, and initiating trades in the UI once a
  team is controlled (Random Players / Real League modes); sandbox/no-
  controlled-team play is unrestricted, as before.
- **Trade Block**: a league-wide list (`extras.tradeBlock`) of players any
  team has marked available, with a dedicated GM sub-tab.
- **Trade comparison**: the Trade sub-tab now shows live total trade value
  and salary for both sides as you add/remove players, with a mismatch
  indicator.
- **Randomized contracts**: `generateFullLeague`'s salary formula was made
  more nonlinear (stars can clear $40M+, fringe players sit near the
  minimum) with a random per-player component, so every generated player
  gets a distinct, plausible contract.

### Your Team tab
- `YourTeamPage.tsx` — shows **Team Overall as the literal sum** of every
  rostered player's Overall (`computeTeamOverallSum`), an average for
  context, current record, a **Contending / Retooling / Rebuilding / Bottom
  Feeder / Unproven** status heuristic (`computeTeamStatus`), and the full
  roster sorted by Overall.

### Navigation overhaul
- **Settings tab** now houses what used to be scattered in the top bar and a
  separate Game tab: Sandbox Mode, seed, presets, Save/Export/Import
  Universe, the CSV Import pipeline, the exhibition Game UI, and "Back to
  Main Menu" — one place for app-level controls instead of a cluttered
  header.
- **Clicking any player, anywhere, always opens Player Profile** — a single
  `selectPlayer(id)` handler is now threaded through the Database, Roster,
  Fast Edit, Your Team, Awards, GM (trade/free-agency/draft/trade-block
  lists), and box-score tables.
- **A persistent "Play" button** (BBGM-style) appears in the top bar whenever
  the current league has unplayed schedule games, and simulates the next one
  in a single click from anywhere in the app.

### Tests
**118 passing** (up from 96): GM calendar gating (trade deadline, draft day,
free agency window, controlled-team restriction, trade block toggle), career
stat accumulation and per-game averaging, team overall/status heuristics,
season awards eligibility and legacy scoring, plus all prior suites unchanged.

## Team chemistry, IndexedDB persistence, playoffs, and year/team/expansion draft

### Next 3 of the 9 suggested phases
- **Team chemistry** (`LeagueTeam.chemistry`, `GameSettings.teamChemistryEnabled`)
  — an optional system (spec section 90): a team's chemistry nudges
  passingIQ/decisionMaking/help-defense/defensive-awareness by up to ±6
  points without overpowering raw ability, and can be fully disabled
  (verified by test that disabling it makes a 95-chemistry and 10-chemistry
  team produce byte-identical results). A brand-new expansion team starts at
  a neutral, unproven chemistry of 50.
- **IndexedDB persistence** (`storage/autosave.ts`) — the live universe now
  autosaves to IndexedDB (debounced) while you play, independent of the
  manual Export/Import JSON flow. A "Continue Universe" button appears on
  the Main Menu whenever a save exists; a "Save" button in the top bar
  forces an immediate save. Tested against `fake-indexeddb` in Node.
- **Playoffs** (`simulation/playoffs.ts`) — seeds the top 4/8/16 teams by
  win% into a standard bracket (1v8/2v7/3v6/4v5, etc.), simulates best-of-7
  series with 2-2-1-1-1 home court and `isPlayoffs: true` (so Playoff
  Performance/Clutch actually matter), and advances winners into the correct
  next-round slot automatically. `PlayoffsPage` lets you simulate one game
  or the whole bracket and shows a live bracket + champion banner.

### Your requests: year, choose/create your team, expansion drafts
- **Season year at league creation** — the Main Menu now asks for a starting
  season label (e.g. "2026-27") alongside Trade Difficulty before generating
  a Random Players league; it's threaded through as every generated
  player-season's `season` field.
- **Choose (or create) your team** — after generating a Random Players
  league, a new `ChooseTeamScreen` lets you either take over one of the 30
  generated teams, or **create your own custom team**, which runs a real
  **expansion draft**: every existing team protects its top 8 players by
  Overall, and your new 14-man roster is drafted best-available from what's
  left (never more than one player taken from any single team per pass) —
  see `simulation/expansionDraft.ts`, fully tested. The schedule is
  regenerated afterward to include the new team, and the top bar shows
  "Your team: X" once one is set.
- **34 new tests this round** (96 total, up from 62): chemistry on/off,
  autosave round-trip/overwrite/clear, playoff bracket seeding/advancement/
  full-bracket-to-one-champion, and expansion-draft protection/roster-size/
  ownership-transfer/schedule-regeneration.

### Known limitation surfaced by this update
- `generateSeasonSchedule`'s "every team gets exactly N games" guarantee
  (tested and true for even team counts, e.g. 30) is **not** exact for odd
  counts — an expansion draft producing a 31st team will still generate a
  playable schedule, but individual teams may land a few games above or
  below the requested total that season. Worth a follow-up pass (e.g. a bye
  round make-up mechanism) if expansion becomes a repeated action rather
  than a one-time "create your team" step.

## Main Menu, full league generation, engine depth pass

This update adds three engine-depth systems plus the "full game" scaffolding
(Main Menu, 30-team generation, 82-game schedule, trade difficulty, roster
tracking) requested on top of the original 9-phase roadmap.

### Engine depth
- **Position-weighted matchups** (`engine/matchups.ts`) — defenders are now
  assigned by positional-suitability similarity (greedy nearest-match), not
  by lineup-slot index. A small guard no longer ends up "guarding" an
  opposing center just because they share array position 4.
- **Coach tendencies wired into the engine** — `LeagueTeam.coach` (pace,
  double-team frequency, etc., already in the original data model) now
  actually drives `simulateGame`: double-team probability comes from the
  defense's `doubleTeamFrequency`, and pace (seconds/possession) blends both
  teams' `paceTendency`. Verified by test that a high-pace matchup produces
  more possessions than a low-pace one with identical rosters.
- **Injuries** (`engine/injuries.ts`) — per-possession injury rolls driven by
  fatigue, Durability, and Injury Risk, bypassed by the (previously unused)
  `noInjury` badge flag. An injured player sits out the rest of the game;
  `GameSettings.injuriesEnabled`/`injuryFrequencyMultiplier` control it, off
  by default. `GameResult.injuries` lists what happened and when.

### Age, Overall, and development/aging
- `PlayerSeason` gained `age` and an optional `previousOverall` field.
- `engine/overall.ts` — a real `calculateOverall`/`calculateRatings`
  implementation (Offensive/Defensive/Shooting/Creation/Playmaking/
  Rebounding/Physical Rating + capped height contribution), replacing the
  ad-hoc inline calculation that used to live only in `PlayerProfile`.
- `engine/development.ts` — `developOffseasonPlayer` ages a player one
  season: attributes grow toward Potential before Peak Age (scaled by
  Development Rate and the Potential-minus-Overall gap) and decline at/after
  Peak Age (scaled by Decline Rate, with physical tools eroding fastest).
  Records `previousOverall` so the UI can show a Δ.

### Trade difficulty (young/high-potential harder to trade for)
- `computeTradeValue` in `gm.ts` adds a **youth premium**: value = Overall +
  (Potential-minus-Overall gap) × an age-based multiplier (1.6x at ≤22,
  down to 0.55x at 32+). A 20-year-old with a 25-point potential gap is
  worth meaningfully more than a 33-year-old at the same Overall with little
  upside — verified by test.
- `validateTrade` now checks total trade value on both sides against a
  difficulty-scaled tolerance band (Easy 45% / Normal 25% / Hard 12%), on
  top of the existing salary-matching and roster-ownership checks. A
  lopsided "young stud for equal-overall veteran" trade passes on Easy and
  is rejected on Hard.

### Full league generation, 82-game schedule, Main Menu
- `league.generateSeasonSchedule(teamIds, gamesPerTeam)` — builds a schedule
  where **every** team gets exactly `gamesPerTeam` games (verified for 30
  teams × 82 games = 1,230 total), using full round-robin cycles plus a
  partial cycle for the remainder — not an approximation.
- `leagueGenerator.generateFullLeague(seed)` — 30 fictional teams (original
  city/mascot names, not standing in for any real organization) of 18
  players each, built from six rough archetypes (star scorer, 3&D wing, rim
  protector, playmaker, stretch big, bench role player) with age-appropriate
  variance, full contracts, a generated draft class, and the 82-game
  schedule above — all reproducible from a single seed.
- `MainMenu.tsx` — the app now opens on a menu with **Random Players**
  (generates the full 30-team league above), **Real League** (jumps to
  Import Data; use "Build New League From Selected" to group your imported
  CSV rows by their Team column into real teams — no fabricated real-player
  data ships with this), and **Legends** (existing era-matchup mode). Random
  Players and Real League prompt for a **Trade Difficulty** (Easy/Normal/
  Hard) before starting, which feeds `tradeSettings.difficulty` above.
- **Season simulation moved to a Web Worker.** A synchronous 1,230-game
  season took ~67 seconds on the main thread in testing — long enough to
  freeze the tab. `workers/seasonWorker.ts` now runs "Simulate Remaining
  Season" off the main thread with a live progress bar, mirroring the
  Simulation Lab's existing worker pattern. "Simulate Next Game" (one game)
  still runs synchronously since it's cheap.
- `TeamRosterPage.tsx` — full roster table (Age, Overall, Potential, **Δ
  since the last development pass**, Trade Value) with a "Run Offseason
  Development Pass" button that ages every player in the league by one
  season via `developOffseasonPlayer`.

### Known limitation surfaced by this update
- Per-game simulation cost is roughly 50ms; fine for exhibition games and
  worker-backed batch/season runs, but a full 30-team season still takes
  ~60-90 seconds in the background. The next efficiency pass should profile
  `simulatePossession`/`resolveEffectivePlayer` (likely the `JSON.parse(
  JSON.stringify(...))` deep-clones per possession are the biggest cost) if
  season simulation needs to feel closer to instant.

## Player Profile + Sandbox-gated ratings

- **Player Profile** (`PlayerProfile.tsx`) is now the entry point for viewing
  and editing a player: an identity header (team, position, height/weight,
  data source) with quick-stat chips (OVR/POT/3PT/DEF/Badges), with the full
  editor beneath it. The "Player Editor" tab is now "Player Profile."
- **Actual ratings are locked outside Sandbox Mode.** Physical, Offense,
  Defense, Mental attributes, Development (Potential etc.), and the Manual
  Overall override are all disabled — visibly greyed out with a 🔒 notice —
  unless Sandbox Mode is on. **Tendencies (shot/passing/driving/role),
  Ball Dominance, Ball Handler Priority, Minutes, Positional Suitability, and
  Normal badges remain editable in Realistic mode**, matching how usage and
  role should be freely adjustable while a player's actual talent should not
  be hand-edited outside the sandbox. Experimental badges were already
  sandbox-gated from Phase 2 and are unaffected.
- `RatingSlider` and `AttributeGroupEditor` both gained a `disabled` prop that
  the locked sections pass through; this is presentation-layer only (the
  underlying data model didn't change), so all 59 existing tests still pass
  unmodified.

## What's new since the last update (Import pipeline + Polish)

- `src/data/import/` — `parser.ts` (dependency-free CSV parser with quoted-
  field support), `nameMatching.ts` (accent/suffix/casing-insensitive
  matching so "Marcus Whitfield" and "MARCUS WHITFIELD JR." resolve to one
  identity), `normalizer.ts` (box-score → estimated-attribute heuristics,
  always tagged `source: 'generated'`), `validate.ts` (duplicate/implausible-
  value detection), `sampleData.ts` (fictional demo CSV).
- `src/components/ImportPage.tsx` — paste or load a CSV, run the pipeline,
  read the Data Quality Report, select rows, add them to any team roster.
- `src/simulation/settingsPresets.ts` + a top-bar preset dropdown.
- `src/storage/universeIO.ts` — `downloadUniverse`/`readUniverseFromFile`,
  wired to "Export Universe" / "Import Universe" buttons and a Ctrl/Cmd+S
  shortcut. Schema-versioned from day one (spec section 60) so future saves
  can migrate forward.
- Accessibility/mobile pass: `aria-label`s on icon-only and ambiguous
  controls, visible `:focus-visible` outlines everywhere, and a responsive
  layout below 720px (scrollable tabs, stacked grids, larger touch targets).
- **59 tests passing** (up from 47): CSV parsing, name-matching edge cases,
  normalizer attribute-estimation direction and out-of-range guarding, the
  validator actually catching the sample data's deliberate duplicate and bad
  height, and a universe export/import round-trip (plus rejection of
  malformed files).
- A real bug was caught and fixed here too: the normalizer correctly
  refuses to write an implausible imported height into a player's attributes
  (defensive by design), which meant the validator's original height check
  — written against the *post-normalization* value — could never fire. Fixed
  to check the normalizer's own warning trail instead, so the "garbage in,
  never silently applied" guarantee holds without losing the ability to flag
  it in the report.

### Earlier update (Simulation Lab worker + Code Mode)

- `src/simulation/engine/batchSimulate.ts` — the pure "run N games, average
  the focus player's stats, compute on/off" logic, extracted so it's testable
  in Node (no DOM/Worker globals needed) and shareable between contexts.
- `src/workers/simulationWorker.ts` — a real Vite-bundled Web Worker (shows up
  as its own chunk in the production build) that calls the function above and
  posts `progress`/`done`/`error` messages back to the UI thread.
- `src/simulation/engine/onOff.ts` — `computeOnOffSplit`/`mergeOnOffSplits`,
  driven by two new fields on every `PossessionLogEntry`: `onCourtHome` /
  `onCourtAway` (who was actually on the floor) and
  `homeScoreAfter`/`awayScoreAfter` (running score), so on/off is derived from
  real simulated possessions, never estimated.
- `PossessionLogView` now has result-type and player-name filters, so a
  10,000-possession log from a full season is actually navigable.
- `src/simulation/codeApi.ts` + `CodeMode.tsx` — a real scripting surface: run
  a script, see console output or the exact error, Undo reverts to the
  pre-script snapshot. Docs panel lists every real path on `PlayerSeason` (no
  invented flat API — it's the actual nested shape).
- **47 tests passing** (up from 35): on/off split correctness, batch-core
  determinism and progress reporting, possession log carries on-court
  rosters, and Code Mode mutation/error/console/undo behavior.

### Earlier update (GM + Legends)

- `src/simulation/gm.ts` — `Contract`/`SalaryCapSettings` types, payroll/cap-
  space math, `validateTrade`/`executeTrade` (ownership + salary-band checks,
  with an explicit sandbox override), `signFreeAgent`/`waiveToFreeAgency`, and
  a draft (`generateDraftClass`, `draftOrderFromStandings`, `draftProspect`).
  Scouted potential is intentionally noisier than true potential — scouting
  isn't perfect information.
- `src/simulation/legends.ts` — `ERA_PRESETS` (1960s–modern) wired into
  `EraRules`, and `LEGEND_TEAM_TEMPLATES`/`buildLegendTeam` for era-styled
  matchups. Every generated player is tagged `source: 'generated'` and every
  template label says "(Generated)" — see the data-provenance note at the top
  of the file for why, and what a real historical importer would replace.
- `src/components/GMPage.tsx` — Payroll / Trade Block / Free Agency / Draft
  sub-tabs, all operating on the real GM functions above (not mocked).
- `src/components/LegendsPage.tsx` — pick two era-styled teams + a ruleset,
  simulate through the same possession engine, see the same box score +
  possession log used everywhere else.
- `src/tests/gm.test.ts` + `src/tests/legends.test.ts` — cap math, trade
  validation (rejects unowned players and >25%-mismatched salaries unless
  cap enforcement is off), trade execution actually swaps rosters/contracts,
  free agency sign/waive, draft order is worst-record-first, era rules
  produce genuinely different simulated game lengths (not a multiplied final
  score).
- **35 tests passing** (up from 22), `tsc --noEmit` clean, production build
  clean.

### Earlier update (Player Editor polish + League)

- `src/components/FullPlayerEditor.tsx` — replaces the old 3-slider demo
  editor. Every numeric field across Physical/Offense/Defense/Mental/Shot-
  Passing-Driving Tendencies/Roles/Minutes/Development is rendered via a
  schema-driven `AttributeGroupEditor`, so adding a new attribute to
  `types.ts` gives it a working slider with zero UI code. Includes the full
  Normal + Experimental badge grid (experimental disabled outside Sandbox
  Mode) and the Overall Auto/Manual override.
- `src/components/BulkEditor.tsx` — apply an attribute delta to all players,
  one team, or a position group (suitability ≥ 50) in one action (spec §69).
- `src/components/PlayerDatabase.tsx` — search, per-team filter, and sort by
  3PT/Ball Handling/Potential/Height across the whole league roster (spec
  §67, §107-109).
- `src/simulation/league.ts` + `src/components/LeaguePage.tsx` — round-robin
  schedule generator (handles odd team counts via a bye, verified by test to
  produce each pairing exactly once), standings computed purely from played
  `GameResult`s, and season simulation that reuses the exact same
  `simulateGame` engine as the exhibition Game tab — no separate "season
  math," every game in the standings was actually simulated possession by
  possession.
- `src/tests/league.test.ts` — schedule-correctness and standings-consistency
  tests (total wins == total losses == games played).
- **22 tests passing** (up from 19), full `tsc --noEmit` clean, production
  build clean.

## Windows download + advertising (added)

- `npm run package:windows` builds an offline Windows copy and zips it to `public/downloads/CourtVision-Windows.zip`.
  The small download icon (top-right corner of every screen) serves that file. Re-run this after changing the app,
  then `npm run build` for the web version.
- The Windows zip contains `Start CourtVision.bat` (double-click), `server.ps1` (tiny local web server, PowerShell only,
  no installs) and the built app. Saves live in the browser at `http://localhost:47820`.
- Ad banners are configured in `src/ads/adConfig.ts` (AdSense id and/or direct sponsors; placeholders until you edit it).
- Player ids are names, so they must stay unique: `src/simulation/playerIds.ts` and `playerIntegrity.ts` enforce and repair this.


## Build pipeline + privacy policy (added)

- `npm run build` now runs `tsc -b`, then `npm run package:windows`, then the web `vite build` - so the Windows zip served at
  `/downloads/CourtVision-Windows.zip` is rebuilt from current source on every build/deploy (any host that runs `npm run build`
  gets this automatically). The zip uses a fixed timestamp, so an unchanged app produces a byte-identical zip.
- The privacy policy lives in `src/legal/privacyPolicy.json` (edit text, the last-updated date, and `contactEmail` there).
  It renders in-app at `#/privacy` (linked from the main menu and every page footer) and as a static, crawlable
  `public/privacy.html` (regenerated by `npm run generate:legal`, which build/package run automatically).
  **Set `contactEmail` before publishing** - until then the page tells readers to use the contact details on the site.


## Cookie consent (added)

- The web build shows a cookie banner on first visit (`src/consent/ConsentBanner.tsx`) with Accept all / Reject
  non-essential / Manage preferences. Google AdSense's script is not requested until the visitor allows
  Advertising - `src/consent/consent.ts` is the single source of truth for that choice (`useConsent()`), and
  `AdBanner.tsx` / `ads/adsense.ts` both check it before loading anything from Google.
- A Global Privacy Control signal is honored automatically (treated as reject, banner hidden) without being
  saved as an explicit choice, so the visitor can still open "Cookie Settings" (in every footer) and accept.
- If you'd rather use Google's own certified consent tool (configured in AdSense > Privacy & messaging) instead
  of the built-in banner, set `googleCmp: true` in `src/ads/adConfig.ts` - the built-in banner then stays hidden
  and Google's message takes over, so visitors are only asked once.
- Fonts are bundled with the app (`@fontsource/*`, imported in `main.tsx`) instead of loaded from Google Fonts,
  so the game makes no font-CDN request and the offline Windows edition renders identically with no network.
- The Windows edition shows no banner and loads no ads, fonts, or scripts from anywhere - it's covered in
  Section 6 of the privacy policy.

**Before you publish:** the default `sponsors` in `src/ads/adConfig.ts` are all `placeholder: true` ("Your ad
here") and only render in `npm run dev` - a production build shows real ads or nothing. Add real sponsors (or
rely on AdSense) before launch if you want the sponsor slots filled.

## Page navigation and Vercel Analytics

- Saved leagues use hash URLs (`#/league/<local-save-id>/<page>`). Refresh restores that league and page;
  browser Back/Forward moves through visited game pages. Player profiles and League/Award Settings retain
  their selection. Links require the same browser's local save; they do not upload or share leagues.
- The sidebar scrolls independently and contains its wheel/touch scrolling at the top and bottom.
- Vercel Web Analytics uses `@vercel/analytics/react` (this is a Vite app, not Next.js). Enable Web Analytics
  in the Vercel project's Analytics dashboard, then redeploy with `npm run build` and output directory `dist`.
  No analytics environment variables are required for a standard Vercel deployment.
- Only page categories such as `/game/coaching` are reported, with save/player/game IDs and URL parameters
  excluded. Cookie-free Analytics is separate from advertising consent and is disabled in the Windows build.
- Development uses Vercel's development analytics mode; local preview cannot verify real dashboard ingestion.

## Dynasty update: recovery, team identity and stories

See `DYNASTY_UPDATE.md` for the full changes. Backups & recovery is in Global Settings / Import & Export
and on the main menu. Edit Team Identity is on Your Team (other teams require sandbox mode). News Feed
now includes records, rivalries, returning stars, rookie performances and Finals stories, with season/team
filters and links to profiles and games. Saved playoff brackets now survive refresh.

## Sandbox and team profiles update

- Open **Sandbox Mode** in navigation. Enabling it opens a custom pixel confirmation explaining league-wide control. The setting is saved per league; turning it off does not undo previous edits.
- God Mode, Fast Edit, Bulk Editor, Code Mode, Import/Export and Simulation Lab require Sandbox, including direct links. **Auto Play remains available**. Normal backups stay in Global Settings; a new empty Real League can still complete CSV setup.
- Outside Sandbox, coaching, signing, roster moves and finance management are limited to your team. Player editing is a Sandbox feature. Browsing other rosters stays available.
- Click a team name to open its read-only profile with coaching, roster and finances. Profiles remain read-only even in Sandbox. Player links, refresh and browser Back work from these profiles.
- **Main Menu** in navigation opens a custom Save & Exit confirmation. Cancel stays in your league. Confirm stops background simulation and saves before leaving; a failed save keeps the dialog open.
- UI emoji have been replaced with crisp pixel SVG icons.

## NBA history (Real League)

Real League can start from any NBA season from 1946–47 to 2025–26 with real players, statistics, ratings, awards and league history, plus an optional **Real Player Development** mode. See `NBA_HISTORY_UPDATE.md` for what is included, the acceptance checks and the known gaps, and `scripts/nba-history/` for the reproducible import script, sources and coverage report. Confirm the data licences before distributing the dataset publicly.

## Tutorial and Simple mode

New leagues start with a Simple menu (Home, My Team, Front Office, League, History), a coach's tour, a first-season checklist and tools that unlock as you play; every league gets a season road map on Home. Existing leagues keep the Full menu. See `TUTORIAL_UPDATE.md`.

## Speed, sidebar and style

Season and Auto Play games run in parallel on background engine workers, with identical results. The sidebar scrolls on its own, and the game has a refreshed pixel look. See `SPEED_STYLE_UPDATE.md`.

## Awards

A 100-member panel votes on the major awards (saved with each season), with a weekly award ladder, Players of the Week and Month, positional All-League teams, conference All-Stars, a Rising Stars game and Executive of the Year. Awards Night is a stage show with pixel trophies for every award, players' trophy shelves and team trophy cases, and a title celebration with the Finals MVP holding his trophy. See `AWARDS_UPDATE.md`.
