# Court Vision — Management and Draft Update

## Player cards and input
- Removed the duplicate badge count from the quick-stat grid. Equipped badges stay in one dedicated section.
- Moved player-data provenance into a small Generated, Historical, or Custom tag with a tooltip.
- Added the player's archetype beneath the bio.
- Main content and the sidebar have independent, bounded scroll areas that support mouse wheels, including the collapsed sidebar.
- Responsive ads wait for their script and a measurable slot, recover from blocked or unfilled requests, and unmount cleanly when consent changes. Top banners scroll with content. Desktop builds continue to avoid network ads.

## Roster management
- League roster limits are 10–18 players. Existing saves adopt these limits when opened.
- Coaches automatically waive excess depth and sign available free agents to fill short rosters before regular-season play, including the controlled team.
- Moves consider ability, upside, position depth and salary. Player identity, transaction history and contract ownership are retained.
- The draft, re-signing, free agency, preseason, playoffs and All-Star activities remain available outside those roster limits.
- Regular-season games stop if a legal roster still cannot be assembled because the free-agent pool is empty or a hard cap prevents a signing.

## Draft and trading
- Every draft contains exactly two rounds, with one slot per team in each round. Extra prospects enter free agency; they never create a third round.
- Legacy one-round or oversized orders are repaired while preserving valid traded slots.
- Draft-night deals support packages of current picks and players. A trade checks ownership, used picks, duplicate assets, salary rules and trade difficulty before executing.
- Build fair offer prepares a balanced package for review; Confirm Trade executes it.
- Current pick values depend on known draft position, not the new owner's record. Future picks use the same value scale as players; protection reduces the receiving team's expected return.
- Numeric trade values are hidden by default across roster, trade, offer, block and draft views. Enable Show trade values in League Settings or the Trade page.
- During overall picks 1–5, a live comparison shows the three highest-ranked remaining prospects across shooting, height, finishing, playmaking, defense, rebounding and athleticism.
- Manual final selections close the draft and release undrafted prospects automatically.

## Player variety and awards
- Generated players receive 0–3 unique normal badges, weighted toward their strengths.
- All 27 normal badges use smaller, distinct bonuses; six new badges cover rebounding, post skills, corner shooting, durability, switching and playmaking.
- Badge editing requires Sandbox Mode. Duplicate badges do not stack, and experimental badge modifiers and flags remain inactive outside sandbox.
- Six new types: Deep Range Creator, Point Center, Switch Defender, Post Technician, Movement Sniper and Defensive Playmaker. Each changes generation attributes, roles, position suitability and intended usage.
- Five new awards: Sharpshooter of the Year, Floor General, Interior Scorer of the Year, Iron Man and Rookie Defender of the Year. Winners and ranked ballots use season production and persist in franchise/player history.

## Three additional improvements
1. Rookie contracts now scale with draft position. First-round picks receive four-year deals and second-round picks receive two-year deals, with a minimum-salary floor.
2. Injured players do not lose coach relationship points for minutes they could not play.
3. Rapid save requests are serialized per save slot. A save cannot overwrite a concurrent rename or recreate a deleted slot. Returning to the menu flushes pending changes.

An additional regression fix protects feasible EXACT quarter-minute budgets at rotation boundaries. Normal playing time continues to use real seconds.

## Verification
- 453 automated tests passed across 67 files, covering roster correction, phase gates, draft sizes, trade packages, badge permissions/effects, ad consent/failure handling, award history, saves and existing simulation behavior.
- TypeScript compilation and both the web and Windows package builds pass.
- Desktop and 390-pixel mobile browser checks pass: independent mouse-wheel scrolling, completed draft with oversized rosters, balanced draft trade save/reload, hidden-value toggle, refreshed prospect comparison, and automatic regular-season roster correction. No browser exceptions were recorded.
- External ad delivery still depends on the configured ad account and network; request failure, unfilled slots and consent changes are exercised without clicking live ads.

## Running the update
- Source/web: install dependencies with `npm install`, then use `npm run dev` or `npm run build`.
- Windows: extract `public/downloads/CourtVision-Windows.zip` and use the launcher included in that package.
- Existing saves remain supported. Back up important universes with Export Universe before replacing an older build.
