# Draft Season, GM legacy and Sandbox rules

## Draft Season
- **The class is on the board all year.** Next summer's draft class is generated when the regular season starts and is the class that gets drafted. Workouts and scouting done during the season carry into the draft. (Before, only the first season had a class during the year, and it was replaced at draft time.) Historical leagues still draft their real classes.
- **College Stats** (Draft › Big Board › College Stats): every prospect's pre-draft season: school or overseas club, class year, games, minutes, points, rebounds, assists, steals, blocks and shooting. Lines fill in as your season is played, and honors (National Player of the Year, All-American teams, national stat leaders, Freshman of the Year) are voted when it ends. The lines come from the prospect's real ratings with some noise, so they are a genuine but imperfect clue; overseas pros post smaller numbers. Nothing is stored: older saves get college seasons automatically.
- **Mock Draft**: a consensus two-round mock from public scouting and each team's thinnest position, with a reason for each pick and the slot salary. During the season it uses the order "if the season ended today" (no lottery); on draft night, the real remaining order. Teams draft from their own private reads, so the real draft will differ.
- **Rookie scale**: every pick signs its slot's contract. First-round length now follows League Rules › rookie contract length (default 4 years); second-rounders sign two-year deals. The full scale is on the Draft page.
- **Summer League** (Front Office › Summer League), after the draft and before re-signing: each team's rookies and young players, plus invited young free agents (and bench players where a roster is still short), play four 40-minute games on the real engine, then the two best records play the final. Champion, MVP, All-Summer team, standings, scoring leaders and your team's box scores. It is a showcase: no ratings, stats or contracts change. Auto Play skips it.

## Your GM legacy
- **History › League history** has a "Your front office" column and your full GM career table.
- **Almanac** shows how your front office did each season.
- **All leagues**: achievements and career totals are also kept across every league in this browser. The GM Office shows your all-leagues record and marks achievements you earned in other leagues; the main menu shows a GM Legacy strip.

## Sandbox (God Mode) never counts
- Turning Sandbox on marks the league permanently, even if it is turned off again. The confirmation dialog says so.
- In such a league, achievements stop unlocking (earlier ones are shown as not counted), reviews are marked unofficial, and the league is removed from your all-leagues record, including achievements only it had earned.
- Leagues saved or imported with Sandbox on are marked when they load.

## Tests
`tests/draftSeason.test.ts` (college lines, the season-long class and its workouts, mock draft, rookie scale, Summer League), `tests/gmLegacy.test.ts` (merging leagues, Sandbox removal), and new Sandbox cases in `tests/frontOffice.test.ts`. Browser-checked through a full season: college stats mid-season and final, mock draft, owner's review, draft, Summer League with box scores, History, Almanac, GM Office, enabling Sandbox and the legacy strip.
