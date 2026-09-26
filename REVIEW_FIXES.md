# Review fixes

## Critical: re-signing could delete a player
- The re-sign page saved the new free-agent list with the old league, so a re-signed player left free agency, got a contract and never joined the roster. Both halves of the signing are now applied together, and a failed signing says why.
- A regression test checks that every player lives in exactly one place (a roster or the free-agent pool) and that only rostered players hold contracts. It fails against the old code.
- A player already lost in an existing save can't be recovered: only his contract survived.

## Offensive rebounds keep possession
- After an offensive board the same team goes again with a short second-chance trip (a few seconds; the shot clock effectively resets), tagged `secondChance` in the game log. The replay shows "Second chance" and calls the offensive rebound.
- Rebounds were also split almost 50/50 (47% offensive), which the old possession bug had hidden. Defenders now get box-out position, bringing the offensive rebound rate to about 25%, as in the NBA.
- League averages per team game, before → after: offensive rebounds 23.3 → 13.5, defensive rebounds 26.0 → 40.3, points 99 → 108, field-goal attempts 86 → 94. FG% is unchanged at 42.7%.
- Advanced stats use the standard possession estimate (FGA + 0.44·FTA + TOV − ORB).

## Free agents at the season rollover
- Unsigned free agents now archive what they played, reset their season totals, age a year, develop (no team boost) and can retire. Fringe veterans who stay unsigned leave the league, so the pool doesn't keep growing. The step is safe to repeat and uses its own random stream, so the rest of the rollover stays seeded as before.

## Trades and waivers keep team-specific stints
- `seasonStats` stays the full-season line (the "TOT" line), so awards, leaders and records are unchanged. When a player is traded, waived or moved mid-season, his time with that team is closed as a stint.
- Advanced stats rate each stint against that team's context, then combine them: Win Shares add up and rates are minute-weighted. Free agents who played earlier in the season are included.
- Team History (archived and in-progress seasons) lists everyone who played for the team that year, with only their games there. Career lines keep the per-team split, and the player profile shows "TOT" with a row per team.

## One set of signing rules
- `signingDecision` / `signFreeAgentChecked` (freeAgentDecision.ts) decide every signing, with explicit paths:
  - **Market:** the player's price and refusals, cap room (minimum deals always allowed), the hard cap.
  - **Re-sign** (Bird rights): no cap-room limit, but morale and history can make him refuse or raise his price.
  - **Emergency** (league-minimum roster in season): the player must accept and gets his price; cap room is waived. The best candidate is forced only when nobody accepts, so games stay legal.
- Used by manual free agency, the re-sign page, the AI market, Auto Play for your own team, and coach emergency signings. Sandbox edits still bypass it on purpose.

## Mobile Records
- Category buttons wrap into a three-column grid, the search and cards fit the screen, and long names wrap. Every page now reserves space at the bottom on phones so the last rows scroll clear of the floating Play button.

## Initial download
- Pages load on demand. The first JavaScript download went from 1,122 kB to 549 kB (345 → 182 kB gzipped). What's left is mostly React DOM, the save database and the simulation core the Play button needs.
