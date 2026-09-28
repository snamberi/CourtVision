# Moving Court Vision from Vercel to Cloudflare Pages

**Why:** Vercel's free (Hobby) plan is for non-commercial projects only, and showing ads counts as commercial.
Cloudflare Pages' free plan allows commercial sites, with unlimited bandwidth and 100,000 function requests a day.
Cloudflare does not show ads itself; the game keeps using Google AdSense as before.

The code already works on both hosts, so you can set up Cloudflare, test it, and only then switch the address.
Nothing on Vercel breaks while you do this.

Time needed: about 30 minutes, plus waiting for the domain (if you move one).

## What changed in the code (already done)

| Vercel | Cloudflare Pages |
|---|---|
| `api/sync.js`, `api/pvp.js`, `api/billing.js` (Vercel Functions) | `functions/api/sync.ts`, `pvp.ts`, `billing.ts` (Pages Functions, same handlers from `server/`) |
| Vercel Web Analytics | Loads only on Vercel. On Cloudflare you switch on Cloudflare Web Analytics in the dashboard (step 5) |
| Supabase integration sets the environment variables | You add them yourself (step 3) |
| Production address comes from Vercel | Set `SITE_URL` (step 3), used for the sitemap and share cards |
| — | `public/_headers`: long caching for built files, no caching for the service worker |
| — | `.node-version`: builds with Node 22 |

## 1. Create the Cloudflare Pages project

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) (free).
2. **Workers & Pages → Create → Pages → Connect to Git** → sign in with GitHub → pick **snamberi/CourtVision**.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** leave empty
4. Don't deploy yet: open **Environment variables** first (next step), or add them afterwards and redeploy.

## 2. Pick the address

Your site gets `https://<project-name>.pages.dev` for free (for example `courtvision.pages.dev`).

**For ads you want your own domain.** Google AdSense generally only approves sites on a domain you own, not on a
shared address like `*.pages.dev` or `*.vercel.app`. A `.com` costs about $10 a year; Cloudflare Registrar sells
them at cost (**Domain Registration → Register Domains**). If you already have a domain on Vercel, see step 6.

## 3. Environment variables

Cloudflare → your Pages project → **Settings → Variables and Secrets**. Add each one for **Production**, and also
for **Preview** if you test preview builds. Use **Encrypt** (secret) for the ones marked secret.

| Name | Value | Secret? |
|---|---|---|
| `SITE_URL` | your address, e.g. `https://courtvision.pages.dev` or `https://yourdomain.com` | no |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | no |
| `SUPABASE_ANON_KEY` | the `anon` public key from the same page | no |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key from the same page | **yes** |

These are the same values Vercel has now (Vercel → project → Settings → Environment Variables, where you can reveal
and copy them). The build bakes `SUPABASE_URL` and `SUPABASE_ANON_KEY` into the game, and the functions read all
three when they run.

Passes (only when you turn payments on later; see `BILLING_SETUP.md`): `LEMONSQUEEZY_WEBHOOK_SECRET` (secret),
`LEMONSQUEEZY_NO_ADS_VARIANT_ID`, `LEMONSQUEEZY_SUPPORTER_VARIANT_ID`, `VITE_LEMONSQUEEZY_NO_ADS_URL`,
`VITE_LEMONSQUEEZY_SUPPORTER_URL`.

Then **Deployments → Retry deployment** (or push any commit) so the build picks them up.

## 4. Test it on the pages.dev address

Open `https://<project-name>.pages.dev`:

1. The menu loads, pick a look, start a league and sim a week.
2. Open League Hunt or Career Mode (they load the NBA history file).
3. If accounts are set up: first do step 7 for this address, then sign in, play something, and check it appears on
   the Community boards (that proves `/api/sync` works on Cloudflare).

## 5. Analytics

Cloudflare → **Workers & Pages → your project → Metrics → Web Analytics → Enable**. It is free and cookie-free, and
Cloudflare adds its small script automatically. (Umami keeps working as before; nothing to do for it.)

## 6. Switch the address

- **Using the free `pages.dev` address:** nothing to move. Tell players the new address. You can put a note on the
  old Vercel site or leave it up for a while.
- **Using your own domain:** Cloudflare → your project → **Custom domains → Set up a custom domain** → enter it.
  - If the domain's DNS is already on Cloudflare, it is set up for you.
  - If it's at another registrar or on Vercel, Cloudflare shows the record to add, or offers to move the domain's DNS
    to Cloudflare (recommended, free). Remove the domain from the Vercel project afterwards so Vercel stops answering.
  - It takes minutes to a few hours. The padlock (HTTPS) is automatic.

## 7. Tell the other services the new address

- **Supabase → Authentication → URL Configuration:** set **Site URL** to the new address, and add it (and
  `https://<project-name>.pages.dev/**`) under **Redirect URLs**. Without this, sign-in sends players back to the old
  site. Discord and Google need no change: they redirect to Supabase, not to the game.
- **Google AdSense → Sites:** add the new domain and wait for approval. `ads.txt` is already in `public/` and is
  served at `/ads.txt` on Cloudflare too.
- **Google Search Console** (if you use it): add the new address and submit `/sitemap.xml`.
- **Lemon Squeezy** (later, when payments are on): webhook URL → `https://<new address>/api/billing`.

## 8. Turn off Vercel (when everything works)

Keep Vercel running for a week or two so nothing breaks while players find the new address, then Vercel → project →
Settings → Advanced → **Delete Project**. The `api/` folder and `scripts/build-api.mjs` only matter to Vercel; they
can stay (they don't affect Cloudflare) or be removed later.

## About ads and age

Google AdSense requires the account holder to be at least 18. If you're under 18, a parent or guardian needs to
own the AdSense account (and receive the payments); the site code doesn't change either way.

## Tested

The Cloudflare setup was run locally with Cloudflare's own runtime (`wrangler pages dev`) against a test database:

- the site, the service worker and cache headers, and the single-page fallback;
- `/api/sync` (signed out: 401; signed in: synced);
- `/api/pvp`;
- `/api/billing` (signed webhook recorded, forged one rejected).

A real deployment still has to be done from your Cloudflare account.
