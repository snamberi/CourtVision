-- Ninefold accounts: one login (auth.users + profiles.username) shared by Court Vision, Dragon Vision and the
-- NineFoldVision site. Each game keeps its own progress in its own rows, so one game can never change another's.
-- Additive only: no existing table, column or policy is changed. Friends reuse public.follows (mutual = friends).

-- Private per-game cloud saves (Court Vision keeps using public.progress).
create table if not exists public.game_saves (
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game in ('dragonvision')),
  data jsonb not null,
  size int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game),
  constraint game_saves_size check (octet_length(data::text) < 2000000)
);

-- Public per-game profile card (e.g. Dragon Vision: strongest fighters, highest stage, forged legends).
create table if not exists public.game_summaries (
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game in ('courtvision', 'dragonvision')),
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game),
  constraint game_summaries_size check (octet_length(summary::text) < 20000)
);

-- Achievements from games that don't already have a table (Court Vision uses public.user_achievements).
create table if not exists public.game_trophies (
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game in ('dragonvision')),
  trophy_id text not null check (trophy_id ~ '^[a-z0-9:_-]{1,64}$'),
  earned_at timestamptz not null default now(),
  primary key (user_id, game, trophy_id)
);

-- The six trophies a player shows on their NineFoldVision profile, from any game: [{"game":"...","id":"..."}].
create table if not exists public.trophy_showcase (
  user_id uuid primary key references auth.users on delete cascade,
  picks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint trophy_showcase_picks check (jsonb_typeof(picks) = 'array' and jsonb_array_length(picks) <= 6)
);

-- Short public activity lines across games ("Cleared stage 100 in Dragon Vision").
create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game in ('courtvision', 'dragonvision', 'ninefold')),
  kind text not null check (kind ~ '^[a-z0-9_-]{1,32}$'),
  text text not null check (length(text) between 1 and 140),
  created_at timestamptz not null default now()
);
create index if not exists activity_user_recent on public.activity (user_id, created_at desc);

alter table public.game_saves enable row level security;
alter table public.game_summaries enable row level security;
alter table public.game_trophies enable row level security;
alter table public.trophy_showcase enable row level security;
alter table public.activity enable row level security;

-- Saves: only the owner.
create policy game_saves_owner on public.game_saves for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Summaries, trophies, showcase, activity: anyone can read; only the owner writes their own rows.
create policy game_summaries_read on public.game_summaries for select to anon, authenticated using (true);
create policy game_summaries_write on public.game_summaries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy game_summaries_update on public.game_summaries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy game_trophies_read on public.game_trophies for select to anon, authenticated using (true);
create policy game_trophies_write on public.game_trophies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy game_trophies_delete on public.game_trophies for delete to authenticated using ((select auth.uid()) = user_id);

create policy trophy_showcase_read on public.trophy_showcase for select to anon, authenticated using (true);
create policy trophy_showcase_write on public.trophy_showcase for insert to authenticated with check ((select auth.uid()) = user_id);
create policy trophy_showcase_update on public.trophy_showcase for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy activity_read on public.activity for select to anon, authenticated using (true);
create policy activity_write on public.activity for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_delete on public.activity for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.game_summaries, public.game_trophies, public.trophy_showcase, public.activity to anon, authenticated;
grant insert, update, delete on public.game_saves, public.game_summaries, public.game_trophies, public.trophy_showcase, public.activity to authenticated;
grant select on public.game_saves to authenticated;
