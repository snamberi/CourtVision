# Awards: real voting, award races, Awards Night and the title celebration

## 1. Real award voting, saved with every season

- **The panel decides.** A 100-member media panel casts ranked ballots:
  - MVP: 10-7-5-3-1 points.
  - DPOY, ROY, Most Improved, Sixth Man, Clutch Player and Coach of the Year: 5-3-1 points.
- **What the voters look at.**
  - Every voter sees the formula scores.
  - Each voter weighs the storylines differently: team success, and "voter fatigue" for last year's MVP or DPOY.
  - Each voter also reads the numbers with a little noise.
  - A runaway leader stays near unanimous; a close race splits first-place votes.
- **Co-winners.** An exact tie in points names co-winners. An exact tie in a stat title shares it. Both players are credited on their profiles.
- **Saved with the season.** The full vote is stored in `fullAwards.votes`: points, first-place votes, share, votes at each place, the top three's stat lines, and a short "why he won" list.
  - Seasons played before this update show vote shares labelled *estimated*.
  - Imported NBA seasons still show the real vote.
- **The games-played minimum scales with the season.**

  | Awards | Games needed | 82-game season |
  |---|---|---|
  | MVP, DPOY, Sixth Man, Most Improved, Clutch, All-League, All-Defense | 79% of the season | 65 |
  | Stat titles and the specialist awards | 71% | 58 |
  | Rookie of the Year and All-Rookie | 50% | 41 |

  During the season the minimum is pro-rated to the games played so far. The share is set in League Settings › Award Formulas.
- **Code:** `simulation/awardVoting.ts` (the panel), `simulation/awards.ts`.

## 2. In-season award races

- **Weekly ladder.** A ladder is saved every week for MVP, Defensive Player, Rookie of the Year, Sixth Man and Most Improved. Award Races shows the live top ten, with trend arrows against last week's ladder (▲ up, ▼ down, NEW).
- **Players of the Week and Month.** They are named for each conference (league-wide in a league without conferences). The choice uses the period's box scores: production per game, games played and team wins.
- **News.** Each honor gets a news story.
- **Player of the Month award.** The season award now goes to the player with the most monthly honors, replacing the old formula.
- **Same results either way.** The race updates when a game day's last game is applied, so one-game-at-a-time, full-day and parallel engine-worker simulation give identical results.
- **Code:** `simulation/awardRace.ts`, hooked into `commitGame` in `league.ts`.

## 3. Awards Night

A stage show in order:
1. Stat titles and the specialist medals.
2. All-Rookie and All-Defensive teams.
3. Most Improved, Sixth Man, Rookie of the Year, Clutch and DPOY.
4. Coach and Executive of the Year.
5. The All-League teams.
6. Finals MVP.
7. MVP to close the show.

Each award goes through the same beats:
- the finalists on stage and an envelope;
- the trophy rising;
- the winner in the spotlight, with confetti;
- a stat card, a "why he won" list, and the vote table with first-place votes, points and shares.

The Program menu jumps to any award, and "Skip to MVP" jumps to the finale. It is available from Award Races (preview during the season; the real show at season's end) and from the Almanac for any past season. In the offseason, Award Races shows the season that just finished.

## 4. Pixel trophies

Every honor has its own original 16×20 pixel trophy (`visuals/trophyArt.ts`, `components/PixelTrophy.tsx`):
- MVP: a crown over a ball.
- Finals MVP: a golden ball on a column.
- Title: a two-handled cup.
- DPOY: a shield.
- ROY and All-Star: stars.
- Most Improved: an arrow.
- Sixth Man: a "6" plaque.
- Clutch: a stopwatch.
- Coach of the Year: a clipboard.
- Executive of the Year: a briefcase.
- All-League: numbered gold, silver and bronze plaques.
- Stat titles and specialist awards: medals.
- Players of the Week and Month: rosettes.
- 3-Point Contest: a ball rack. Dunk Contest: a rim.

Where they appear:
- Player profiles have a trophy shelf with counts and the seasons on hover, instead of text badges.
- Team History has a **Trophy Case**: titles, Coach and Executive of the Year, and the players' awards won in that uniform.

## 5. Teams by position and conference

- **All-League and All-Defense by position.** Each team is 2 guards, 2 forwards and 1 center (from each player's best position). Voters fill every team; 1st-team spots are worth the most points. All-Rookie stays positionless.
- **All-Stars by conference.** In a league with conferences, each conference's vote picks two backcourt and three frontcourt starters, and the coaches pick the reserves. The All-Star Game is East vs West; leagues without conferences keep the drafted squads.
- **Rising Stars game.** Rookies play second-year players during All-Star Weekend, with its own MVP. It is saved to history and shown on the player's shelf.

## 6. Front office honors and the Hall of Fame

- **Executive of the Year.** Every front office votes, never for its own team. It rewards:
  - the win improvement on last season, or on the roster's projection in a league's first season;
  - Win Shares from the season's trades, signings and draft picks;
  - winning.

  Your front office can win it; the award says so when it does.
- **Coach of the Year.** It now compares wins with a calibrated talent projection (the old one projected single-digit wins for most teams) and with last season's record.
- **Hall of Fame.** Hardware is weighted by prestige: MVP 18, Finals MVP 12, All-League 1st 8, DPOY 9, title 7, All-Star 4, Player of the Week 0.25, and so on (`simulation/trophies.ts`). Hall of Fame résumés list the headline honors ("2× MVP · 8× All-Star").

## 7. The title celebration

- **When it plays.** It plays the moment a champion is crowned (once per title).
- **What it shows.**
  - The whole championship roster stands around the trophy, the stars nearest the middle.
  - The Finals MVP stands in the middle with both arms up, holding the Finals MVP trophy.
  - Confetti and spotlights in the champion's team colors, and camera flashes.
  - The series result and the Finals MVP's averages.
- **Replay.** It can be replayed from Playoffs, Award Races and the Almanac.
- **Accessibility.** It respects reduced motion.
- **Code:** `components/ChampionshipCelebration.tsx`, plus a new `pose: 'raise'` for player sprites.

## Bugs fixed

- **Award settings were never saved.** The Save button said they were, but they reset on reload. They are now stored with the league (`league.awardSettings`, defaults for older leagues) and used everywhere:
  - Auto Play;
  - player profiles (which ignored custom formulas);
  - the Almanac;
  - All-Star Central.
- The Awards page said rookies were "age 21 or younger"; eligibility is actually no previous seasons played.
- The formula help text left out the Win Shares and Defensive Win Shares weights.
- Awards Night vote shares were cosmetic and could disagree with the saved winner; they are now the real vote.
- Ties went silently to whoever came first in the list.
- **Stat titles and the specialist awards had almost no games minimum.** Stat titles needed only 5 games, and five specialist awards counted anyone who had played at all. They now need 58 of 82 games (pro-rated).
- The Almanac showed a phantom "in progress" season during the offseason, built from the previous season's games.
- The Rookie of the Year formula now counts Win Shares, so a winning rookie isn't buried by empty stats.

## Saves

- Older leagues load unchanged:
  - missing settings use the defaults;
  - seasons without saved votes show estimated shares;
  - Players of the Week and Month start from the next completed week.
- New fields are additive: `awardSettings`, `awardRace`, `fullAwards.votes / honors / eoy`, `allStarWeekend.risingStars`, `risingStarsMVPPlayerId`, and `playoffBracket.celebrated`.
- The race is cleared at the rollover once its honors are archived.
- Each archived season is about 40 KB larger.

## Tests and checks

- **New tests:** `src/tests/awardsSystem.test.ts`, with 13 tests:
  - the voting panel and co-winners;
  - shared stat titles;
  - positional teams;
  - Executive of the Year voting and "your team" wins;
  - games minimums;
  - settings repair;
  - weekly ladder and honors per conference, and news;
  - conference All-Stars;
  - Rising Stars;
  - archiving;
  - Hall of Fame prestige;
  - every trophy fits its grid.
- **Updated tests:** two award tests now expect ballots ranked by votes.
- **Browser run-through** (production build, Chromium), with no console errors:
  - a full season;
  - All-Star Central with Rising Stars;
  - playoffs with the celebration, desktop and phone;
  - Awards Night, every step;
  - the rollover;
  - the Almanac replay;
  - the trophy shelf and trophy case.
- **Speed:** unchanged. Rest of Season took 23.1 s and Auto Play (2 seasons) 30.1 s, against 25.0 s and 34.3 s before (normal run-to-run variation). The weekly ladder costs about 0.4 s per season in Node.
