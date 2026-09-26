# NBA history import

Builds `public/data/nba-history.v1.bin`, the reference data behind historical Real Leagues and the in-game NBA History archive. The game never scrapes websites: everything is prepared here, at build time.

## Rebuild

Requirements: Python 3 and numpy (built with Python 3.11, numpy 2.4.4).

```sh
git clone https://github.com/sumitrodatta/bball-reference-datasets.git /tmp/bbref
git -C /tmp/bbref checkout 76a70b41ad1c13948f25c62c921ed822e5db7f0e
python3 scripts/nba-history/build_nba_history.py --bbref /tmp/bbref/Data
```

The script writes the asset and regenerates `COVERAGE.md` (sources, validation results, known gaps, rating method, build warnings). With the same inputs the output is byte-identical: two builds gave the same SHA-256.

`sources/cv_overall_distribution.json` is Court Vision's own Overall spread, measured from generated leagues. Re-measure it after changing the player generator or the Overall formula:

```sh
npx vitest run -c scripts/nba-history/vitest.measure.config.ts
```

## Inputs

| Input | What it provides | Terms |
|---|---|---|
| Sumitro Datta, *bball-reference-datasets* (commit above) | Player biographies, regular-season totals and team stints, advanced stats, team seasons, award voting, All-League/Defense/Rookie teams, All-Star selections, draft history | No licence file. The data comes from Basketball-Reference.com (Sports Reference), whose data-use policy allows reusing facts but not building a competing database. **Ask for a go-ahead before a public release.** |
| `sources/champions.txt`, `finals_mvp.txt`, `allstar_mvp.txt`, `coach_of_year.txt` | Champions and series results, Finals MVP, All-Star Game MVP, Coach of the Year | Facts transcribed from nba.com history pages (URLs and dates in each file's header) |
| `sources/cv_overall_distribution.json` | The Overall spread ratings are mapped onto | Court Vision's own (generated leagues) |

No video-game or publisher ratings are used, and official team names are not shipped: teams carry city names ("Golden State", "Seattle"; the Clippers are "LA"). Players can type their own team names in the game.

## What the build checks

- Every multi-team season: the source's total row equals the sum of the team stints on every counting stat.
- No duplicate player-season keys; same-name players get a debut-year suffix so IDs stay unique.
- Every Finals MVP and All-Star Game MVP is matched to a player (and to a finalist or an All-Star that season).
- Franchise lineage (e.g. SEA → OKC, NJN → BRK, the Charlotte Hornets' history → CHO).
- Unrecorded statistics stay `null`; they are never written as 0.
- Ratings are checked against real honours: MVPs rank #2 (median) in the next season's ratings and 82% of them are in the top five.

## Ratings

Each season, players are ranked by value over replacement per game: box plus/minus from 1973–74, estimated from PER and WS/48 for 1951–52 to 1972–73, and from win shares, points and assists before that. Both estimates are fitted on 1973–74+ seasons (r = 0.90 and 0.93). The Nth-best player, scaled to a 30-team league, gets the Nth-best Overall of a generated Court Vision league. A player's rating for a season comes from the season before; an injury-shortened season leans on his earlier form. Details are in `COVERAGE.md`.
