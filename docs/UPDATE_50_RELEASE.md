# Update 50 — release branch review

Branch: `release/update-50`. Keep this release in draft. Do not merge or deploy until Snamberi explicitly approves.

## Implemented

- Three permanent Franchise mission Secrets: Draft Whisperer, Loyalty Pays and The Rebuilder.
- Four Halloween Secrets and four Christmas Secrets, with actual run/league effects rather than catalog entries alone.
- Seven further event Secrets, making 18 new Secrets total. Each has pixel-grid SVG artwork.
- Nine annual UTC events, independent event currency and spin-key balances with annual carryover, overlap-aware rewards, event shops, event selector, and event-only Secret drops. Halloween and Christmas retain their existing cosmetics; the seven new shops each add a title and name color.
- Event spins double each non-common rarity probability and the Secret/cosmetic drop chance. Common takes the remainder; pity still applies. Mission-only Secrets never drop from spins. Personal run bonuses are excluded from daily and weekly shared-seed runs.
- Slot 15 doubles only its equipped relic. A selector swaps a chosen equipped relic into that slot when all 15 slots are filled. Auto-equip puts the strongest selected relic there.
- 50 permanent titles with level, trophy, streak and weekly-mission requirements, shown with unlock progress in the profile picker.
- Trophy, Hunt wins and 82-0 championships boards. The all-time Rebuild board is removed from the selector; historical records and the weekly Rebuild challenge remain intact.
- GM and trophy podium honors, deterministic account-ID tie ordering, and database-observed #1 reign history on all-time main boards only.
- Profile summary `cosmetics.titles` is now an array, with a separate `titleCount`. The migration repairs old numeric summaries. The external NineFoldVision `profile.js` is not part of this repository; this fixes its CourtVision input contract.
- Phone page persistence, larger numbered page controls, inactive-page keyboard isolation, and Clans on the fourth default page. Existing custom app ordering is preserved.
- Responsive section quick jumps on the vault/shop, profile tabs, community/player profiles, friends, settings, clans and progression pages. Additional public profile totals; activity reload/error feedback; simplified clan onboarding; attribute cards; responsive spacing for pets and streak rewards.
- Level/trophy road milestone selectors and current/next-reward jumps; season-road tier selector.
- Ratings show CourtVision's actual derived Street/1v1 ratings alongside the existing point-budget controls. The detailed category reference exposes existing attribute names without inventing independent saved ratings or changing the simulation.
- GoatCounter at the supplied NineFoldVision endpoint, with SPA route categories, manual page counting, no raw hashes/query strings/referrers, desktop exclusion and DNT/GPC handling. Privacy text is updated in the shared legal source and generated page.

## Mission/effect details

Draft Whisperer counts only players drafted under your management after this release who later qualify for the simulated Hall of Fame, grouped by original draft franchise. Older records do not reliably prove who made a pick. Its extra detailed report uses the existing pre-draft workout/report system. Winter Scout and Summer Film also add one workout slot each, only to the managed team.

Loyalty Pays reopens one failed free-agency negotiation per season. Rebuilder refreshes sought trade proposals once per season by presenting alternate fair packages where available; normal cap, roster and trade validation still apply. Usage is stored in league extras.

Forbidden Playbook rerolls one stopped player reel. Trick or Treat and All-Star Clipboard grant coach-only rerolls. Second Life records the loss honestly, continues to the next opponent and leaves exactly one Shield. Cursed Dice replaces the lowest completed non-size starting category once, including Body, and does not guarantee an improvement.

Christmas: Winter Scout (Franchise workout), Snow Globe (Story +3 grit), Stocking Stuffer (Hunt +20 coins), Winter Guard (Survival +1 Shield). Other events: Midnight Reset (Career respin), Heart of the Team (Story +2 grit), All-Star Clipboard (coach reroll), Golden Egg (Hunt +15 coins), Playoff Armor (Survival +1 Shield), Summer Film (Franchise workout), Founder's Whistle (Career respin).

## Calendar choices

These are game-event windows, not claims about the dates of real-world tournaments or movable holidays. All ends below are inclusive; code uses exclusive UTC endpoints.

| Event | Window | Currency | Key |
| --- | --- | --- | --- |
| Halloween | October 1–31 | Candy | Haunted Key |
| Christmas | December 1–31 | Snowflakes | Frost Key |
| New Year | December 26–January 7 | Sparks | Midnight Key |
| Valentine | February 1–last day | Hearts | Heart Key |
| All-Star | February 14–21 | Stars | All-Star Key |
| Easter | March 1–April 30 | Eggs | Egg Key |
| Playoff Fever | April 1–June 30 | Banners | Finals Key |
| Summer Heat | June 1–August 31 | Sun Tokens | Sun Key |
| Anniversary | September 27–30, every year | Founder Tokens | Founder Key |

Keys cost 10 of the matching event currency. Unused currency and keys carry into future occurrences of the same event. Annual earned/spent counters remain separate for cloud merging; balances are pooled without copying rewards. Unlocked cosmetics and Secrets remain owned.

## Release checks and manual work

- Targeted regression suite: 107 tests across 15 files passed, covering relic economy/merging, events, actual gameplay effects, missions, contracts/scouting, summaries, podium honors, privacy and analytics.
- Production build passed and includes TypeScript, API generation, legal/site generation, Windows packaging and Vite bundling. Build output continues to warn about large chunks.
- Lint passed with 58 existing repository warnings and no errors.
- No browser screenshots or live interaction tests were completed in this environment. Review at phone/tablet/desktop widths, especially attribute cards, sticky quick jumps, carousels and overlapping events.
- SQL is prepared, not applied or tested against the live database. Review `supabase/migrations/2026-10-31-release-progress.sql` and apply it only as part of the approved release, before the new API. Test row-level security, profile deletion, ties and concurrent updates on a staging database.
- History begins with database-observed updates after the migration; earlier reigns and durations cannot be reconstructed from current scores. New board statistics populate as accounts sync.
- The supplied GoatCounter site's existence/dashboard settings were not changed or verified. Verify page counts in that account after an approved deployment. Integration follows https://www.goatcounter.com/help/js and privacy disclosure references https://www.goatcounter.com/help/privacy.
- Older numeric profile summaries require the included migration or a fresh profile sync. A defensive renderer fix in the separate NineFoldVision repository would additionally protect against malformed third-party summaries.
- Currency/progression retains the existing local-save/cloud-merge architecture; this release does not introduce a server-authoritative wallet.

## Fifteen follow-up QoL changes — implemented on the draft branch

1. Search ordinary/Secret relics by name and effect, with mode filters for Secret abilities and empty-result feedback.
2. Save up to 30 named relic loadouts, organized by mode, on this browser. Equipping is explicit and keeps only owned relics within available slots.
3. Preview current and proposed loadout luck, including the point difference, before equipping.
4. Preview the next three level/trophy road milestones and season-pass tiers.
5. Open the event calendar in Settings or the event page, with countdowns and explicit exclusive UTC endpoints, including New Year carryover.
6. See account cloud-sync status and the latest successful sync time in Settings and the phone. Switching accounts clears the timestamp; active Career cloud copies remain manual and GM leagues local.
7. Pending GM decisions trigger the browser's leave/reload warning. Internal league navigation flushes first and stays in place with an error if saving fails. Failed snapshots remain retryable; a browser shutdown cannot guarantee an asynchronous save.
8. Download diagnostics from Settings. An explicit allowlist excludes account identifiers, tokens, raw errors, URLs and saved games.
9. Filter friends by online status, activity within seven days, or gifts waiting from them.
10. Pin up to four phone apps through Rearrange. Unpinning restores their positions in the saved base order; remaining apps keep their order.
11. Compare the current Hunt, 82-0 or Survival result with the personal best, explicitly including the just-finished run.
12. Search the Settings glossary for ratings, relic effects and currencies.
13. Coin/gem shop cosmetics have an eight-second pending purchase window with Undo. No charge happens before the window ends; leaving the component or switching accounts cancels it. The final purchase rechecks ownership and funds. No refund ledger or event-currency refund is introduced.
14. Compact inventory reduces card sizes and disables inventory/reveal animation, with a browser-local preference.
15. Leaderboard details explain eligibility, stable tie ordering and the next rank's score when that row is loaded.

Quick jumps now stay fixed at the right edge while scrolling. Desktop reserves space for the rail; screens at or below 900px show a collapsible bottom-right control. Closed details are excluded until opened; jumps move keyboard focus and honor reduced motion.

### QoL validation

- Production build passed, including TypeScript, generated API/site/legal files, Windows packaging and Vite. Existing chunk-size/dynamic-import warnings remain.
- Lint: 58 existing warnings, no errors.
- Targeted regression results are recorded in `UPDATE_50_SETUP.md`.
- DOM interaction tests cover jump focus, collapsing/expanding, dynamically opened sections, phone persistence and pin/unpin order. Persistence tests cover pending/newer writes and retry after storage failure; purchase tests cover timing, undo, leaving and account changes.
- A new Chromium visual pass could not run: the browser installer received invalid/truncated downloads. Desktop/mobile visual inspection remains a release check; earlier fixture-based browser results apply to the prior feature set.
- This remains draft Update 50. Expansion Draft mode is excluded. Nothing in this QoL pass requires a new SQL migration or authorizes deployment.

## Next mode idea: The Expansion Draft

Build a new franchise from the players established teams leave unprotected. Start with limited scouting and a strict payroll, choose a development identity, then chase a playoff berth over a short five-season campaign. A shared weekly version could give everyone the same protected lists and budget, with scoring for wins, payroll efficiency and homegrown development. This is a proposal only; no new game mode or simulation engine rewrite is included here.

## Expansion continuation

See [UPDATE_50_EXPANSION.md](UPDATE_50_EXPANSION.md) for the subsequent economy, Career spin, social, notification and carryover changes and their remaining release gates. Earlier validation above describes the initial release commit.
