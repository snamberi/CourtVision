# Faster simulation, sidebar scrolling and visual refresh

## Faster seasons and Auto Play

Measured on the production build in Chromium on a 2-core test machine (Random Players league, 30 teams, 82 games):

| | Before | After |
|---|---|---|
| Play › Rest of Season (whole regular season) | 40.0 s | 25.0 s |
| Auto Play, 2 seasons | 85.5 s | 34.3 s |
| Simulation memory with engine workers (Node, full season) | ~600–840 MB heap | ~100–160 MB heap |

Season and Auto Play games now run in parallel, one engine worker per spare core (up to 8). Machines with more cores should gain more than shown above, but only a 2-core machine was available to measure.

**Results are unchanged.** For the same league and seed, every game, stat, injury, trade, award and saved field comes out identical:
- a full regular season, including the All-Star break and AI trades;
- two Auto Play seasons, including the offseason.

Automated tests check this against the one-game-at-a-time path.

### What changed

1. **Training no longer deep-clones.** Every player's training record was copied with `structuredClone` on every practice day. It is now a targeted copy of the parts that change: history entries are shared, because they are only ever appended. This removed about a fifth of all simulation time, and the heap no longer grows season after season. (`playerDevelopment.ts`: `copyTraining`)
2. **Games in a day run in parallel.** A game day's games involve different teams. The season is simulated by:
   - practising every team first;
   - running the games on a pool of engine workers;
   - applying the results in schedule order.

   This gives exactly what one game at a time does. One cross-game link exists: an injury record still filed under a player's old team, ticked by that team's game earlier the same day. It is replayed while preparing. (`simulateRoundPhased` in `league.ts`, `workers/enginePool.ts`, `workers/gameWorker.ts`, `workers/engineJob.ts`)
   - Engine workers also compute the development evidence and pack the replay log, so the thread applying results stays light.
   - The coordinating worker plays its own share of each day, so even a 2-core machine runs two games at once.
   - Only the training fields the engine reads are sent to engine workers.
   - Single-core machines, or browsers that can't start workers, fall back to the old path.
   - `localStorage['cv-engine-workers']` overrides the worker count; `0` turns parallel simulation off.
3. **Auto Play doesn't keep replay logs.** Its games are never replayed (the season rolls over), so their logs are neither packed nor kept.
4. **Engine clean-ups with identical output:**
   - rotation candidates are scored once per review, not on every sort comparison;
   - the EXACT-minutes checks are skipped when nobody has an EXACT budget;
   - per-possession stat accumulation no longer allocates arrays;
   - fatigue multipliers are worked out once per game.
5. **Smoother UI during simulations.** Season progress now lives outside React state, so progress updates re-render only the Play button, not the whole screen. The button shows the percentage ("Simulating… 42%").

## Sidebar

- The sidebar has its own scroll area with a visible pixel scrollbar. The brand and the Simple/Full switch stay pinned at the top, and Main Menu at the bottom.
- Soft shadows at the top and bottom edges show when there is more menu to scroll to.
- Changing page scrolls the current menu entry into view.
- On small screens, the Play button hides while the menu is open.

## Visual refresh (same palette and fonts)

- **Scoreboard header:** your team's logo, name and conference rank, the season phase, your record in LED digits, and an LED date.
- **Arena floor:** a faint court grid and warm light at the top of the page.
- **Panels:** a lit top edge, a gradient and hard pixel shadows. Home panels get title bands with orange pixel bullets.
- **Page titles:** bigger pixel type with an orange underline.
- **Tables:**
  - sticky header rows;
  - zebra stripes;
  - a blue hover rail and an orange rail on selected rows;
  - team names left-aligned and never wrapping in standings;
  - playoff seeds in green.
- **Buttons:**
  - The Play button looks like an arcade button, with a glow.
  - Primary buttons get a top highlight.
  - Active toggles are orange.
- **Sidebar:** icon tiles for the five places, and an orange-lit active item.
- **Home hero:** a spotlight glow, and a glowing record and player OVRs.
- **Toasts:** now appear above the Play button instead of under it.

## Tests

- New: `src/tests/parallelSim.test.ts`.
  - Phased days match sequential days, including through an engine pool running on real MessageChannels.
  - The stale-injury case.
  - Blocked days stay untouched.
  - An Auto Play season ends in the identical state.
  - Training copies are independent.
  - The progress store works.
- Full suite: 636 tests pass. Lint shows no new warnings. The production build succeeds.
