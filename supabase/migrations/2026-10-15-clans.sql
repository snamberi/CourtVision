-- Clans: clubs grow into clans. Run this once in the Supabase SQL editor, after 2026-10-04-clubs.sql (safe to run again).
-- Until it runs, the Clans page keeps working as before (no flags, descriptions, invites or closed clans).
--
-- New: a description and a flag (a short code, src/cloud/clanFlag.ts), open or closed clans, a private join link per
-- clan, invites by username, and the leader removing members. Creating a clan costs 100,000 coins: the function checks
-- the coins in your synced save, and the game takes them from your vault once the clan exists.
-- As before, nobody writes these tables from the browser; everything goes through the functions below.

alter table public.clubs add column if not exists description text not null default '' check (length(description) <= 300);
alter table public.clubs add column if not exists flag text not null default '' check (length(flag) <= 200);
alter table public.clubs add column if not exists open boolean not null default true;

-- The join link's code. Private: only the clan's leader can read it (so a closed clan stays closed).
create table if not exists public.club_codes (
  club_id uuid primary key references public.clubs on delete cascade,
  code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
);
insert into public.club_codes (club_id) select id from public.clubs on conflict do nothing;

-- Invites from a clan's leader to a GM (the GM sees them on the Clans page, and can join even a closed clan).
create table if not exists public.club_invites (
  club_id uuid not null references public.clubs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_invites_user on public.club_invites (user_id);

-- GMs a leader removed: they can't walk back into an open clan without a new invite or the link.
create table if not exists public.club_kicks (
  club_id uuid not null references public.clubs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_codes enable row level security;
alter table public.club_invites enable row level security;
alter table public.club_kicks enable row level security;
drop policy if exists "leader read" on public.club_codes;
create policy "leader read" on public.club_codes for select using (exists (select 1 from public.clubs c where c.id = club_id and c.owner = auth.uid()));
drop policy if exists "invitee or leader read" on public.club_invites;
create policy "invitee or leader read" on public.club_invites for select using (user_id = auth.uid() or exists (select 1 from public.clubs c where c.id = club_id and c.owner = auth.uid()));
revoke insert, update, delete on public.club_codes, public.club_invites, public.club_kicks from anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Coins in a GM's synced save (0 when there is no save or it can't be read).
create or replace function public.synced_coins(p_user uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare raw text; n numeric;
begin
  select data->'storage'->>'cv-relics' into raw from progress where user_id = p_user;
  if raw is null then return 0; end if;
  n := (raw::jsonb->>'coins')::numeric;
  return coalesce(n, 0);
exception when others then return 0;
end $$;
revoke all on function public.synced_coins(uuid) from public, anon, authenticated;

-- Joins a GM to a clan after the shared checks (signed in, has a name, not in a clan, the clan isn't full).
create or replace function public.club_enter(p_user uuid, p_club uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles where id = p_user and username is not null and not banned) then raise exception 'Pick a GM name first.'; end if;
  if not exists (select 1 from clubs where id = p_club) then raise exception 'That clan is gone.'; end if;
  if exists (select 1 from club_members where user_id = p_user) then raise exception 'Leave your clan first.'; end if;
  if (select count(*) from club_members where club_id = p_club) >= 20 then raise exception 'That clan is full (20 GMs).'; end if;
  insert into club_members (user_id, club_id) values (p_user, p_club);
  delete from club_invites where user_id = p_user and club_id = p_club;
  delete from club_kicks where user_id = p_user and club_id = p_club;
end $$;
revoke all on function public.club_enter(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- actions

drop function if exists public.create_club(text, text, text, text, text);
create or replace function public.create_club(p_name text, p_tag text, p_badge text, p_color text, p_motto text default '', p_description text default '', p_flag text default '', p_open boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles where id = me and username is not null and not banned) then raise exception 'Pick a GM name first.'; end if;
  if exists (select 1 from club_members where user_id = me) then raise exception 'Leave your clan first.'; end if;
  if public.synced_coins(me) < 100000 then raise exception 'A clan costs 100,000 coins, and your synced save has fewer. Play a game while signed in so your coins sync, then try again.'; end if;
  insert into clubs (name, tag, badge, color, motto, description, flag, open, owner)
    values (trim(p_name), upper(trim(p_tag)), coalesce(p_badge, 'ball'), coalesce(p_color, 'orange'), coalesce(trim(p_motto), ''), coalesce(trim(p_description), ''), coalesce(p_flag, ''), coalesce(p_open, true), me)
    returning id into cid;
  insert into club_members (user_id, club_id) values (me, cid);
  insert into club_codes (club_id) values (cid) on conflict do nothing;
  return cid;
end $$;

-- The leader edits the clan: name, tag, motto, description, flag, badge, colour, open or closed.
create or replace function public.update_club(p_name text, p_tag text, p_badge text, p_color text, p_motto text, p_description text, p_flag text, p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  select id into cid from clubs where owner = me;
  if cid is null then raise exception 'Only the clan leader can edit the clan.'; end if;
  update clubs set name = trim(p_name), tag = upper(trim(p_tag)), badge = coalesce(p_badge, badge), color = coalesce(p_color, color), motto = coalesce(trim(p_motto), ''),
    description = coalesce(trim(p_description), ''), flag = coalesce(p_flag, ''), open = coalesce(p_open, open) where id = cid;
end $$;

-- Open clans: anyone joins. Closed clans: only with an invite (or the link, below).
drop function if exists public.join_club(uuid);
create or replace function public.join_club(p_club uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); invited boolean;
begin
  invited := exists (select 1 from club_invites where club_id = p_club and user_id = me);
  if not invited and not coalesce((select open from clubs where id = p_club), true) then raise exception 'That clan is closed: you need its invite link or an invite from its leader.'; end if;
  if not invited and exists (select 1 from club_kicks where club_id = p_club and user_id = me) then raise exception 'The leader removed you from this clan. Ask them for an invite.'; end if;
  perform public.club_enter(me, p_club);
end $$;

-- Joining with the link's code works for open and closed clans alike.
create or replace function public.join_club_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  select club_id into cid from club_codes where code = lower(trim(p_code));
  if cid is null then raise exception 'That invite link has expired. Ask the clan leader for a new one.'; end if;
  perform public.club_enter(me, cid);
  return cid;
end $$;

-- What a link leads to (shown before you join; works signed out too). The code itself is never returned.
create or replace function public.club_by_code(p_code text)
returns table (id uuid, name text, tag text, flag text, description text, members int) language sql stable security definer set search_path = public as $$
  select c.id, c.name::text, c.tag, c.flag, c.description, (select count(*)::int from club_members m where m.club_id = c.id)
  from club_codes k join clubs c on c.id = k.club_id where k.code = lower(trim(p_code));
$$;

-- A new link (the old one stops working).
create or replace function public.new_club_code()
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; fresh text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  select id into cid from clubs where owner = me;
  if cid is null then raise exception 'Only the clan leader can make a new link.'; end if;
  insert into club_codes (club_id, code) values (cid, fresh) on conflict (club_id) do update set code = excluded.code;
  return fresh;
end $$;

create or replace function public.invite_to_club(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; target uuid;
begin
  select id into cid from clubs where owner = me;
  if cid is null then raise exception 'Only the clan leader can invite.'; end if;
  select id into target from profiles where username = trim(both '@' from trim(p_username)) and not banned;
  if target is null then raise exception 'No GM called @%.', trim(both '@' from trim(p_username)); end if;
  if exists (select 1 from club_members where user_id = target and club_id = cid) then raise exception 'They are already in your clan.'; end if;
  if (select count(*) from club_invites where club_id = cid) >= 50 then raise exception 'Your clan has 50 open invites: wait for some answers first.'; end if;
  insert into club_invites (club_id, user_id, invited_by) values (cid, target, me) on conflict do nothing;
  delete from club_kicks where club_id = cid and user_id = target;
end $$;

-- An invite turned down (by the GM) or taken back (by the leader).
create or replace function public.drop_club_invite(p_club uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_user is null or p_user = me then delete from club_invites where club_id = p_club and user_id = me; return; end if;
  if not exists (select 1 from clubs where id = p_club and owner = me) then raise exception 'Only the clan leader can take an invite back.'; end if;
  delete from club_invites where club_id = p_club and user_id = p_user;
end $$;

create or replace function public.kick_from_club(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  select id into cid from clubs where owner = me;
  if cid is null then raise exception 'Only the clan leader can remove members.'; end if;
  if p_user = me then raise exception 'To step away, use Leave the clan.'; end if;
  delete from club_members where user_id = p_user and club_id = cid;
  insert into club_kicks (club_id, user_id) values (cid, p_user) on conflict do nothing;
end $$;

revoke all on function public.create_club(text, text, text, text, text, text, text, boolean), public.update_club(text, text, text, text, text, text, text, boolean), public.join_club(uuid),
  public.join_club_code(text), public.new_club_code(), public.invite_to_club(text), public.drop_club_invite(uuid, uuid), public.kick_from_club(uuid), public.club_by_code(text) from public, anon;
grant execute on function public.create_club(text, text, text, text, text, text, text, boolean), public.update_club(text, text, text, text, text, text, text, boolean), public.join_club(uuid),
  public.join_club_code(text), public.new_club_code(), public.invite_to_club(text), public.drop_club_invite(uuid, uuid), public.kick_from_club(uuid) to authenticated;
grant execute on function public.club_by_code(text) to anon, authenticated;

-- ---------------------------------------------------------------- boards (the same views, now with the flag)

drop view if exists public.lb_clubs;
create view public.lb_clubs with (security_invoker = on) as
  select c.id, c.name, c.tag, c.badge, c.color, c.motto, c.owner, c.created_at, count(m.user_id)::int as members, coalesce(sum(p.xp), 0)::bigint as xp,
    c.description, c.flag, c.open
  from public.clubs c left join public.club_members m on m.club_id = c.id left join public.profiles p on p.id = m.user_id and not p.banned
  group by c.id;

drop view if exists public.lb_club_weekly;
create view public.lb_club_weekly with (security_invoker = on) as
  with s as (
    select w.board, w.week, w.user_id, w.score, max(w.score) over (partition by w.board, w.week) as top
    from public.weekly_scores w join public.profiles p on p.id = w.user_id where not p.banned
  )
  select m.club_id, c.name, c.tag, c.badge, c.color, s.week,
    sum(round(100.0 * greatest(s.score, 0) / greatest(s.top, 1)))::int as points, count(distinct s.user_id)::int as players, c.flag
  from s join public.club_members m on m.user_id = s.user_id join public.clubs c on c.id = m.club_id
  group by m.club_id, c.name, c.tag, c.badge, c.color, s.week, c.flag;

grant select on public.lb_clubs, public.lb_club_weekly to anon, authenticated;
