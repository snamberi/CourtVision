# Update 50 — release branch review

Branch: `release/update-50`. Keep this release in draft. Do not merge or deploy until Snamberi explicitly approves.

## Implemented

- Three permanent Franchise mission Secrets: Draft Whisperer, Loyalty Pays and The Rebuilder.
- Four Halloween Secrets and four Christmas Secrets, with actual run/league effects rather than catalog entries alone.
- Seven further event Secrets, making 18 new Secrets total. Each has pixel-grid SVG artwork.
- Nine annual UTC events, independent year-specific currency and spin-key balances, overlap-aware rewards, event shops, event selector, and event-only Secret drops. Halloween and Christmas retain their existing cosmetics; the seven new shops each add a title and name color.
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

Keys cost 10 of the matching event currency. Old event-year balances do not transfer to a new year. Unlocked cosmetics and Secrets remain owned.

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

## Fifteen suggested follow-up QoL changes

1. Search relics by name, effect and eligible game mode.
2. Save named relic loadouts for each mode.
3. Compare current versus proposed loadout luck before equipping.
4. Preview the next three progression rewards in a compact card.
5. Add an event calendar with countdowns and explicit UTC times.
6. Show a save-status badge with the latest successful cloud sync time.
7. Warn before leaving a simulation with unsaved decisions.
8. Add a one-click diagnostic report that excludes account tokens and private save data.
9. Add filters for friends who are online, recently active or have gifts waiting.
10. Let players pin favorite phone apps without changing the remaining order.
11. Add a personal best versus current run comparison on result screens.
12. Provide a searchable glossary for ratings, relic effects and currencies.
13. Add an undo step for accidental cosmetic purchases where technically safe.
14. Offer a compact/reduced-animation inventory view for slower phones.
15. Explain leaderboard eligibility, tie rules and the next rank's score in place.

## Next mode idea: The Expansion Draft

Build a new franchise from the players established teams leave unprotected. Start with limited scouting and a strict payroll, choose a development identity, then chase a playoff berth over a short five-season campaign. A shared weekly version could give everyone the same protected lists and budget, with scoring for wins, payroll efficiency and homegrown development. This is a proposal only; no new game mode or simulation engine rewrite is included here.
