-- Court Vision: accounts, cloud progress, leaderboards, ranked seasons and League Hunt PvP.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. It is safe to run again (idempotent).
--
-- Who writes what:
--   * Clients (the game, with the signed-in user's token) can read every public table, choose their username,
--     title and frame, follow people and file reports. Nothing competitive can be written from the browser.
--   * The Vercel Functions (/api/sync, /api/pvp) write everything else with the service key, after checking it.

create extension if not exists citext;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique check (username ~ '^[A-Za-z0-9_]{3,18}$'),
  title text not null default 'Rookie GM' check (length(title) <= 40),
  frame text not null default 'classic' check (length(frame) <= 20),
  level int not null default 1,
  xp int not null default 0,
  stats jsonb not null default '{}'::jsonb,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_xp on public.profiles (xp desc);

-- A profile row for every new account.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- private cloud progress

create table if not exists public.progress (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  size int not null default 0 check (size <= 800000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- public results (written by /api/sync)

create table if not exists public.user_achievements (
  user_id uuid references public.profiles on delete cascade,
  achievement_id text not null,
  primary key (user_id, achievement_id)
);

create table if not exists public.created_players (
  user_id uuid references public.profiles on delete cascade,
  career_id text not null,
  name text not null,
  legacy int not null,
  rank int,
  seasons int not null,
  titles int not null default 0,
  mvps int not null default 0,
  all_stars int not null default 0,
  hall_of_fame text not null default 'no',
  draft_year int,
  weekly text,
  ppg real, rpg real, apg real, points int,
  retired_at timestamptz not null default now(),
  primary key (user_id, career_id)
);
create index if not exists created_players_legacy on public.created_players (legacy desc);
create index if not exists created_players_weekly on public.created_players (weekly, legacy desc);

create table if not exists public.weekly_scores (
  board text not null check (board in ('rebuild', 'career')),
  week text not null,
  user_id uuid references public.profiles on delete cascade,
  score int not null,
  detail text not null default '',
  updated_at timestamptz not null default now(),
  primary key (board, week, user_id)
);
create index if not exists weekly_scores_rank on public.weekly_scores (board, week, score desc);

create table if not exists public.daily_legend (
  day date not null,
  user_id uuid references public.profiles on delete cascade,
  won boolean not null,
  stop int not null,
  wins int not null,
  losses int not null,
  score int not null,
  primary key (day, user_id)
);
create index if not exists daily_legend_rank on public.daily_legend (day, score desc);

create table if not exists public.rebuild_records (
  scenario text not null,
  user_id uuid references public.profiles on delete cascade,
  best int not null,
  stars int not null,
  title_in int,
  primary key (scenario, user_id)
);
create index if not exists rebuild_records_rank on public.rebuild_records (scenario, best desc);

-- Friend challenges: everyone who played a league code, and how their first season went.
create table if not exists public.code_results (
  code text not null,
  user_id uuid references public.profiles on delete cascade,
  team text,
  wins int not null,
  losses int not null,
  finish text not null,
  score int not null,
  updated_at timestamptz not null default now(),
  primary key (code, user_id)
);

-- Ranked: one row per scoring event (a Daily Legend, a weekly result, a day's goals); a season is a month (UTC).
create table if not exists public.ranked_events (
  user_id uuid references public.profiles on delete cascade,
  event text not null,
  season text not null,
  points int not null,
  primary key (user_id, event)
);
create index if not exists ranked_events_season on public.ranked_events (season);

-- ---------------------------------------------------------------- social

create table if not exists public.follows (
  user_id uuid references public.profiles on delete cascade,
  target_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  check (user_id <> target_id)
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references public.profiles on delete cascade default auth.uid(),
  target uuid references public.profiles on delete cascade,
  reason text not null check (length(reason) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- League Hunt PvP

create table if not exists public.hunt_ghosts (
  user_id uuid primary key references public.profiles on delete cascade,
  squad jsonb not null,
  rating int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists hunt_ghosts_rating on public.hunt_ghosts (rating desc);

create table if not exists public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  challenger uuid references public.profiles on delete cascade,
  defender uuid references public.profiles on delete cascade,
  seed bigint not null,
  era text not null,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost')),
  games jsonb,
  delta int,
  created_at timestamptz not null default now()
);
create index if not exists pvp_matches_challenger on public.pvp_matches (challenger, created_at desc);

-- ---------------------------------------------------------------- views for the boards

create or replace view public.lb_users with (security_invoker = on) as
  select p.id, p.username, p.title, p.frame, p.level, p.xp, p.stats
  from public.profiles p where p.username is not null and not p.banned;

create or replace view public.lb_players with (security_invoker = on) as
  select c.*, p.username from public.created_players c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_weekly with (security_invoker = on) as
  select w.*, p.username, p.title from public.weekly_scores w join public.profiles p on p.id = w.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_daily with (security_invoker = on) as
  select d.*, p.username, p.title from public.daily_legend d join public.profiles p on p.id = d.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_rebuild with (security_invoker = on) as
  select r.*, p.username, p.title from public.rebuild_records r join public.profiles p on p.id = r.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_codes with (security_invoker = on) as
  select c.*, p.username from public.code_results c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_ranked with (security_invoker = on) as
  select e.season, e.user_id, p.username, p.title, sum(e.points)::int as points, count(*)::int as events
  from public.ranked_events e join public.profiles p on p.id = e.user_id
  where p.username is not null and not p.banned
  group by e.season, e.user_id, p.username, p.title;

create or replace view public.lb_pvp with (security_invoker = on) as
  select g.user_id, p.username, p.title, g.rating, g.wins, g.losses, g.squad, g.updated_at
  from public.hunt_ghosts g join public.profiles p on p.id = g.user_id
  where p.username is not null and not p.banned;

-- How many GMs hold each achievement (rarity).
create or replace view public.achievement_rarity with (security_invoker = on) as
  select a.achievement_id, count(*)::int as holders,
    round(100.0 * count(*) / greatest(1, (select count(*) from public.profiles where username is not null)), 1) as pct
  from public.user_achievements a group by a.achievement_id;

-- ---------------------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.user_achievements enable row level security;
alter table public.created_players enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.daily_legend enable row level security;
alter table public.rebuild_records enable row level security;
alter table public.code_results enable row level security;
alter table public.ranked_events enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.hunt_ghosts enable row level security;
alter table public.pvp_matches enable row level security;

do $$
declare t text;
begin
  -- Public reading for the boards and profiles.
  foreach t in array array['profiles','user_achievements','created_players','weekly_scores','daily_legend','rebuild_records','code_results','ranked_events','follows','hunt_ghosts','pvp_matches'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
  end loop;
end $$;

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for select using (auth.uid() = user_id);

-- Profiles: you may change only your username, title and frame (the column grants below), on your own row.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from anon, authenticated;
grant update (username, title, frame, updated_at) on public.profiles to authenticated;

drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows for insert with check (auth.uid() = user_id);
drop policy if exists "unfollow" on public.follows;
create policy "unfollow" on public.follows for delete using (auth.uid() = user_id);

drop policy if exists "report" on public.reports;
create policy "report" on public.reports for insert with check (auth.uid() = reporter);

grant select on public.lb_users, public.lb_players, public.lb_weekly, public.lb_daily, public.lb_rebuild, public.lb_codes, public.lb_ranked, public.lb_pvp, public.achievement_rarity to anon, authenticated;
