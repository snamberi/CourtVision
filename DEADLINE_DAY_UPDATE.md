# Trade Deadline Day, stat realism, faster sims and fixes

## Trade Deadline Day (Front Office › Deadline Day)
The game day the trade deadline falls on is now an event.
- **The season stops that morning.** Every way of playing (1 game, a week, a month, To Trade Deadline, Rest of Season) stops on Deadline Day, the same way it stops for All-Star Weekend. Auto Play plays straight through.
- **A 9 AM to 3 PM clock.** Move it an hour at a time, or skip to 3 PM. At 3 PM trading locks and any offers still on your phone expire. Playing on during the day runs the clock to the deadline for you.
- **Rumor mill.** Built from where every team stands: players who asked for a trade, sellers shopping their best veterans (with expiring deals called out), contenders hunting for a position of need, players on the trade block, and how the league sees your team. Rumors are rated HOT, WARM or MURMUR and are marked when they come true ("Dealt to … at 1:00 PM").
- **AI teams call you.** Contenders call to buy your veterans, rebuilding teams call to sell theirs (up to three offers at once). Accept or pass right on the page. Offers that stop working (a player moved, the money no longer fits) drop off.
- **Deals break all day.** AI teams trade with each other, more often as 3 PM gets closer. The teams in the rumors talk first, and hot rumored players get shopped by name, so rumors often come true. A seller moves one or two pieces, not the whole roster. Deals involving a 72+ overall player are marked BLOCKBUSTER.
- **Ticker, news and recap.** Every deal (yours included) appears on the Breaking ticker with its time. Each one runs in the News feed as DEADLINE DEAL or BLOCKBUSTER, followed by the recap once the deadline passes. The Home card counts down the game days to the deadline, links to the live day, then shows the tally and the biggest deal.
- The **League Rules › trade deadline** switch now works. With it off there is no deadline and no Deadline Day; before, the switch did nothing.

## Stat realism
Fouls, free throws, threes, assists and pace were calibrated against NBA 2023-24 per-team-game averages, and `tests/statBalance.test.ts` guards the ranges.

## Faster simulation
- The engine loop is about 18% faster per game, with identical results.
- Engine workers stay warm between Play clicks for two minutes. Games go to whichever worker is free, so a slow worker no longer holds up the day.
- Replay logs compress faster.
- `npm run bench` and `npm run bench:season` measure before and after.

## Schedules
- **Odd team counts.** Every team now plays the full slate (a 29-team, 82-game league used to leave teams on 79-80 games).
- **Home court.** Every team gets about half its games at home; before, some teams had 53 home games of 82 and others 29.

## Phones and loading
- On phones the Play button docks at the bottom edge, and toasts stack just above it.
- Checked every main page at iPhone width: none scrolls sideways.
- react and Dexie load as separate cached chunks. The app code dropped from 604 kB to 326 kB (110 kB gzipped).
