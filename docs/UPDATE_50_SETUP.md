# Update 50 setup

The completed source is on `release/update-50`. Do not merge or deploy until Snamberi approves. SQL and push settings are not applied automatically.

## One Supabase script

Open **Supabase → SQL Editor → New query**, paste **all** of `supabase/UPDATE_50_ALL_IN_ONE.sql`, and click **Run**. It includes the core schema and all required Update 50 changes: profile/leaderboard history, CourtChat, custom gifts, recoverable reward receipts, clan rewards, private active Career snapshots and the push queue.

Run it once before deploying the matching branch. The script has one transaction, retains users/saves, and can be rerun. It does not choose an owner account, change OAuth providers or contain credentials. The current project’s existing sign-in configuration and Cloudflare Supabase variables remain necessary. Do not run the older individual migrations afterward.

The generated script is reproducible with `python3 scripts/build-update50-sql.py`. `npm run test:sql` executes a fresh install, reruns, and account-isolation/reward/Career/push scenarios using embedded PostgreSQL. The test supplies local stand-ins for Supabase’s auth/storage schemas; it is not a hosted Supabase or OAuth test.

## Enable background push on Cloudflare

1. Generate the VAPID keys once: `node scripts/generate-push-keys.mjs`.
2. In the CourtVision Worker’s **Settings → Variables and Secrets**, add `PUSH_VAPID_PUBLIC_KEY`, **secret** `PUSH_VAPID_PRIVATE_KEY`, and `PUSH_VAPID_SUBJECT` (use `https://courtvisiongame.com`). Keep these keys stable. Never use a `VITE_` prefix for the private key or commit it.
3. Deploy only after release approval. `wrangler.jsonc` includes a five-minute scheduled trigger. The scheduled handler uses the same Supabase server credentials as the existing API. Ensure Cron Triggers is enabled for the production Worker; do not schedule a preview against production data.
4. In CourtVision’s phone → Notifications, press **Enable push on this device** and allow the browser prompt. Mobile Safari requires a Home Screen installation. Enable on each device separately.
5. Test a gift between two test accounts, close the recipient’s tab, wait for the scheduled delivery, and verify the generic notification opens CourtVision. Disable push and confirm the browser subscription is removed.

Push delivers generic gift and friend-score alerts without sending private message text. Friend activity is limited to one alert per friend per hour. Expired endpoints are removed; failed jobs retry up to five attempts. Signing out unsubscribes the device. The existing offline service worker handles push; it is not replaced by a second worker. The API remains available on Vercel, but automatic dispatch is wired to Cloudflare Cron Triggers, the site’s current host.

References for this implementation: [Push API](https://www.w3.org/TR/push-api/) and [VAPID RFC 8292](https://www.rfc-editor.org/rfc/rfc8292).

## New player flows

- **Gifts:** claiming creates a permanent reward receipt and marks the gift claimed in the same SQL transaction. Local rewards and the receipt are written together. Retrying after a dropped response or full disk is safe; account sync recovers receipts as well. Previously claimed legacy gifts cannot be reconstructed if their contents were already lost before this migration.
- **Clans:** every five shared pass tiers pays 500 coins, one spin and five gems, once per account per milestone. Completed-week rewards: #1 gets 3,000/5/50 coins/spins/gems; #2–3 gets 2,000/4/30; #4–10 gets 1,000/3/20; remaining scoring clans get 500/2/10. The previous week settles once when first claimed. Eligible players must still be members, have joined before that week began and have scored that week. These eligibility rules and amounts are displayed in the UI. Switching clans cannot repeat a pass or weekly reward.
- **Career:** Settings → Active Career cloud saves. Save a complete local Career, then load it on another device. Manual opt-in, ten cloud copies per account, 20 MB each. Revision checks reject stale overwrites. Loading asks before replacing the matching local Career; deleting a cloud copy leaves the local one intact. A conflicted save stays local until the player explicitly loads the cloud version.

## Verification and release boundary

- 137 targeted tests across 22 files passed, covering receipt replay/disk failure/account switching, Career conflicts/restores, push endpoint restrictions and VAPID signatures, existing sync, gifts, clans, economy and Career reels.
- Embedded PostgreSQL: fresh install, rerun, rerun with existing users/saves; gift recovery and RLS; clan duplicate claims; Career compare-and-swap and RLS; push authorization and leasing all passed.
- Production build passed (TypeScript, API bundles, generated pages/privacy, Windows package, Vite). Existing bundle warnings remain. Lint: 58 warnings, no errors.
- Desktop/mobile Chromium checks use local test-account/API fixtures, not live credentials. Settings/Career, clan collection, notification messages and read actions were exercised. No runtime page errors or horizontal overflow on the checked mobile Settings screen.
- Not performed: applying SQL to the hosted project, live OAuth/multi-device Supabase checks, or delivery to a real push provider. Those require the project configuration above and a release/staging environment.
- Rewarded ads remain disabled until a real approved provider is configured and its completed-view callback is verified. No simulated ad is represented as a real ad view.

The broader game economy retains its existing client-managed merge model. Durable receipts solve recoverable reward delivery; they do not make every offline coin/spin transaction server-authoritative.

## Saving-only release — November 3, 2026

PR #48 merged manual Career cloud saving and account-switch sync guards into main. This draft includes that fix; the remaining Update 50 features are still held. Hosted Supabase Career schema, ownership policies and RPC grants were verified. No additional SQL run is required for the existing configured project.

Remaining activation checks: confirm the Cloudflare production deployment of main, then authenticated save/load on two devices. Background push still needs Cloudflare VAPID secrets and a production delivery test; no Cloudflare connection was available in this session. Rewarded ads still need an approved provider. Neither live delivery nor multi-device gameplay is claimed as tested.

## QoL continuation — November 3, 2026

The draft now includes main's Google OAuth callback fix from PR #49 as well as PR #48's saving fix. The fifteen QoL suggestions are implemented as described in `UPDATE_50_RELEASE.md`, together with a fixed right-side quick-jump rail (collapsible on small screens). Expansion Draft mode remains a proposal, excluded from this work.

Validation: 85 targeted tests across 10 files passed; production build passed; lint retained 58 existing warnings with no errors. Added checks cover safe delayed purchases, account-switch cancellation and sync timestamps, loadout ownership/slot limits, calendar year rollover, sanitized diagnostics, phone pin order, section navigation and failed-save retries. Browser visual checks for this continuation remain outstanding because Chromium downloads failed. The Windows archive is regenerated during the deployment build rather than committed in this source change.

PR #47 remains draft and unmerged. This change does not activate push, rewarded ads or a production deployment, and does not apply SQL. The activation requirements above still apply.
