# Tutorial and Simple mode

New players get a guided start and a simpler menu. Built from the picked tutorial designs: Simple mode, the coach's walkthrough, the first-season checklist, the season road map and features that unlock as you play.

## What players see

**Simple menu.** Five places to go: Home, My Team, Front Office, League and History, plus Settings & tools. Clicking a place opens its main page and lists its other pages under it. Nothing is removed: every page in the Full menu sits under exactly one place (a test checks this). A **Simple / Full** switch sits at the top of the menu, and **Show all tools** at the bottom switches to Full.

**Tools unlock as you play (Simple mode only).** Locked tools are listed under the menu with when they open and progress so far:

| Tool | Pages | Opens |
|---|---|---|
| Trades & free agents | Trade, Trade offers, Trading block, Free agents | after 5 games, or as soon as a team sends you an offer |
| Player development | Development | after 10 games |
| Scouting & draft | Draft, Watch list | at the All-Star break (halfway through the season if the break is off) |
| Staff & finances | Staff, Finances | after your first season |
| Sandbox tools | Sandbox Mode and the editing tools | after your first season |

When one opens, an **Unlocked** card explains it with **Show me** / **Later**, and the page carries a NEW tag until opened. Offseason phases that need a page (draft, free agency) always have it open. **I know the game: unlock everything** turns locks off for the league. Locks only tidy the menu; direct links and phase flows still work.

**Coach's tour.** Eight stops with the pixel assistant coach: welcome, the Play button, Home, My Team, Front Office, League, the season road map and the checklist. Each stop spotlights the real part of the screen, with Back, Next and Skip (Esc also skips). It starts on a player's first new league on this device and can be replayed from Settings & tools. Progress is saved, so a reload resumes the tour.

**First-season checklist** (on Home): choose your team, take the tour, play your first game, look over your rotation, check on player development, look for a trade, finish the regular season, draft your first rookie. Lessons tick themselves off from what happens in the league. **Go** opens the right page and points at what to press; lessons for locked tools show when they open instead. It can be hidden and brought back from Home or Settings.

**Season road map** (on Home, every league): Preseason → Regular season → All-Star → Trade deadline → Playoffs → Awards → Draft → Re-sign → Free agency, with "you are here", games until the All-Star break and the deadline (in the order your league's rules put them), what matters right now with buttons to the right pages, and what's coming up. It follows the Play-menu All-Star setting.

**Settings › Menu & lessons:** menu size, replay the tour, show or hide the checklist, unlock every tool.

## Saves

- Tutorial progress is stored on the league (`league.tutorial`), so it travels with saves, backups and exports.
- **Existing leagues are unchanged:** no tutorial state means the Full menu, nothing locked, no tour and no checklist. They still open on the same page as before. Switching one to Simple unlocks everything straight away.
- New leagues (random or NBA history, via Choose Team) start in Simple mode on Home. After a player finishes or skips the tour once, later new leagues don't start it again, and they use the menu size the player last chose.
- Background simulations keep tutorial progress made while they run.

## Code

- `src/tutorial/`: `tutorialState.ts` (state, defaults, repair of malformed saves), `unlocks.ts`, `lessons.ts`, `roadmap.ts`, `guide.ts` (tour and pointer text), `simpleNav.ts` (the five places).
- `src/components/tutorial/`: `CoachGuide`, `SeasonRoadMap`, `FirstSeasonChecklist`, `UnlockNotice`, `LessonsSettingsCard`. Styles are in `src/tutorial.css`.
- The Full menu definition moved to `src/navigation/menu.ts`. `Sidebar.tsx` renders either menu.
- Pointer targets: `data-tour` attributes on Your Team (starters), Development, Trade and Draft.

## Tested

- `src/tests/tutorial.test.ts`: state defaults, legacy leagues, repair, menu coverage, every unlock rule, notices and NEW tags, lesson detection, road map through every phase, rule changes and progress.
- `src/tests/tutorialUi.test.tsx`: Simple and Full menus, checklist, coach guide spotlight and keys, road map.
- In a browser at 1400×900 and 390×844:
  - the full tour;
  - lesson pointers;
  - unlocks during a background week sim;
  - a whole season through to re-signing;
  - Full/Simple switching;
  - replaying the tour;
  - reloading;
  - opening a save made before the tutorial.
