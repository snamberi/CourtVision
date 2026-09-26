# In-Season Cup, stat balance, ad loading and a design pass

## In-Season Cup (League › In-Season Cup)
A tournament inside the regular season, modelled on the NBA's:
- **Draw.** When a regular season starts, teams are drawn into groups of five (three per conference), with roster strength spread across the groups. Leagues without conferences use plain groups; leagues under 8 teams skip the Cup.
- **Group stage.** One early meeting between every pair in a group (in an 82-game season, all of them by about round 34, early December) also counts as a Cup game. The schedule, standings and season stats don't change. Cup games carry a **CUP** tag on the schedules.
- **Knockouts.** The night the last group game is played, the 6 group winners plus the best runner-up in each conference play quarterfinals, semifinals and a final (conference brackets, East vs West final). These are extra games on the real engine; they don't count in the standings or season stats and nobody gets hurt.
- **Honors.** Champion, Cup MVP (the champion's best player, knockouts weighted double) and an All-Cup team. New pixel trophies for the Cup, Cup MVP and All-Cup appear on player and team trophy shelves.
- **Around the season.** A Cup card on Home, a knockout-night toast, news stories, the Almanac line, past champions on the Cup page, and the result archived with the season's history.
- **Front office.** Win-Now owners can add a bonus goal to reach the knockouts. New achievements: Cup Winners, Cup Hero, The Double.
- Works the same in single-game, full-day, parallel-worker and Auto Play simulation (it hooks into the same game-day step as the award races). Older saves get a Cup when the next season starts, or at load if the season is early enough.

## Box-score balance
Measured over seeded seasons against NBA 2023-24 averages (per team game):

| | Before | After | NBA |
|---|---|---|---|
| Blocks | 15.5-16.3 | 4.6-5.2 | 5.1 |
| Steals | 3.0 | 7.0-7.5 | 7.5 |
| Turnovers | 7.6-7.9 | 12.5-13.4 | 13.6 |
| Rebounds | 53-54 | 41 | 43.5 |
| FG% | 42-43% | 48% | 47.5% |

League leaders now land near NBA leaders (about 3 blocks, 12 rebounds and 2 steals a game). Changes: a new rim-block curve plus help-side blocks by the best shot-blocker on the floor; a turnover calibration with more steals (loose balls credited as steals, passing-lane steals going to the best ball hawks); rim finishing recalibrated now that blocks no longer inflate misses; 7% of misses become team rebounds (shown as "Team rebound" in play-by-play); rebounding skill counts more for bigs. `tests/statBalance.test.ts` guards the ranges.

## Ads
The site only requested ads after a visitor clicked "Accept all" in the cookie banner, so most visitors never got one. The game now uses Google's certified consent message (`googleCmp: true` in `src/ads/adConfig.ts`): Google asks visitors in the EEA, UK and Switzerland and withholds ads there until they answer; everyone else gets ads with the page. Browsers sending Global Privacy Control still get no ad requests. The privacy policy was updated to match.

**Needed in AdSense:** publish the consent messages under Privacy & messaging (European regulations, and US state regulations), and make sure the site is approved in Sites with `ads.txt` found.

## Design
- Body text in Inter (bundled, no font CDN), with tabular numbers in tables.
- Page titles, panel headers and table headers in condensed Oswald, like a broadcast graphic. The pixel font stays for the logo, eyebrows and the title screen.
- Home hero in your team's colors with the team logo; Owner's Office and Cup cards side by side.
- Bigger, cleaner player-name headers; consistent titles on the guided panels.
