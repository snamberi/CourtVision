-- Online GM leagues: 2-8 friends share one league. Each runs a team; the league moves forward when everyone is
-- ready (or the commissioner's deadline passes). Run this once in the Supabase SQL editor (safe to run again).
--
-- How it works: the league itself is a compressed save file in Storage (bucket "online-leagues", one file per
-- version). This table points at the latest version. Saving a new version only works if nobody else saved in
-- between (the version check in commit_online_league), so two friends can never overwrite each other's moves.

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
