# Setting up the Support Shop (Paddle) for Court Vision

The **Support Shop** (`#/support`, the heart button in the menu header) sells six optional products through
**Paddle** (the merchant of record: it takes the payment, handles sales tax and VAT, sends receipts and handles
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
game live in `src/billing/products.ts`; keep them matching Paddle. Purchases belong to an account, so **accounts must
be set up first** (see [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md)). A product without a price ID shows "Not on sale here yet".

Buying opens **Paddle's checkout over the game** (no new tab). When it finishes, the shop checks for the purchase a few
times and a **thank-you popup** shows what it unlocked (once per product). Monthly passes have a **Cancel pass**
button: one confirmation, and the game cancels it through the Paddle API at the end of the paid month (without an API
key it opens Paddle's cancel page instead). The **Custom Support Bundle** has an amount picker ($0.99 to $500): with an
API key the server makes a one-off price for the amount chosen; without one, it sells at the bundle's catalog price.

Time needed: about 30 minutes.

## 1. Update the database

Supabase → **SQL Editor** → paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) → **Run** (safe to
re-run), or just [`supabase/migrations/2026-10-25-support-shop.sql`](../supabase/migrations/2026-10-25-support-shop.sql)
if the `entitlements` table already exists. Players can read only their own row, and only the server can write it.

## 2. Paddle

Work in the **sandbox** first ([sandbox-vendors.paddle.com](https://sandbox-vendors.paddle.com/)), then repeat in live.

1. **Catalog → Products**: the six products above. Give the two passes a **monthly recurring** price and the bundles a
   **one-time** price ($0.99 for the Custom Support Bundle). Note each **product ID** (`pro_…`) and **price ID** (`pri_…`).
2. **Checkout → Checkout settings**: set the **default payment link** to your site (for example
   `https://courtvisiongame.com/`) and approve the domain if Paddle asks. The checkout opens over the game.
3. **Developer tools → Authentication**: create a **client-side token** (`live_…` / `test_…`), and an **API key** with
   permission for subscriptions (write) and transactions (write). The API key powers the Cancel button and custom amounts.
4. **Developer tools → Notifications → New destination**:
   - **URL**: `https://YOUR-SITE/api/billing`
   - **Events**: `transaction.completed`, `subscription.created`, `subscription.activated`, `subscription.updated`,
     `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`,
     `adjustment.created`, `adjustment.updated`
   - Save, then copy its **secret key** (`pdl_ntfset_…`).

## 3. Add the settings

On Cloudflare: the Worker's **Settings → Variables and Secrets** for the server values, and **Builds → Variables** for
the `VITE_` values (they are built into the game). On Vercel: **Settings → Environment Variables** for all of them.

| Name | Value |
|---|---|
| `PADDLE_WEBHOOK_SECRET` | the notification destination's secret key |
| `PADDLE_API_KEY` | the API key (optional: enables the one-tap cancel and custom amounts) |
| `PADDLE_ENV` | `sandbox` while testing; leave empty for live |
| `PADDLE_PRODUCT_SUPPORTER` | Supporter Pass product ID (comma-separated if more than one) |
| `PADDLE_PRODUCT_NO_ADS` | No-Ads Pass product ID |
| `PADDLE_PRODUCT_BUNDLE_SUPPORTER` | Supporter Bundle product ID |
| `PADDLE_PRODUCT_BUNDLE_VISIONARY` | Visionary Supporter Bundle product ID |
| `PADDLE_PRODUCT_BUNDLE_FOUNDER` | Eternal Founder Bundle product ID |
| `PADDLE_PRODUCT_BUNDLE_CUSTOM` | Custom Support Bundle product ID |
| `VITE_PADDLE_CLIENT_TOKEN` | the client-side token |
| `VITE_PADDLE_ENV` | `sandbox` while testing; leave empty for live |
| `VITE_PADDLE_PRICE_SUPPORTER` | Supporter Pass price ID |
| `VITE_PADDLE_PRICE_NO_ADS` | No-Ads Pass price ID |
| `VITE_PADDLE_PRICE_BUNDLE_SUPPORTER` | Supporter Bundle price ID |
| `VITE_PADDLE_PRICE_BUNDLE_VISIONARY` | Visionary Supporter Bundle price ID |
| `VITE_PADDLE_PRICE_BUNDLE_FOUNDER` | Eternal Founder Bundle price ID |
| `VITE_PADDLE_PRICE_BUNDLE_CUSTOM` | Custom Support Bundle price ID ($0.99) |

The `VITE_…` values are public; the secret, API key and product IDs stay on the server. **Redeploy** after adding them.

## 4. Test it

1. With the sandbox values set, sign in to the game, open the **Support Shop** and buy a bundle with Paddle's test
   card `4242 4242 4242 4242` (any future date, CVC `100`).
2. Within a few seconds the webhook runs (Paddle → Notifications → the destination → **Logs** shows each delivery and
   our answer). The thank-you popup appears and the card says **Owned**; the icon, colour and title are in the
   Profile. If not, press **Check again**.
3. Subscribe to a monthly pass the same way: the card shows **Active** and the ads are gone. Press **Cancel pass** →
   **Yes, cancel**: the card shows **Cancelled · perks until …**.
4. Try the Custom Support Bundle with an amount like $7.50.
5. Switch to the live values (`PADDLE_ENV` and `VITE_PADDLE_ENV` empty, live token, key, secret and IDs) and redeploy.

## How it works

- The game opens Paddle.js's overlay checkout with `customData.user_id` set to the signed-in player's account id (and
  their email pre-filled). Paddle copies it onto the transaction and the subscription, and sends it with every webhook.
  Paddle.js is loaded only when someone presses a buy button.
- `/api/billing` (`server/billing.ts`) checks the `Paddle-Signature` (HMAC-SHA256 of `timestamp:body`, rejected after
  5 minutes), matches products by product ID, then records:
  - `transaction.completed` for a bundle → adds it to `bundles` and remembers the order in `bundle_orders`; an
    approved full refund (`adjustment.*`) of that order → removes it;
  - any `subscription.*` for a Supporter or No-Ads product (each in its own columns) → `supporter_until` or
    `no_ads_until`: the period end plus 3 days while active, trialing or past due; exactly the period end once a cancel
    is scheduled; nothing once canceled or paused. Events that arrive out of order never overwrite a newer state.
- `?action=cancel` asks Paddle to cancel at `next_billing_period`; `?action=checkout` creates a transaction with a
  one-off price for the Custom Support Bundle. Both check the player's own access token.
- The game reads the row when the player signs in, opens the game, or returns to the Support Shop, and keeps a copy in
  the browser (`cv-entitlements`) so it works offline. A lapsed monthly pass ends on its date even offline.
  Signing out forgets the copy; backups never include it.
- Deleting an account deletes what it owns. It does **not** cancel a Paddle subscription; the Support Shop tells
  players to cancel first, and you can cancel one from the Paddle dashboard.

## Refunds

Refunds are issued from the Paddle dashboard (Transactions → the transaction → Refund). A fully refunded bundle is
taken back automatically once Paddle approves the refund; for a monthly pass, cancel the subscription too.
