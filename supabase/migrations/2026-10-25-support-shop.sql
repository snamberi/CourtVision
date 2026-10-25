-- The Support Shop: the monthly No-Ads Pass and the one-time bundles (Supporter, Visionary, Eternal Founder, Custom).
-- Run this once in the Supabase SQL editor (or re-run supabase/schema.sql). Until it runs, the game reads the old
-- columns and only the Supporter Pass and a lifetime No-Ads Pass are recorded.
alter table public.entitlements add column if not exists no_ads_until timestamptz;
alter table public.entitlements add column if not exists no_ads_status text;
alter table public.entitlements add column if not exists no_ads_subscription_id text;
alter table public.entitlements add column if not exists no_ads_updated_at timestamptz;
alter table public.entitlements add column if not exists no_ads_portal_url text;
alter table public.entitlements add column if not exists bundles text[] not null default '{}';
-- Which bundle each Paddle order bought (txn id → bundle), so a refund takes back the right one.
alter table public.entitlements add column if not exists bundle_orders jsonb not null default '{}';
