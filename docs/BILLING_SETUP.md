# Setting up the Support Shop (Lemon Squeezy) for Court Vision

The **Support Shop** (`#/support`, the heart button in the menu header) sells six optional products through
**Lemon Squeezy** (the merchant of record: it takes the payment, handles sales tax and VAT, sends receipts and handles
refunds and subscriptions). The page says up front that nobody has to buy anything and that the money goes to hosting.

| Product | Price | Type | Unlocks |
|---|---|---|---|
| **Supporter Pass** | $4.99 | monthly | No ads while active; gold ball, blackout sneaker, gold jersey and heart icons; Aurora and Supporter pink colours; *Supporter* title |
| **No-Ads Pass** | $3.99 | monthly | No ads while active; *Clean Court* icon, *Clear Sky* colour, *Ad-Free Baller* title |
| **Supporter Bundle** | $0.99 | one-time | *Thank-You Heart* icon, *Warm Thanks* colour, *Backer* title |
| **Visionary Supporter Bundle** | $2.99 | one-time | *Vision Eye* icon, *Visionary* colour, *Visionary* title |
| **Eternal Founder Bundle** | $9.99 | one-time | *Eternal Phoenix* icon, *Eternal Gold* colour, *Eternal Founder* title |
| **Custom Support Bundle** | $0.99+ (pay what you want) | one-time | *Gift Box* icon, *Kindness* colour, *Patron* title |

Nothing changes the game: no ratings, spins, XP, picks or modes are for sale. The names, prices and perks shown in the
game live in `src/billing/products.ts`; keep them matching Lemon Squeezy. Purchases belong to an account, so
**accounts must be set up first** (see [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md)). A product without a checkout link
shows "Not on sale here yet".

After a purchase reaches the game, a **thank-you popup** shows what it unlocked (once per product). Monthly passes have
a **Cancel pass** button on their card: one confirmation, and the game cancels it through the Lemon Squeezy API
(perks last to the end of the paid month). Without an API key it opens Lemon Squeezy's own page instead.

Time needed: about 30 minutes.

## 1. Update the database

Supabase → **SQL Editor** → paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) → **Run** (safe to
re-run), or just [`supabase/migrations/2026-10-25-support-shop.sql`](../supabase/migrations/2026-10-25-support-shop.sql)
if the `entitlements` table already exists. Players can read only their own row, and only the server can write it.

## 2. The products in Lemon Squeezy

1. Sign up at [lemonsqueezy.com](https://www.lemonsqueezy.com/), create a store and finish the payout and identity
   steps (the store must be activated before it can take real payments; test mode works straight away).
2. Create the six products above (**Subscription**, monthly, for the two passes; **Single payment** for the bundles;
   for the Custom Support Bundle turn on **pay what you want** with a $0.99 minimum).
3. For each product, note the **variant id** (the number in the variant's URL, or in the product's "Share" dialog).
4. For each product, **Share → copy the checkout link** (`https://YOURSTORE.lemonsqueezy.com/buy/…`).
5. Recommended: in each product's **Confirmation modal / Redirect URL**, set the button link to
   `https://YOUR-SITE/#/support` so players land back in the shop, where the thank-you popup greets them.
6. For the in-game cancel button: **Settings → API → +** to create an API key (keep it for step 4).

## 3. Create the webhook

Lemon Squeezy → **Settings → Webhooks → +**:

- **Callback URL**: `https://YOUR-SITE/api/billing`
- **Signing secret**: make up a long random string (for example the output of `openssl rand -hex 32`) and keep it
  for step 4.
- **Events**: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`,
  `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`,
  `subscription_unpaused`.

## 4. Add the settings

On Cloudflare: the Worker's **Settings → Variables and Secrets** for the server values, and **Builds → Variables** for
the `VITE_` links (they are built into the game). On Vercel: **Settings → Environment Variables** for all of them.

| Name | Value |
|---|---|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | the signing secret from step 3 |
| `LEMONSQUEEZY_API_KEY` | the API key from step 2.6 (optional: enables the one-tap cancel) |
| `LEMONSQUEEZY_SUPPORTER_VARIANT_ID` | Supporter Pass variant id (comma-separated if more than one) |
| `LEMONSQUEEZY_NO_ADS_VARIANT_ID` | No-Ads Pass (monthly) variant id |
| `LEMONSQUEEZY_BUNDLE_SUPPORTER_VARIANT_ID` | Supporter Bundle variant id |
| `LEMONSQUEEZY_BUNDLE_VISIONARY_VARIANT_ID` | Visionary Supporter Bundle variant id |
| `LEMONSQUEEZY_BUNDLE_FOUNDER_VARIANT_ID` | Eternal Founder Bundle variant id |
| `LEMONSQUEEZY_BUNDLE_CUSTOM_VARIANT_ID` | Custom Support Bundle variant id |
| `LEMONSQUEEZY_NO_ADS_LIFETIME_VARIANT_ID` | only if you once sold a one-time No-Ads Pass: its variant id, so refunds still work |
| `VITE_LEMONSQUEEZY_SUPPORTER_URL` | Supporter Pass checkout link |
| `VITE_LEMONSQUEEZY_NO_ADS_URL` | No-Ads Pass checkout link |
| `VITE_LEMONSQUEEZY_BUNDLE_SUPPORTER_URL` | Supporter Bundle checkout link |
| `VITE_LEMONSQUEEZY_BUNDLE_VISIONARY_URL` | Visionary Supporter Bundle checkout link |
| `VITE_LEMONSQUEEZY_BUNDLE_FOUNDER_URL` | Eternal Founder Bundle checkout link |
| `VITE_LEMONSQUEEZY_BUNDLE_CUSTOM_URL` | Custom Support Bundle checkout link |

The `VITE_…` links are public; the secret, API key and variant ids stay on the server. **Redeploy** after adding them.

## 5. Test it

1. Put the store in **Test mode**, sign in to the game, open the **Support Shop** (heart button in the menu header) and
   buy a bundle with the test card `4242 4242 4242 4242` (any future date, any CVC).
2. Within a few seconds the webhook runs (Lemon Squeezy → Webhooks shows each delivery and its response). Back in the
   game the thank-you popup appears and the card says **Owned**; the icon, colour and title are in the Profile. If
   not, press **Check again**.
3. Subscribe to a monthly pass the same way: the card shows **Active** and the ads are gone. Press **Cancel pass** →
   **Yes, cancel**: the card shows **Cancelled · perks until …**.
4. Switch the store to live mode when you are happy. (Test-mode and live-mode products have different variant ids and
   checkout links: update step 4 if you created separate ones.)

## How it works

- The buy button opens the checkout link with `checkout[custom][user_id]` set to the signed-in player's account id
  (and their email pre-filled). Lemon Squeezy sends that id back with every webhook for the order or subscription.
- `/api/billing` (`server/billing.ts`) checks the `X-Signature` HMAC with the signing secret, then records:
  - `order_created` for a bundle variant → adds it to `bundles`; `order_refunded` → removes it (a lifetime No-Ads
    variant sets `no_ads` the same way);
  - any `subscription_*` for a Supporter or No-Ads variant (each in its own columns) → `supporter_until` or `no_ads_until`: the renewal date plus 3 days while active,
    on trial or past due; the end of the paid period once cancelled; nothing once expired, unpaid or paused.
    Events that arrive out of order never overwrite a newer state.
- The game reads the row when the player signs in, opens the game, or returns to the Support Shop, and keeps a copy in
  the browser (`cv-entitlements`) so it works offline. A lapsed Supporter Pass ends on its date even offline.
  Signing out forgets the copy; backups never include it.
- Deleting an account deletes its passes. It does **not** cancel a Lemon Squeezy subscription; the Support Shop tells
  players to cancel first, and you can cancel one from the Lemon Squeezy dashboard.

## Refunds

Refunds are issued from the Lemon Squeezy dashboard (Orders → the order → Refund). A refunded bundle is taken back
automatically; for a monthly pass, cancel the subscription too.
