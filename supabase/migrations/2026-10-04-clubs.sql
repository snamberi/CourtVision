-- Clubs: groups of friends with a name, a tag and a badge, a weekly club board and club-vs-club clashes.
-- Run this once in the Supabase SQL editor (safe to run again). Until it runs, the Clubs page says clubs are not set up yet.
--
-- Who writes what: nobody writes these tables directly from the browser. Creating, joining, leaving and challenging
-- go through the functions below (security definer), which check the caller and the limits.

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
