# Courtside Live Watch update

## Court and presentation

- Home team's saved center-court logo, court paint, apron colors, abbreviation and arena name.
- Detailed hardwood, court markings, backboards, rims, moving nets, crowd and benches.
- Pixel players retain their generated appearance and uniforms, with animated legs, arms, shooting and contest poses, jumping and floor shadows.
- Full-court or follow-ball camera, fullscreen, optional player labels and an optional ball trail. The follow camera enlarges action on mobile.

## Movement and ball physics

- Smooth acceleration into positions, drives toward the rim, defensive tracking and foot separation.
- Position and ball continuity between possessions, with inbounds/outlets and basket switches at halftime.
- Repeated dribble bounces, chest and bounce passes, elevated jump shots, shorter close shots, dunks, blocks, rim misses, rebounds, steals and made-shot net reactions.
- Ball height follows gravity-style parabolic flight; rotation, floor shadows and bounce arcs distinguish airborne movement from dribbling.
- Each free throw is shown. Newly simulated games preserve the real attempt order without changing random-number consumption. Older saves reconstruct order from their stored make/attempt totals.

## Controls and integrity

Pause/play, 0.5–8× speed, previous/next possession, restart, scrubbing and Sim to End are supported. Space and arrow keys work while the viewer itself has keyboard focus. Reduced-motion users start paused; moving to a hidden browser tab pauses playback.

The possession simulation still determines all results. These are deterministic visual physics and reconstructed player paths, not a new collision-based basketball simulation. Rewatching, seeking, changing cameras or skipping cannot alter stats or count the game again. Exact original player coordinates were never stored, so they cannot be recovered for historical games.

## Validation

Motion tests check participant identity, finite coordinates and court bounds, constant-acceleration arcs, make/miss/block behavior, halftime direction, possession continuity, free throws, old-save compatibility and deterministic seeking. UI/browser checks cover movement, pause, speed, previous/next, seeking, fullscreen, display controls, restart/final score consistency and mobile overflow. Web and Windows packages are rebuilt from the same source.

## Broadcast update (live watch 2.0)

- **Real half-court actions:** ball screens (screen, hold, roll or pop), a weak-side baseline cutter, shooters curling into catch-and-shoot threes, drives that gather before attacking the rim.
- **Smarter defense:** goal-side positioning, help defenders sag into the paint, closeouts and contests, stealers jumping the passing lane, then a live breakaway the other way.
- **Ball handling and physics:** alternating-hand dribble with crossovers, higher arcs on threes, front-rim pops before long rebounds, dunkers hanging on the rim, ball grows slightly with height.
- **Poses:** defensive stance, screen-setting, dribble arm, shot and contest, made-shot celebrations; players face the ball.
- **Free throws:** proper lane lineup (defense on the low blocks).
- **Court:** regulation-proportioned lane, three-point arc and corners, restricted area, lane hash marks, coaching marks, center-circle paint, lighting sheen/vignette, padded stanchions and a detailed rim/net that shakes on misses.
- **Arena:** four-row crowd that stands and cheers on big home moments, scrolling LED ribbon board, baseline photographers with camera flashes on makes, benches and scorer's table.
- **Broadcast graphics:** TV score bug (abbreviations, score, possession arrow, period clock, shot clock), pop-up callouts (+2, +3, SLAM!, AND-1!, BLOCKED!, STEAL!, FOUL, +1), make bursts, team-colored floor rings, cleaner name labels (offense + ball carrier).
- **New display options:** Broadcast (TV) camera, a smoother Follow camera, a live on-floor shot chart (made squares / missed crosses), and a motion-blur ball trail.
- **Game flow:** a clickable score-margin strip that only shows what has happened so far, a scoring-run badge ("8–0 RUN"), and phase-by-phase play-by-play calls.

All of this is still presentation only: nothing reads the simulation RNG or changes box scores, and old saves replay as before.

## Live box score, coaching, sound, highlights & performance

- **Live box score** (tab under the court): MIN, PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, PF, +/- per player, players on the floor marked, team fouls (bonus at 5 per period) and timeouts left. It counts only possessions already shown and matches the official box score exactly at the final buzzer. New games record assist and foul credit on each possession; older saves fall back to the play-by-play text.
- **Coach Next Game Live** (Play menu): call timeouts (7 per game; players recover fatigue), send in any five (they stay on for the rest of the period unless someone fouls out), change pace (slow / normal / fast) and defense (man, switch, drop, zone, full-court pressure). Each decision applies from the next possession and re-simulates tonight's round from the same starting league and seed, so everything already shown replays identically and the new result replaces the committed one. Decisions lock once anything else changes the league.
- **Sound** (off by default, remembered per device): synthesized dribbles, swishes, rim clanks, whistles, buzzer and a crowd that rises in close, late games and cheers home baskets and stops.
- **Highlights**: game-winners, go-ahead and clutch shots, dunks, late blocks, and-ones, steal-and-scores and lead changes are scored from the recorded log. Markers appear on the game-flow strip as they happen; *Next Highlight* jumps ahead; a ~60-second reel plays the best moments in order; *Share highlights* copies or shares a text recap; *Save reel as video* records the reel to a WebM file.
- **News**: a new Highlights category publishes a *Play of the Night* (plus an *Also on the reel* when a second play is exceptional) for each recent game day, with a *Watch the Play* button that opens the replay at that possession.

### Performance

- Replay logs were ~90% of a league (about 150 KB per game). Games older than the latest round now keep their log deflated (~13 KB) and expand only when opened. A half season went from 120 MB to 28 MB of save data, and each autosave from ~1.5 s of frozen page to ~0.15 s. Background workers hand back compact leagues too.
- The engine resolved every player's badges and ratings each possession; it now does so once per game. Game simulation is about 2× faster with bit-for-bit identical results.
- *1 Week* / *1 Month* now run in the background worker with a progress bar instead of freezing the page (a month previously froze it for ~16 s; now the longest freeze is ~0.2 s).
