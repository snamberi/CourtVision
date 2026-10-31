# CourtVision website audit — 31 October 2026

Base: `main` at `9d28cfbe342f4f8ba403795d10085962ad624984`. This review improves the public information layer and reports unresolved risks; it is not a security certification or a guarantee of AdSense approval.

## Scope and architecture

Inventoried the repository (1,264 tracked files at the base), its documentation, public assets, build configuration, routes, game-mode entry points, storage, account/sync, advertising, consent, analytics and legal disclosures. Reviewed the relevant implementations for FAQ claims; did not line-audit every simulation function or execute all game scenarios.

The application uses React 19, TypeScript, Vite, Dexie/IndexedDB and background simulation workers. `src/App.tsx` and the navigation modules manage the game; `MainMenu.tsx` and `menu/modeCatalog.ts` expose seven main modes and additional setups. Static information pages are generated from `src/content/sitePages.json` by `scripts/generate-site-pages.mjs`. Privacy has a separate JSON source and both React/static renderers. Cloudflare Worker and Pages adapters share server handlers; Supabase provides optional authentication, progress and online features. Existing deployment configuration is retained.

The site already had About, FAQ, How to Play, seven guides, Changelog, Privacy, canonical/OG/Twitter metadata, structured data, ads.txt and build-generated robots/sitemap assets. Missing files in `public/` do not mean robots.txt or sitemap.xml were absent: Vite emits them. No standalone Contact or Terms page was present in the repository.

## Findings by severity

| Severity | Evidence and status | Finding / action |
| --- | --- | --- |
| Critical | None established in this scoped review | No claim that the entire application is free of security or accessibility issues. Live authenticated flows and infrastructure were not audited. |
| High | Verified; fixed | Top-level generated pages used `href=""` for brand, Play free and Start a league. Browsers reload the current information page. Generator now uses `./`; nested guide links retain `../`. Regression tests use real URL resolution and reject empty hrefs. |
| High | Verified; fixed | Old FAQ listed the wrong seven main modes, omitting Survival, Story and Your Career, and said everything worked without an account. Replaced 18 questions with 39 source-checked answers and separated local play from online functions. |
| High | Verified; fixed | `index.html` injected AdSense solely by hostname, before runtime GPC and no-ad entitlement checks. Removed that duplicate path; retained publisher verification meta and ads.txt. Existing `AdBanner`/`adPolicy` owns loading. This does not independently validate Google's configured CMP or regional behavior. |
| High | Verified; partially addressed | Privacy contact email is empty and fallback text sent visitors to unspecified contact details. Added Contact using the existing Discord URL and linked it from both privacy renderers. An independently reachable private support address remains desirable; Discord delivery/invite membership was not tested. |
| High | Verified; owner review needed | Privacy says leagues are never uploaded, but `src/cloud/onlineLeague.ts` uploads shared snapshots to the private `online-leagues` Supabase bucket. `src/cloud/merge.ts` also syncs active Your Career player data. FAQ now states these exceptions. Review policy Sections 1, 4, 7–9 and 12 for consistent, qualified disclosures. |
| High | Verified inconsistency; configuration unknown | Policy Section 6 says consent is stored only in the app's localStorage, but `AD_CONFIG.googleCmp=true` delegates to Google's consent tooling; the app's fallback consent record is not a complete description of Google's storage. Policy also promises Cookie Settings in every footer, while static pages do not initialize the CMP. Reconcile wording and confirm the published regional message in AdSense. |
| High | Verified; owner decisions required | No Terms page was found. Do not manufacture governing law, purchase/refund commitments or age rules. The existing policy's children's-data language should be reconciled with optional accounts and social features. Retention, deletion of shared storage objects, backups and third-party records need operational confirmation before promises are published. Absence of Terms is not asserted to be Google's rejection reason or an automatic AdSense requirement. |
| Medium | Verified; fixed | FAQ navigation was a long flat list without search. Added five topic sections, labeled search, live result count, clear control, zero-result help, native details/summary, visible focus and skip navigation. Content and accordion operation remain available without JS. Retained old question anchors or aliases where questions were consolidated. |
| Medium | Verified; fixed | About and beginner setup instructions lagged current menu grouping. Updated the developer introduction, current modes and backup explanation; linked Contact from the game footer and static navigation. Extended the sitemap and refreshed generated text summaries. |
| Medium | Verified; remains | Build warns about a roughly 600 kB minified entry chunk (~196 kB gzip) and an ineffective dynamic import of `onlineLeague.ts`. Historical data is ~2.5 MiB. Existing code splitting/workers help, but no network throttling or Core Web Vitals measurement was completed. Avoid speculative engine changes or asset deletion. |
| Medium | Source verified; live impact unconfirmed | Cloudflare config uses SPA fallback for unknown non-API paths, potentially returning the game for nonexistent information URLs (soft 404s). One live HEAD request redirected `/faq.html` to `/faq`, while canonicals use `.html`. Check the selected canonical in Search Console and actual unknown-route status before changing hosting behavior. |
| Low | Verified | Existing FAQ structured data is retained and generated from the same visible answer source. It is not an approval mechanism or a promise of Google rich results. Several existing guide summaries and the historical changelog deserve periodic editorial review as releases change. |

## AdSense assessment: evidence versus hypotheses

Verified defects above can harm usability or the accuracy of the site's public explanations. They are plausible contributing factors, not proof of Google's internal rejection rationale. The repository contains substantial original game functionality and crawlable guides; it would be inaccurate to call it an empty site or to recommend filler articles merely to increase word count.

Official references consulted:

- [AdSense: site not ready to show ads](https://support.google.com/adsense/answer/12176698?hl=en): accessibility, unique value and navigation matter; the account's review is authoritative.
- [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en): review placement, navigation and prohibited encouragement. Existing banner components label ads “Advertisement” and hide development sponsors in production; no new ads or incentives were added.
- [Google CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en): certified TCF CMP requirements for personalized ads in EEA/UK/Switzerland. A boolean in source does not demonstrate a published, functioning message.
- [Google Search: helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): prioritize useful original explanations and accuracy, rather than keyword stuffing or artificial length.
- [Structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): markup should represent page content; no rich-result claim is made.

Live checks were limited: curl HEAD followed `/faq.html` through a 307 to `/faq` and received 200. Other GETs for home, FAQ, About, Privacy and sitemap returned 403 in this environment; web retrieval also failed. robots.txt was reachable and included Cloudflare-managed crawler rules in addition to source-generated rules. This proves a difference in the served robots layer, not that Googlebot/AdSense are blocked. Verify crawler access with Search Console URL Inspection, AdSense diagnostics and Cloudflare logs. No firewall or deployment changes were made.

## FAQ source map

| Topics | Sources inspected |
| --- | --- |
| Seven modes, variants, franchise setup | `src/components/MainMenu.tsx`, `src/menu/modeCatalog.ts`, `src/App.tsx` |
| Hunt and Survival rules | `src/hunt/run.ts`, `src/survival/run.ts` |
| Career, Story, Your Career | Corresponding component/model directories, menu entry points and existing guides |
| Ratings, scouting and historical development | `src/simulation/types.ts`, `src/components/DraftPage.tsx`, scouting/history modules and ratings guides |
| Relics and Lucky Spins | `src/relics/relics.ts`, Vault components and apply/reward modules |
| Local saves, backups and recovery | `src/storage/backup.ts`, `saves.ts`, `autosave.ts`, `BackupPanel.tsx`, `SaveRecoveryPanel.tsx` |
| Accounts, public progress and deletion | `src/cloud/account.ts`, `sync.ts`, `merge.ts`, `onlineLeague.ts`, server sync handler and Supabase schema/migrations |
| Ads, cookies and analytics | `index.html`, `src/ads/*`, `src/consent/*`, `AdBanner.tsx`, `WebAnalytics.tsx`, `analytics/track.ts`, privacy JSON |

No unreleased update-50 mechanics or planned relic changes were described. For example, the checked main branch implements ten standard Hunt series, not the twenty-stage version mentioned elsewhere.

## Validation and limits

- `npm run build` passed, including TypeScript project checks, API bundling, Windows packaging and Vite web output. Existing chunk-size and mixed-import warnings remain.
- 45 targeted tests across 10 site-page, FAQ interaction, privacy, consent, ad, save/backup and menu suites passed on the final rerun.
- Lint completed with 58 existing warnings (mostly React hooks/components); no errors. No new dependencies added.
- Interaction checks cover no-JS HTML structure, native accordion markup, answer search, no-results, clear/focus behavior, saved open state, old anchors and topic navigation; internal static links use browser URL semantics.
- Real Chromium desktop/mobile screenshot runs were attempted, but the executable was unavailable and browser download failed. DOM tests do not establish visual layout, contrast compliance, screen-reader behavior or real mobile performance. Manually test narrow mobile and desktop widths before merge.
- No production account was created/deleted, no live purchase made, no ad clicked, and no real user save was modified. Full engine test suite and all mode scenarios were not run because simulation behavior is unchanged.
- The build regenerates the tracked Windows ZIP. Its binary churn is excluded from this source PR because the existing production build recreates it; packaging itself was exercised.

## Owner checklist before requesting another review

1. Review the PR and mobile/desktop FAQ, search, keyboard navigation, Contact and Play links. Merge/deploy only when approved.
2. Confirm AdSense Privacy & messaging is published for the production domain; test refusal, withdrawal, GPC and ad-free accounts in applicable regions. Inspect Auto ads settings separately from explicit banner placements.
3. Reconcile privacy disclosures with Online Leagues, Your Career, social records, consent storage, deletion and actual retention; supply a private contact method and reviewed Terms if appropriate.
4. Use Search Console URL Inspection and AdSense crawler diagnostics on home, FAQ and guides. Check redirects, Cloudflare rules and sitemap delivery; do not assume the 403 responses here describe Google access.
5. After the reviewed changes are deployed and the unresolved items checked, request an AdSense review. No approval date or outcome can be guaranteed.
