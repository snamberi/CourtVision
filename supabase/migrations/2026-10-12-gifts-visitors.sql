-- Friend gifts and profile visitors. Run this once in the Supabase SQL editor.
-- Until it runs, gifting and the visitor count say "not set up yet"; everything else keeps working.
-- Only the server (service role, /api/social) reads and writes these tables.

-- A free daily gift from one GM to a GM they follow: 150 coins and a Lucky Spin for the friend, nothing spent by
-- the sender. Each GM can send 10 a day, one per friend. "claimed" flips once, when the friend collects it.
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  coins int not null default 150,
  lucky int not null default 1,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sender, recipient, day),
  check (sender <> recipient)
);
create index if not exists gifts_recipient_idx on public.gifts (recipient, claimed);
create index if not exists gifts_sender_day_idx on public.gifts (sender, day);
alter table public.gifts enable row level security;

-- Who looked at whose public profile, one row per viewer, profile and day (for "3 GMs visited today").
create table if not exists public.profile_views (
  viewer uuid not null references public.profiles(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (viewer, target, day),
  check (viewer <> target)
);
create index if not exists profile_views_target_idx on public.profile_views (target, day);
alter table public.profile_views enable row level security;
