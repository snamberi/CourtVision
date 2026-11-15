# Update 50 expansion — development checkpoint

Branch: `release/update-50`. Keep PR #47 in draft. Do not merge or deploy until the developer approves the completed release.

## Implemented in source

- Ten additional Mythic relics and two Secret relics, with artwork.
- Mythic base odds halved; 500-spin Mythic pity; 25 Legendary spares for Mythic crafting.
- Normal spins cost 200 coins, Lucky spins 1,000 and use 1.5× luck; Ultra spins cost 20 gems and draw Epic or better, with a 1% regular Secret roll (existing Secret pity still applies).
- Equipped relic coin bonuses, non-Mythic luck reduction, increased Mythic luck/coin bonuses and a second Mythic upgrade costing 100,000 coins and 50 gems.
- Once-per-UTC-day chest with two spins, 200 base coins, 2–5 relic rolls and 12–30 gems; three gem-shop name colours.
- Gem receipt merging to preserve spending across ordinary cloud sync. This remains a client-managed economy, not a server-authoritative wallet; simultaneous offline spending is not transactionally protected.
- Career Lucky reels contain only Career Legendary/Mythic cards, with 70/30 selection. Mythics receive a 110-rated category floor. Ultra Cheat uses 130.
- CourtChat opens inside the phone, with messages and recent-chat-visitor count. SQL defines authenticated RPCs, posting cooldown and message cleanup.
- Owner custom-gift API and form, friend filters and public profile favourites.
- Sandbox ratings presets from recorded historical player seasons. Existing Sandbox import already supports duplicate players with unique IDs and selecting a historical season/age; unavailable historical ages are not fabricated.
- 100 additional achievements, named road divisions, and Court Score activity bonuses (20 points per completed run, maximum five per UTC day), without rescaling existing points.
- Rewarded-spin UI behind `VITE_REWARDED_ADS_ENABLED`, granting only on the provider's completed-view callback, limited locally to three rewards per rolling hour. Disabled by default; no live provider setup or verification.
- Privacy disclosure for CourtChat, custom gifts, favourites and synced reward history.

- Phone notification centre with account-isolated device-local read status, unread badge, gift messages, friend results, one-minute visible-menu refresh and explicit partial-error/retry states. Pending requests from a signed-out account are discarded.
- Unused event currency and keys now carry into later years of the same event. Annual counters remain monotonic for cloud merges; no reward-copy migration is used. Shops/spins still require the matching event to be active.

## Validation

November 2 continuation: 101 regression tests passed across 13 files, including the recovered economy/Career changes, gift API, notification UI/account switching, partial network failures and annual currency/key carryover. Production build passed (TypeScript, API bundles, generated pages, Windows package and Vite). Build warnings about chunk sizes/mixed imports remain. Lint completed with warnings and no errors.

Earlier checkpoint checks:

- 64 economy/relic tests pass across six files.
- Three Court Score merge/limit tests pass.
- Targeted Career Lucky test passes, checking every reel slot and sampled 70/30 outcomes.
- All Career Mythic/Legendary cards pass their 110/100 rating-floor test.
- Four rewarded-ad callback tests pass (disabled config, provider failure, exactly-once reward, incomplete video).
- Production build passes, including API compilation, generated legal pages and Windows package.
- Lint completes with warnings, no errors.

## November 2 completion pass

Implemented recoverable gift receipts and sync recovery; clan pass and completed-week rewards with database duplicate-claim protection; private complete active Career snapshots with manual upload/load/delete and revision conflict checks; background push opt-in, service-worker delivery and the Cloudflare scheduled dispatcher. Updated privacy/FAQ copy. The one-paste Supabase install/update is `supabase/UPDATE_50_ALL_IN_ONE.sql`.

Current validation and precise activation steps are in [UPDATE_50_SETUP.md](UPDATE_50_SETUP.md). The code is prepared, not deployed. Applying SQL, adding push keys, hosted account/provider testing and approved rewarded-ad provider configuration remain external setup steps. No live configuration has been changed.
