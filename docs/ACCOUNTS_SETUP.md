# Setting up accounts (Supabase) for Court Vision

Accounts, cloud sync, the online leaderboards, ranked seasons and League Hunt PvP all run on **Supabase** (free plan)
with two small Vercel Functions (`/api/sync`, `/api/pvp`). Until this is set up, the game works exactly as before and
the account buttons simply don't appear.

Time needed: about 15 minutes. You need the Vercel project, and a Discord and a Google account.

## 1. Create the database from Vercel

1. Vercel → your **courtvision** project → **Storage** → **Create Database** → **Supabase** → free plan.
   Pick a region near most players (e.g. US East or Frankfurt) and create it.
2. Connect it to the project for **Production** and **Preview**. This adds `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (and the `NEXT_PUBLIC_…` copies) to the project. The game reads those names.
   - Already have a Supabase project? Add those three variables yourself instead (Supabase → Project Settings →
     API: the Project URL, the `anon` public key and the `service_role` secret key).

## 2. Create the tables

Open the Supabase dashboard (from Vercel: Storage → your database → Open in Supabase) → **SQL Editor** → **New query**
→ paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. It is safe to run again after updates.

## 3. Tell Supabase where the site lives

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: your site, e.g. `https://courtvision.example.com` (or the `…vercel.app` production address).
- **Redirect URLs** → add:
  - `https://YOUR-DOMAIN/**`
  - `https://*-papashvilisaba4-4459.vercel.app/**` (preview deployments)
  - `http://localhost:5173/**` (local development)

## 4. Discord sign-in

1. <https://discord.com/developers/applications> → **New Application** → name it "Court Vision".
2. **OAuth2** → copy the **Client ID**; **Reset Secret** and copy the **Client Secret**.
3. **OAuth2 → Redirects** → add `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   (the exact address is shown on Supabase's Discord provider page).
4. Supabase → **Authentication** → **Sign In / Providers** → **Discord** → enable, paste the ID and secret → Save.

## 5. Google sign-in

1. <https://console.cloud.google.com> → create a project "Court Vision".
2. **APIs & Services → OAuth consent screen**: External; app name "Court Vision", your support email, your site as
   the home page and privacy policy (`https://YOUR-DOMAIN/privacy.html`). Add `supabase.co` and your domain as
   authorized domains. When done, **Publish app** (so anyone can sign in, not only test users).
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://YOUR-DOMAIN`
   - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
4. Copy the client ID and secret → Supabase → **Sign In / Providers** → **Google** → enable, paste → Save.

## 6. Email links

Email sign-in is on by default. Supabase's built-in mailer only sends a few emails an hour, which is fine for testing
but not for launch: add your own SMTP (e.g. Resend, free up to 3,000 emails a month) under **Authentication → SMTP
Settings**. Discord and Google sign-in don't need email at all.

## 7. Redeploy

Vercel → Deployments → the latest one → ⋯ → **Redeploy** (the keys are baked in at build time).
Then open the site: **Sign in** and **Leaderboards** appear at the top of the main menu.

## Moderation

- Reports land in the `reports` table (Supabase → Table Editor).
- To hide someone from every board: `profiles` → their row → set `banned` to `true`.
- To rename an offensive name: edit `username` in `profiles`.

## Free plan limits (enough for thousands of players)

500 MB database, 50,000 monthly active users, 5 GB egress. A player's synced progress is usually under 100 KB; GM
leagues are never uploaded. A free project pauses after 7 days with **no** activity; normal traffic keeps it awake
(you can un-pause it from the dashboard).
