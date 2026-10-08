-- Court Vision: accounts, cloud progress, leaderboards, ranked seasons and League Hunt PvP.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. It is safe to run again (idempotent).
--
-- Who writes what:
--   * Clients (the game, with the signed-in user's token) can read every public table, choose their username,
--     title, frame, icon and name colour, follow people and file reports. Nothing competitive can be written from the browser.
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
-- Profile icon and name colour (cosmetic, chosen by the player; earned in game).
alter table public.profiles add column if not exists icon text not null default 'ball' check (length(icon) <= 20);
alter table public.profiles add column if not exists color text not null default 'cream' check (length(color) <= 20);
-- Your character as a look code (src/profile/avatarCode.ts). Written only by the server at sync, after checking it.
alter table public.profiles add column if not exists avatar text check (length(avatar) <= 64);
-- 'owner' opens every cosmetic for that account. Set only here, in the SQL editor (not in the update grant below):
--   update public.profiles set role = 'owner' where username = 'YourName';
alter table public.profiles add column if not exists role text check (role in ('owner'));

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
-- The Weekly Hunt board joined the weekly boards later.
alter table public.weekly_scores drop constraint if exists weekly_scores_board_check;
alter table public.weekly_scores add constraint weekly_scores_board_check check (board in ('rebuild', 'career', 'hunt', 'perfect', 'category', 'guess', 'hilo', 'bracket'));

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

-- Passes bought through Lemon Squeezy (written only by /api/billing with the service key; see docs/BILLING_SETUP.md).
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  no_ads boolean not null default false,
  no_ads_order text,
  supporter_until timestamptz,
  supporter_status text,
  subscription_id text,
  subscription_updated_at timestamptz,
  portal_url text,
  customer_id text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- views for the boards

create or replace view public.lb_users with (security_invoker = on) as
  select p.id, p.username, p.title, p.frame, p.level, p.xp, p.stats, p.icon, p.color, p.avatar
  from public.profiles p where p.username is not null and not p.banned;

create or replace view public.lb_players with (security_invoker = on) as
  select c.*, p.username, p.icon, p.color, p.avatar from public.created_players c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_weekly with (security_invoker = on) as
  select w.*, p.username, p.title, p.icon, p.color, p.avatar from public.weekly_scores w join public.profiles p on p.id = w.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_daily with (security_invoker = on) as
  select d.*, p.username, p.title, p.icon, p.color, p.avatar from public.daily_legend d join public.profiles p on p.id = d.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_rebuild with (security_invoker = on) as
  select r.*, p.username, p.title, p.icon, p.color, p.avatar from public.rebuild_records r join public.profiles p on p.id = r.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_codes with (security_invoker = on) as
  select c.*, p.username, p.icon, p.color, p.avatar from public.code_results c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned;

create or replace view public.lb_ranked with (security_invoker = on) as
  select e.season, e.user_id, p.username, p.title, sum(e.points)::int as points, count(*)::int as events, p.icon, p.color, p.avatar
  from public.ranked_events e join public.profiles p on p.id = e.user_id
  where p.username is not null and not p.banned
  group by e.season, e.user_id, p.username, p.title, p.icon, p.color, p.avatar;

create or replace view public.lb_pvp with (security_invoker = on) as
  select g.user_id, p.username, p.title, g.rating, g.wins, g.losses, g.squad, g.updated_at, p.icon, p.color, p.avatar
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
alter table public.entitlements enable row level security;

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
grant update (username, title, frame, icon, color, updated_at) on public.profiles to authenticated;

-- Passes: you may read your own row; nobody writes it but the billing webhook (service key).
drop policy if exists "own entitlements" on public.entitlements;
create policy "own entitlements" on public.entitlements for select using (auth.uid() = user_id);
revoke insert, update, delete on public.entitlements from anon, authenticated;

drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows for insert with check (auth.uid() = user_id);
drop policy if exists "unfollow" on public.follows;
create policy "unfollow" on public.follows for delete using (auth.uid() = user_id);

drop policy if exists "report" on public.reports;
create policy "report" on public.reports for insert with check (auth.uid() = reporter);

grant select on public.lb_users, public.lb_players, public.lb_weekly, public.lb_daily, public.lb_rebuild, public.lb_codes, public.lb_ranked, public.lb_pvp, public.achievement_rarity to anon, authenticated;

-- ---------------------------------------------------------------- clubs (also in migrations/2026-10-04-clubs.sql)
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name citext unique not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$'),
  tag text not null check (tag ~ '^[A-Z0-9]{2,4}$'),
  badge text not null default 'ball' check (length(badge) <= 20),
  color text not null default 'orange' check (length(color) <= 20),
  motto text not null default '' check (length(motto) <= 80),
  owner uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  user_id uuid primary key references public.profiles on delete cascade,
  club_id uuid not null references public.clubs on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists club_members_club on public.club_members (club_id);

-- A clash: two clubs, one week; whoever scores more club points that week wins.
create table if not exists public.club_clashes (
  id uuid primary key default gen_random_uuid(),
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  club_a uuid not null references public.clubs on delete cascade,
  club_b uuid not null references public.clubs on delete cascade,
  created_at timestamptz not null default now(),
  check (club_a <> club_b)
);
create unique index if not exists club_clashes_a on public.club_clashes (week, club_a);
create unique index if not exists club_clashes_b on public.club_clashes (week, club_b);

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_clashes enable row level security;
drop policy if exists "public read" on public.clubs;
create policy "public read" on public.clubs for select using (true);
drop policy if exists "public read" on public.club_members;
create policy "public read" on public.club_members for select using (true);
drop policy if exists "public read" on public.club_clashes;
create policy "public read" on public.club_clashes for select using (true);
revoke insert, update, delete on public.clubs, public.club_members, public.club_clashes from anon, authenticated;

-- ---------------------------------------------------------------- actions

create or replace function public.create_club(p_name text, p_tag text, p_badge text, p_color text, p_motto text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles where id = me and username is not null and not banned) then raise exception 'Pick a GM name first.'; end if;
  if exists (select 1 from club_members where user_id = me) then raise exception 'Leave your club first.'; end if;
  insert into clubs (name, tag, badge, color, motto, owner) values (trim(p_name), upper(trim(p_tag)), coalesce(p_badge, 'ball'), coalesce(p_color, 'orange'), coalesce(trim(p_motto), ''), me) returning id into cid;
  insert into club_members (user_id, club_id) values (me, cid);
  return cid;
end $$;

create or replace function public.join_club(p_club uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles where id = me and username is not null and not banned) then raise exception 'Pick a GM name first.'; end if;
  if exists (select 1 from club_members where user_id = me) then raise exception 'Leave your club first.'; end if;
  if (select count(*) from club_members where club_id = p_club) >= 20 then raise exception 'That club is full (20 GMs).'; end if;
  insert into club_members (user_id, club_id) values (me, p_club);
end $$;

-- Leaving: the oldest member takes over a club its owner leaves; the last one out closes it.
create or replace function public.leave_club()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; heir uuid;
begin
  select club_id into cid from club_members where user_id = me;
  if cid is null then return; end if;
  delete from club_members where user_id = me;
  if exists (select 1 from clubs where id = cid and owner = me) then
    select user_id into heir from club_members where club_id = cid order by joined_at limit 1;
    if heir is null then delete from clubs where id = cid; else update clubs set owner = heir where id = cid; end if;
  end if;
end $$;

-- The club owner challenges another club for this week (one clash per club per week).
create or replace function public.challenge_club(p_target uuid, p_week text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine uuid; xid uuid;
begin
  select id into mine from clubs where owner = me;
  if mine is null then raise exception 'Only a club owner can start a clash.'; end if;
  if mine = p_target then raise exception 'Pick another club.'; end if;
  if exists (select 1 from club_clashes where week = p_week and (club_a in (mine, p_target) or club_b in (mine, p_target))) then raise exception 'One of the clubs already has a clash this week.'; end if;
  insert into club_clashes (week, club_a, club_b) values (p_week, mine, p_target) returning id into xid;
  return xid;
end $$;

revoke all on function public.create_club(text, text, text, text, text), public.join_club(uuid), public.leave_club(), public.challenge_club(uuid, text) from public, anon;
grant execute on function public.create_club(text, text, text, text, text), public.join_club(uuid), public.leave_club(), public.challenge_club(uuid, text) to authenticated;

-- ---------------------------------------------------------------- boards

-- Clubs with their members and total XP.
create or replace view public.lb_clubs with (security_invoker = on) as
  select c.id, c.name, c.tag, c.badge, c.color, c.motto, c.owner, c.created_at, count(m.user_id)::int as members, coalesce(sum(p.xp), 0)::bigint as xp
  from public.clubs c left join public.club_members m on m.club_id = c.id left join public.profiles p on p.id = m.user_id and not p.banned
  group by c.id;

-- Club points for the week: every member's result on each weekly board scores 0-100 against that board's best
-- that week, so the Rebuild, the Hunt and the quick games all count the same.
create or replace view public.lb_club_weekly with (security_invoker = on) as
  with s as (
    select w.board, w.week, w.user_id, w.score, max(w.score) over (partition by w.board, w.week) as top
    from public.weekly_scores w join public.profiles p on p.id = w.user_id where not p.banned
  )
  select m.club_id, c.name, c.tag, c.badge, c.color, s.week,
    sum(round(100.0 * greatest(s.score, 0) / greatest(s.top, 1)))::int as points, count(distinct s.user_id)::int as players
  from s join public.club_members m on m.user_id = s.user_id join public.clubs c on c.id = m.club_id
  group by m.club_id, c.name, c.tag, c.badge, c.color, s.week;

-- Each member's club points this week (for the club page).
create or replace view public.lb_club_members with (security_invoker = on) as
  with s as (
    select w.board, w.week, w.user_id, w.score, max(w.score) over (partition by w.board, w.week) as top
    from public.weekly_scores w
  )
  select m.club_id, m.user_id, m.joined_at, p.username, p.title, p.icon, p.color, p.avatar, p.level, p.xp, s.week,
    coalesce(sum(round(100.0 * greatest(s.score, 0) / greatest(s.top, 1))), 0)::int as points
  from public.club_members m join public.profiles p on p.id = m.user_id
  left join s on s.user_id = m.user_id
  where p.username is not null and not p.banned
  group by m.club_id, m.user_id, m.joined_at, p.username, p.title, p.icon, p.color, p.avatar, p.level, p.xp, s.week;

grant select on public.lb_clubs, public.lb_club_weekly, public.lb_club_members to anon, authenticated;

-- ---------------------------------------------------------------- online GM leagues (also in migrations/2026-10-05-online-leagues.sql)
create table if not exists public.online_leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (length(name) between 1 and 40),
  commissioner uuid not null references public.profiles on delete cascade,
  teams jsonb not null default '[]'::jsonb,
  version int not null default 0,
  state_path text,
  season text not null default '',
  phase text not null default '',
  status_line text not null default '' check (length(status_line) <= 120),
  deadline_hours int not null default 24 check (deadline_hours between 1 and 168),
  advanced_at timestamptz not null default now(),
  saved_by uuid references public.profiles on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.online_league_members (
  league_id uuid not null references public.online_leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  team_id text not null,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id),
  unique (league_id, team_id)
);
create index if not exists online_league_members_user on public.online_league_members (user_id);

-- Trades between two friends' teams: proposed by one, accepted (and applied) by the other.
create table if not exists public.online_trades (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.online_leagues on delete cascade,
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  proposal jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists online_trades_league on public.online_trades (league_id, created_at desc);

-- Is the caller in this league? (security definer so the policies below don't recurse.)
create or replace function public.is_online_member(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from online_league_members where league_id = p_league and user_id = auth.uid());
$$;

alter table public.online_leagues enable row level security;
alter table public.online_league_members enable row level security;
alter table public.online_trades enable row level security;
drop policy if exists "members read" on public.online_leagues;
create policy "members read" on public.online_leagues for select using (public.is_online_member(id));
drop policy if exists "members read" on public.online_league_members;
create policy "members read" on public.online_league_members for select using (public.is_online_member(league_id));
drop policy if exists "members read" on public.online_trades;
create policy "members read" on public.online_trades for select using (public.is_online_member(league_id));
revoke insert, update, delete on public.online_leagues, public.online_league_members, public.online_trades from anon, authenticated;

-- ---------------------------------------------------------------- actions

create or replace function public.create_online_league(p_name text, p_teams jsonb, p_team text, p_deadline_hours int default 24)
returns table (league_id uuid, league_code text) language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lid uuid; c text; tries int := 0;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles p where p.id = me and p.username is not null and not p.banned) then raise exception 'Pick a GM name first.'; end if;
  if (select count(*) from online_league_members m where m.user_id = me) >= 5 then raise exception 'You are in five online leagues already.'; end if;
  if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams) < 2 or jsonb_array_length(p_teams) > 40 then raise exception 'That league has no teams.'; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from online_leagues o where o.code = c);
    tries := tries + 1; if tries > 20 then raise exception 'Try again.'; end if;
  end loop;
  insert into online_leagues (code, name, commissioner, teams, deadline_hours) values (c, trim(p_name), me, p_teams, greatest(1, least(168, coalesce(p_deadline_hours, 24)))) returning online_leagues.id into lid;
  insert into online_league_members (league_id, user_id, team_id) values (lid, me, p_team);
  return query select lid, c;
end $$;

-- What a code is (name, teams, which are taken) before you join.
create or replace function public.peek_online_league(p_code text)
returns table (id uuid, name text, teams jsonb, taken text[], members int, season text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.teams, coalesce(array_agg(m.team_id) filter (where m.team_id is not null), '{}'), count(m.user_id)::int, o.season
  from online_leagues o left join online_league_members m on m.league_id = o.id
  where o.code = upper(trim(p_code)) group by o.id;
$$;

create or replace function public.join_online_league(p_code text, p_team text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lid uuid; tms jsonb;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles p where p.id = me and p.username is not null and not p.banned) then raise exception 'Pick a GM name first.'; end if;
  select o.id, o.teams into lid, tms from online_leagues o where o.code = upper(trim(p_code));
  if lid is null then raise exception 'No league has that code.'; end if;
  if exists (select 1 from online_league_members where league_id = lid and user_id = me) then return lid; end if;
  if (select count(*) from online_league_members where league_id = lid) >= 8 then raise exception 'That league is full (8 GMs).'; end if;
  if not exists (select 1 from jsonb_array_elements(tms) t where t->>'id' = p_team) then raise exception 'That team is not in the league.'; end if;
  if exists (select 1 from online_league_members where league_id = lid and team_id = p_team) then raise exception 'Someone already runs that team.'; end if;
  insert into online_league_members (league_id, user_id, team_id) values (lid, me, p_team);
  return lid;
end $$;

create or replace function public.leave_online_league(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); heir uuid;
begin
  delete from online_league_members where league_id = p_league and user_id = me;
  if exists (select 1 from online_leagues where id = p_league and commissioner = me) then
    select user_id into heir from online_league_members where league_id = p_league order by joined_at limit 1;
    if heir is null then delete from online_leagues where id = p_league; else update online_leagues set commissioner = heir where id = p_league; end if;
  end if;
end $$;

create or replace function public.set_online_ready(p_league uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update online_league_members set ready = p_ready where league_id = p_league and user_id = auth.uid();
end $$;

-- Saves a new version of the league. Fails if someone else saved since you loaded (p_expected).
-- p_advanced: the league moved forward (games played, a new phase); that resets everyone's Ready.
create or replace function public.commit_online_league(p_league uuid, p_expected int, p_path text, p_season text, p_phase text, p_status text, p_advanced boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_online_member(p_league) then raise exception 'You are not in this league.'; end if;
  if p_path !~ ('^' || p_league::text || '/[0-9]+-[a-z0-9]+\.json(\.gz)?$') then raise exception 'Bad file.'; end if;
  update online_leagues set version = version + 1, state_path = p_path, season = left(coalesce(p_season, ''), 20), phase = left(coalesce(p_phase, ''), 20),
    status_line = left(coalesce(p_status, ''), 120), saved_by = auth.uid(), updated_at = now(),
    advanced_at = case when p_advanced then now() else advanced_at end
    where id = p_league and version = p_expected returning version into v;
  if v is null then raise exception 'stale: someone saved the league after you loaded it.'; end if;
  if p_advanced then update online_league_members set ready = false where league_id = p_league; end if;
  return v;
end $$;

create or replace function public.propose_online_trade(p_league uuid, p_to uuid, p_proposal jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not public.is_online_member(p_league) then raise exception 'You are not in this league.'; end if;
  if not exists (select 1 from online_league_members where league_id = p_league and user_id = p_to) then raise exception 'That GM is not in this league.'; end if;
  if (select count(*) from online_trades where league_id = p_league and from_user = auth.uid() and status = 'pending') >= 10 then raise exception 'You have ten offers waiting already.'; end if;
  insert into online_trades (league_id, from_user, to_user, proposal) values (p_league, auth.uid(), p_to, p_proposal) returning id into tid;
  return tid;
end $$;

-- The receiver accepts or declines; the sender may cancel. (Accepting is recorded after the receiver's game applied it.)
create or replace function public.answer_online_trade(p_trade uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('accepted', 'declined', 'cancelled') then raise exception 'Bad answer.'; end if;
  update online_trades set status = p_status where id = p_trade and status = 'pending'
    and ((p_status in ('accepted', 'declined') and to_user = auth.uid()) or (p_status = 'cancelled' and from_user = auth.uid()));
end $$;

revoke all on function public.create_online_league(text, jsonb, text, int), public.peek_online_league(text), public.join_online_league(text, text), public.leave_online_league(uuid),
  public.set_online_ready(uuid, boolean), public.commit_online_league(uuid, int, text, text, text, text, boolean), public.propose_online_trade(uuid, uuid, jsonb), public.answer_online_trade(uuid, text) from public, anon;
grant execute on function public.create_online_league(text, jsonb, text, int), public.peek_online_league(text), public.join_online_league(text, text), public.leave_online_league(uuid),
  public.set_online_ready(uuid, boolean), public.commit_online_league(uuid, int, text, text, text, text, boolean), public.propose_online_trade(uuid, uuid, jsonb), public.answer_online_trade(uuid, text) to authenticated;

-- Members with their GM names (for the league bar).
create or replace view public.online_members_view with (security_invoker = on) as
  select m.league_id, m.user_id, m.team_id, m.ready, m.joined_at, p.username, p.icon, p.color
  from public.online_league_members m join public.profiles p on p.id = m.user_id;
grant select on public.online_members_view to authenticated;

-- ---------------------------------------------------------------- the save files

insert into storage.buckets (id, name, public, file_size_limit) values ('online-leagues', 'online-leagues', false, 52428800)
  on conflict (id) do nothing;
drop policy if exists "online league members read" on storage.objects;
create policy "online league members read" on storage.objects for select to authenticated
  using (bucket_id = 'online-leagues' and public.is_online_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "online league members write" on storage.objects;
create policy "online league members write" on storage.objects for insert to authenticated
  with check (bucket_id = 'online-leagues' and public.is_online_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "online league members tidy" on storage.objects;
create policy "online league members tidy" on storage.objects for delete to authenticated
  using (bucket_id = 'online-leagues' and public.is_online_member(((storage.foldername(name))[1])::uuid));
