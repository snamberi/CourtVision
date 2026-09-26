# Ad loading and scroll update

Two reproduced ad lifecycle bugs were corrected:

- A submitted unit was removed after 20 seconds whenever it was not yet marked filled. Slow responses now remain mounted. Explicit unfilled responses and load failures still fall back cleanly.
- A publisher script inserted separately could have completed loading before the component subscribed to its load event. The loader now recognizes an already initialized AdSense queue and reuses the script.

The shared script download has a 30-second timeout, and cancelling it settles pending callers. Consent remains required; the patch does not override a visitor's choice or enable ads in the Windows edition. Publisher and slot IDs are unchanged.

Responsive ad units use their own content height rather than inheriting a percentage height. Main/sidebar panes allow normal scroll chaining while retaining independent scrollbars. Ad frames remain clickable and unobstructed: no mouse interception or overlay is placed over ads.

Validation: the two new regression tests fail against the previous implementation and pass after the fix. All 20 targeted ad/consent/UI tests pass. TypeScript and web/Windows builds pass. Production-browser tests with simulated filled and blocked ad responses pass for main and sidebar wheel scrolling, including a wheel gesture over a sandboxed ad iframe. No live ad impressions or clicks were used for these checks.

These checks do not verify Google's serving response on the published domain. A live site URL is needed to investigate remaining deployment, consent, blocking or account-side causes. The user-reported scroll failure has not been reproduced with real Google creatives.

## Update: ads that appeared for a second and then vanished

Reproduced in the production build with a stand-in for Google's script: when Google answers a request with "no ad" (`data-ad-status="unfilled"`), the empty "Advertisement" frame had already been drawn, so it showed for about a second and then disappeared. Filled ads were never removed.

- A Google unit now stays collapsed (full width, zero height, so Google can still size the ad) until Google reports an ad. Unfilled answers therefore show nothing at all, and filled ads open in place. Older ad tags that never report a status are revealed once Google has drawn an ad frame.
- After an unfilled answer, the next page change may ask Google once more: at most every 30 seconds and 3 times per slot per visit, never on a timer and never for a slot that is showing an ad (AdSense forbids automatic refreshes).
- `index.html` now carries Google's `google-adsense-account` meta tag, so Google can verify the site even though the ad script itself still waits for the visitor's consent. The tag loads nothing and sets no cookies.

Why Google sends "no ad" is decided in the AdSense account, not in the game. The usual causes: the site isn't approved yet (Sites → status "Ready"), `ads.txt` isn't authorized for the domain, the page runs on a domain that isn't on the Sites list (for example a Vercel preview address), or there is little demand for the visitor's region. Check those in AdSense if slots stay empty.

Validation: new tests cover the collapsed state, reveal on fill, rate-limited retry on navigation, the retry cap and the no-refresh rule for filled units. The production build with a stand-in ad script showed 0 px while waiting, nothing for unfilled answers and a 106 px banner for filled ones.
