# Court Vision — mode and pixel presentation update

This pass builds on the selected-card menu and floating pixel icons already in the project. Existing themes, saved games, simulation outcomes, difficulty and economy remain compatible.

## Where to find the changes

- **Main menu:** select a mode to smoothly expand its Play button and variants inside the card. Franchise also reveals Continue. Escape closes the selection. On small screens the actions scroll clear of the bottom navigation. The selected card gains a brighter border and its floating pixel icon reacts.
- **Your Team / Team Rosters:** a pixel court displays the starting five, with reserves alongside it. Select a starter or reserve to inspect real chemistry connections. Strong Franchise duos use the existing bond scores; League Hunt and 82–0 use their existing chemistry bonuses.
- **League Hunt / 82–0 / Survival:** lineup boards display the run's roster and bench. Automatic 82–0 lineups are labeled as projections; existing rotation controls still determine custom lineups.
- **League Hunt bosses:** pressing Play first shows the real opponent rotation, strongest available player, that team's championship banner when applicable, and the series modifiers. Back returns to preparation; Start series begins the existing simulation. Hidden-rating preferences are respected.
- **Franchise Timeline:** the earned trophy room shows simulated championships and major individual awards belonging to the selected franchise. Imported historical titles remain in the timeline but are not counted as earned trophies. Select a trophy or banner to open its season. A just-won championship appears immediately, with the full roster archive added at the normal season transition.
- **Trading:** the oversized eight-pixel face is replaced with a detailed, consistently generated front-office portrait and mood-based body language. Offer valuation and acceptance rules are unchanged.
- **Banners:** championship, dynasty, cup and retired-number banners share richer cloth shading, stitching and frame details. Championship cups have layered gold highlights. Timeline events and exported timeline images use the shared pixel icons.
- **Supporting screens:** settings, the Relic Shop/Vault, legend challenges, rebuild challenges and empty Franchise saves have matching pixel room artwork and panel details.
- **Live games:** passes and shot arcs leave short trails derived from the actual ball path; blocks add impact sparks. The correct bench rises and claps after makes or defensive highlights. Teammates react to made baskets. Curry's made threes receive a night-night pose and callout. Misses and two-pointers do not trigger it.

New decorative effects respect reduced-motion and Lite preferences. Replays remain deterministic and seekable, with no added simulation randomness or changes to results.

## Validation

- `npm run build` passed, including TypeScript, API generation, the refreshed offline Windows download, and the production web build.
- 39 distinct targeted tests passed across eight test files, covering court motion/sprites, lineups, saved Franchise actions, boss rosters, earned honors and timeline behavior.
- Chromium checks passed at desktop and 390px mobile widths: mode expansion, auto-scroll, Continue, empty saves, boss introduction/back/start-series, trophy-to-season links, lineup/bench layouts, trade portraits, and supporting room art.
- Live rendering checks passed for Curry's celebration, the correct reacting bench, block effects, and reduced-motion behavior. No page errors in the completed browser checks.
- Existing warnings about large bundles and mixed static/dynamic imports remain.

## Run

Use `npm ci` and `npm run dev` for local development. `npm run build` regenerates the API, offline Windows package and production site through the project's existing workflow.
