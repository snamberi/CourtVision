# AdSense "Low value content" fixes: 12 November 2026

This follows up [WEBSITE_AUDIT_2026-10-31.md](WEBSITE_AUDIT_2026-10-31.md) after AdSense rejected the site for **Low value content**. Google does not publish exact reasons for a rejection. The changes below fix verified problems against the [AdSense program policies](https://support.google.com/adsense/answer/48182), the [publisher policies on content and user experience](https://support.google.com/adsense/answer/10015918), and [Google's guidance on thin content](https://developers.google.com/search/docs/essentials/spam-policies#thin-affiliate-pages). They make approval more likely but cannot guarantee it.

## What changed

| Problem | Policy reason | Fix |
| --- | --- | --- |
| An ad unit on the **main menu**, which is a navigation screen | Google-served ads may not appear on screens with no publisher content, or on screens used for navigation | Removed the main-menu ad. `adsAllowedOnTab()` in `src/ads/adPolicy.ts` now limits in-game ads to read-only content screens (stats, standings, box scores, news, history and records). |
| Ads on every in-game screen, including editors, settings, trades, the draft, free agency and autoplay | No ads on screens without content or on screens where accidental clicks are likely | Same allowlist. Tests check that each excluded screen stays excluded. |
| The home page rendered only buttons once JavaScript ran | Thin content: the landing page explained nothing | The main menu now has a **Learn Court Vision** section: a description of the game and every guide with a summary (`MenuLearn.tsx`, built from `src/content/guideIndex.json`). It is hidden in the offline Windows build. |
| Mode guides were short (260-810 words of unique text each), and Survival, Story Mode and Your Career had no guide | The site needs substantial, original value | Six new guides, about 4,000 words, each checked against the source code: How the simulation works, Badges explained, Survival, Your Career, Story Mode, and Coaching and player development. They were added to the sitemap, the guides index, the no-JavaScript home page, llms.txt and the changelog. |
| Unknown URLs returned the whole game with HTTP 200 (soft 404s) | Duplicate, thin pages in the index | `wrangler.jsonc` now uses `not_found_handling: "404-page"` with a generated `404.html` marked noindex. The game only uses `#/` routes, so nothing depends on the old fallback. |
| The privacy policy contradicted itself (see below) | AdSense requires an accurate privacy disclosure | Fixed in `src/legal/privacyPolicy.json`, then regenerated `privacy.html`. |

The privacy policy contradictions were:
- "No account" and "leagues never uploaded", while optional accounts and Online Leagues exist.
- "No purchases", alongside the Support Shop.
- Advertising "off by default", while ads load outside the EEA.
- A "Cookie Settings link in every footer", which the static pages do not have.
- No mention of clubs, clans, gifts or profile views.

## Steps for you before requesting review

These steps happen in Google's and Cloudflare's dashboards, so they cannot be done from the code.

1. **Deploy** `main` and confirm all four of these on the live site:
   - `https://courtvisiongame.com/guides/survival.html` loads.
   - A made-up URL such as `/nope` returns **404**.
   - `/sitemap.xml` lists 21 URLs.
   - `/ads.txt` is reachable.
2. **AdSense → Ads → By site → Auto ads:** turn Auto ads **off**, or exclude the main menu. Auto ads can put ads on any page once the script has loaded, which would undo the placement fix.
3. **AdSense → Privacy & messaging:** confirm the European regulations message is published for courtvisiongame.com, since `googleCmp` is set to true in `adConfig.ts`.
4. **Search Console:**
   - Submit the sitemap.
   - Run URL Inspection on the home page and two new guides. Check that Googlebot is not blocked, since Cloudflare-managed robots rules were noted in the last audit.
5. **Wait for indexing:** wait until the new guides are indexed, which is often one to two weeks, then click **Request review** in AdSense. Requesting review straight after deploying tends to reuse the old crawl.
6. **Still open from the earlier audit:**
   - Terms of Use. This needs your decisions on governing law, purchases and refunds.
   - A private support email in the privacy policy (`contactEmail` is empty).
   - Your decision on the age statement now that accounts and social features exist.

## Verification

- `npm run build` passes. The Windows ZIP the build regenerates was not committed.
- The full Vitest suite was run. The result is in the commit message.
- A Chromium check at 1280 px and 390 px showed that the menu has no ad slot and shows 14 guide links, with no horizontal overflow and no page errors.
