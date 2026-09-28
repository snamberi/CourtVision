# Moving Court Vision from Vercel to Cloudflare

**Why:** Vercel's free (Hobby) plan is for non-commercial projects only, and showing ads counts as commercial.
Cloudflare's free plan allows commercial sites. Static files are free and unlimited, and the API gets 100,000
requests a day. Cloudflare does not show ads itself; the game keeps using Google AdSense as before.

The code works on Vercel and on Cloudflare at the same time, so you can set up Cloudflare, test it, and only then
switch the address.

There are two ways to host on Cloudflare. **Use the Worker** (section A): it's what Cloudflare's dashboard creates
by default now, and a Worker named `courtvision` already exists in the account. Section B (Pages) is the older way
and also works.

## What's in the code (already done)

| Piece | Vercel | Cloudflare Worker | Cloudflare Pages |
|---|---|---|---|
| Config | none | `wrangler.jsonc` (name `courtvision`) | dashboard settings |
| `/api/sync`, `/api/pvp`, `/api/billing` | `api/*.js` | `worker/index.ts` | `functions/api/*.ts` |
| Game files | `dist` | `dist` (static assets) | `dist` |

All three versions of the API run the same handlers in `server/`. Also shared:
- `public/_headers`: cache settings;
- `.node-version`: Node 22;
- `SITE_URL` for the sitemap and share cards;
- Vercel's own analytics loads only on Vercel.

---

## A. Cloudflare Worker (recommended)

### A1. Connect the repository

The pull request with this code must be merged into `main` first, because Cloudflare builds from `main`. To try it
before merging, set the production branch to `claude/ads-awards-nav-discord-style-634av5` in A1 and switch it back to
`main` after the merge.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → the **courtvision** Worker.
2. **Settings → Builds → Connect** → GitHub → pick **snamberi/CourtVision**. Cloudflare asks to install its GitHub app:
   allow it for this repository.
3. Build settings:
   - **Branch:** `main`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** leave empty (`/`)

The Worker's name must stay `courtvision`, matching `wrangler.jsonc`, or the build fails.

### A2. Settings for the build

Worker → **Settings → Builds → Build variables and secrets**. The build bakes these into the game:

| Name | Value |
|---|---|
| `SITE_URL` | the address players will use, e.g. `https://courtvision.<your-subdomain>.workers.dev` or `https://yourdomain.com` |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | the `anon` public key from the same page |

### A3. Settings for the running site

Worker → **Settings → Variables and Secrets** (these are read by `/api/*` while the site runs):

| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Text | same as above |
| `SUPABASE_ANON_KEY` | Text | same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | the `service_role` key (Supabase → Project Settings → API) |

You can copy the same values from Vercel → project → Settings → Environment Variables. `wrangler.jsonc` has
`keep_vars: true`, so deploys never wipe what you set here.

### A4. Deploy and test

Push any commit (or **Deployments → Retry build**). When it finishes, open the Worker's address
(`https://courtvision.<your-subdomain>.workers.dev`, shown on the Worker's overview) and check:

- the menu and the look picker;
- a GM league sim;
- League Hunt or Career (they load the NBA history file).

If accounts are on, do A6 first, then sign in, play something, and check the Community boards.

### A5. Your own domain (needed for AdSense)

Google AdSense generally only approves sites on a domain you own, not on a shared address like `*.workers.dev` or
`*.vercel.app`. A `.com` costs about $10 a year; Cloudflare sells them at cost (**Domain Registration → Register
Domains**).

Then: Worker → **Settings → Domains & Routes → Add → Custom domain** → enter it. HTTPS is automatic. If the domain is
currently used on Vercel, remove it from the Vercel project afterwards. Update `SITE_URL` (A2) and redeploy.

### A6. Tell the other services the new address

- **Supabase → Authentication → URL Configuration:** set **Site URL** to the new address, and add it (plus the
  `workers.dev` address followed by `/**`) under **Redirect URLs**. Without this, sign-in sends players back to the old
  site. Discord and Google need no change.
- **Google AdSense → Sites:** add the new domain. `ads.txt` is served at `/ads.txt` already.
- **Google Search Console** (optional): add the new address and submit `/sitemap.xml`.
- **Lemon Squeezy** (later, when payments are on): webhook URL → `https://<new address>/api/billing`, and add the
  `LEMONSQUEEZY_*` values from `BILLING_SETUP.md`:
  - the webhook secret and variant IDs under A3;
  - the `VITE_` checkout links under A2.

### A7. Analytics

Worker → **Metrics / Web Analytics** (or **Analytics & Logs → Web Analytics → Add a site** for a custom domain):
turn it on. It's free and cookie-free. Umami keeps working as before.

---

## B. Cloudflare Pages (alternative)

**Workers & Pages → Create → Pages → Connect to Git** → `snamberi/CourtVision`, with these settings:
- **Framework preset:** None
- **Build command:** `npm run build`
- **Build output directory:** `dist`

Add `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (secret) under **Settings →
Variables and Secrets**. Pages uses the same variables for the build and for `functions/api/*`. Then continue from A4
to A7, using the `pages.dev` address.

---

## Turning off Vercel

Keep Vercel running for a week or two while players find the new address, then Vercel → project → Settings →
Advanced → **Delete Project**. The `api/` folder only matters to Vercel and can stay.

## About ads and age

Google AdSense requires the account holder to be at least 18, so a parent or guardian needs to own the AdSense
account and receive the payments. The same goes for the Cloudflare account and a domain purchase: an adult should
own them or agree to them. The site code doesn't change either way.

## Tested

Both Cloudflare versions were run locally in Cloudflare's own runtime against a test database:
- Worker: `wrangler dev`;
- Pages: `wrangler pages dev`.

What was checked:
- the game in a browser, with no errors or failed requests;
- cache headers and the fallback for unknown paths;
- `ads.txt`;
- `/api/sync` (signed out: 401; signed in: synced);
- `/api/pvp`;
- `/api/billing` (signed webhook recorded, forged one rejected).

The first real deployment happens from your Cloudflare account.
