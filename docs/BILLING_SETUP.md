# Setting up the passes (Lemon Squeezy) for Court Vision

Two optional passes, sold through **Lemon Squeezy** (the merchant of record: it takes the payment, handles sales tax
and VAT, sends receipts and handles refunds and subscriptions):

| Pass | Type | What it gives |
|---|---|---|
| **No-Ads Pass** | one-time | No ad banners, for good, on every device the player signs in on |
| **Supporter Pass** | monthly subscription | No ads while active, plus the Supporter title, 4 supporter icons and 2 supporter name colours |

Neither pass changes the game: no ratings, spins, XP, picks or modes are for sale. Passes belong to an account, so
**accounts must be set up first** (see [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md)). Until the steps below are done, the
Passes tab in the Player Profile says the passes aren't on sale yet, and nothing else changes.

Time needed: about 20 minutes.

## 1. Update the database

Supabase → **SQL Editor** → paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) → **Run** (safe to
re-run). This adds the `entitlements` table. Players can read only their own row, and only the webhook can write it.

## 2. Create the store and the two products

1. Sign up at [lemonsqueezy.com](https://www.lemonsqueezy.com/), create a store and finish the payout and identity
   steps (the store must be activated before it can take real payments; test mode works straight away).
2. **Products → New product**:
   - **No-Ads Pass**: pricing **Single payment** (for example $3.99).
   - **Supporter Pass**: pricing **Subscription**, monthly (for example $2.99/month). You may add a yearly variant
     too; list both variant ids in step 4.
3. For each product, open it and note the **variant id** (the number in the variant's URL, or in the product's
   "Share" dialog under the variant).
4. For each product, **Share → copy the checkout link** (it looks like `https://YOURSTORE.lemonsqueezy.com/buy/…`).
5. Optional but recommended: in each product's **Confirmation modal / Redirect URL**, set the button link to
   `https://YOUR-SITE/#/profile` so players land back on their profile. The Passes tab re-checks when they return.

## 3. Create the webhook

Lemon Squeezy → **Settings → Webhooks → +**:

- **Callback URL**: `https://YOUR-SITE/api/billing`
- **Signing secret**: make up a long random string (for example the output of `openssl rand -hex 32`) and keep it
  for step 4.
- **Events**: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`,
  `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`,
  `subscription_unpaused`.

## 4. Add the settings to Vercel

Vercel → your project → **Settings → Environment Variables** (Production, and Preview if you test there):

| Name | Value |
|---|---|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | the signing secret from step 3 |
| `LEMONSQUEEZY_NO_ADS_VARIANT_ID` | the No-Ads Pass variant id |
| `LEMONSQUEEZY_SUPPORTER_VARIANT_ID` | the Supporter Pass variant id (comma-separated if more than one) |
| `VITE_LEMONSQUEEZY_NO_ADS_URL` | the No-Ads Pass checkout link from step 2 |
| `VITE_LEMONSQUEEZY_SUPPORTER_URL` | the Supporter Pass checkout link from step 2 |

The two `VITE_…` links are public (they are built into the site); the secret and variant ids stay on the server.
**Redeploy** after adding them, so the buy buttons are built in.

## 5. Test it

1. Put the store in **Test mode**, sign in to the game, open **Player Profile → Passes** and buy the No-Ads Pass with
   the test card `4242 4242 4242 4242` (any future date, any CVC).
2. Within a few seconds the webhook runs (Lemon Squeezy → Webhooks shows each delivery and its response). Back in the
   game the card says **Owned** and the ad banners are gone. If not, press **Check again**.
3. Buy the Supporter Pass the same way: the card shows **Active**, and the supporter icons, colours and title unlock
   in the Profile tab. **Manage or cancel** opens Lemon Squeezy's customer portal.
4. Switch the store to live mode when you are happy. (Test-mode and live-mode products have different variant ids and
   checkout links: update step 4 if you created separate ones.)

## How it works

- The buy button opens the checkout link with `checkout[custom][user_id]` set to the signed-in player's account id
  (and their email pre-filled). Lemon Squeezy sends that id back with every webhook for the order or subscription.
- `/api/billing` (`server/billing.ts`) checks the `X-Signature` HMAC with the signing secret, then records:
  - `order_created` for the No-Ads variant → `no_ads = true`; `order_refunded` → `no_ads = false`;
  - any `subscription_*` for a Supporter variant → `supporter_until`: the renewal date plus 3 days while active,
    on trial or past due; the end of the paid period once cancelled; nothing once expired, unpaid or paused.
    Events that arrive out of order never overwrite a newer state.
- The game reads the row when the player signs in, opens the game, or returns to the Passes tab, and keeps a copy in
  the browser (`cv-entitlements`) so it works offline. A lapsed Supporter Pass ends on its date even offline.
  Signing out forgets the copy; backups never include it.
- Deleting an account deletes its passes. It does **not** cancel a Lemon Squeezy subscription; the Passes tab tells
  players to cancel first, and you can cancel one from the Lemon Squeezy dashboard.

## Refunds

Refunds are issued from the Lemon Squeezy dashboard (Orders → the order → Refund). A refunded No-Ads Pass is taken
back automatically; for a Supporter Pass, cancel the subscription too.
