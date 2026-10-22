-- Owner off the boards, and time played. Run this once in the Supabase SQL editor, after 2026-10-15-clans.sql (safe
-- to run again). Until it runs, the boards work as before and the Time played board stays empty.
--
-- The owner account (profiles.role = 'owner') no longer appears on any leaderboard: not the GM, player, weekly,
-- daily, rebuild, league code, ranked or PvP boards, and its results add nothing to a clan's XP or weekly points (it
-- stays listed as a clan member, with 0 points). Weekly and daily #1 checks read these views too, so the owner's
-- scores never decide anyone else's honors.
-- lb_users gains play_hours: time played from the synced save (stats.playSeconds, written by /api/sync). The boards
-- read lb_gms, the same GMs without the owner; lb_users stays the directory that profiles and search use.

-- lb_users stays the public GM directory (profiles, search, friends, clan names), owner included; lb_gms is the
-- same list for the boards, without the owner.
drop view if exists public.lb_gms;
drop view if exists public.lb_users;
create view public.lb_users with (security_invoker = on) as
  select p.id, p.username, p.title, p.frame, p.level, p.xp, p.stats, p.icon, p.color, p.avatar,
    case when jsonb_typeof(p.stats->'playSeconds') = 'number' then round((p.stats->>'playSeconds')::numeric / 3600, 1) else 0 end as play_hours
  from public.profiles p where p.username is not null and not p.banned;
create view public.lb_gms with (security_invoker = on) as
  select u.* from public.lb_users u join public.profiles p on p.id = u.id where p.role is distinct from 'owner';

drop view if exists public.lb_players;
create view public.lb_players with (security_invoker = on) as
  select c.*, p.username, p.icon, p.color, p.avatar from public.created_players c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

drop view if exists public.lb_weekly;
create view public.lb_weekly with (security_invoker = on) as
  select w.*, p.username, p.title, p.icon, p.color, p.avatar from public.weekly_scores w join public.profiles p on p.id = w.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

drop view if exists public.lb_daily;
create view public.lb_daily with (security_invoker = on) as
  select d.*, p.username, p.title, p.icon, p.color, p.avatar from public.daily_legend d join public.profiles p on p.id = d.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

drop view if exists public.lb_rebuild;
create view public.lb_rebuild with (security_invoker = on) as
  select r.*, p.username, p.title, p.icon, p.color, p.avatar from public.rebuild_records r join public.profiles p on p.id = r.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

drop view if exists public.lb_codes;
create view public.lb_codes with (security_invoker = on) as
  select c.*, p.username, p.icon, p.color, p.avatar from public.code_results c join public.profiles p on p.id = c.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

drop view if exists public.lb_ranked;
create view public.lb_ranked with (security_invoker = on) as
  select e.season, e.user_id, p.username, p.title, sum(e.points)::int as points, count(*)::int as events, p.icon, p.color, p.avatar
  from public.ranked_events e join public.profiles p on p.id = e.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner'
  group by e.season, e.user_id, p.username, p.title, p.icon, p.color, p.avatar;

drop view if exists public.lb_pvp;
create view public.lb_pvp with (security_invoker = on) as
  select g.user_id, p.username, p.title, g.rating, g.wins, g.losses, g.squad, g.updated_at, p.icon, p.color, p.avatar
  from public.hunt_ghosts g join public.profiles p on p.id = g.user_id
  where p.username is not null and not p.banned and p.role is distinct from 'owner';

grant select on public.lb_users, public.lb_gms, public.lb_players, public.lb_weekly, public.lb_daily, public.lb_rebuild, public.lb_codes, public.lb_ranked, public.lb_pvp to anon, authenticated;

-- Clans: the owner's XP and weekly results count for nobody.
drop view if exists public.lb_clubs;
create view public.lb_clubs with (security_invoker = on) as
  select c.id, c.name, c.tag, c.badge, c.color, c.motto, c.owner, c.created_at, count(m.user_id)::int as members, coalesce(sum(p.xp), 0)::bigint as xp,
    c.description, c.flag, c.open
  from public.clubs c left join public.club_members m on m.club_id = c.id
  left join public.profiles p on p.id = m.user_id and not p.banned and p.role is distinct from 'owner'
  group by c.id;

drop view if exists public.lb_club_weekly;
create view public.lb_club_weekly with (security_invoker = on) as
  with s as (
    select w.board, w.week, w.user_id, w.score, max(w.score) over (partition by w.board, w.week) as top
    from public.weekly_scores w join public.profiles p on p.id = w.user_id where not p.banned and p.role is distinct from 'owner'
  )
  select m.club_id, c.name, c.tag, c.badge, c.color, s.week,
    sum(round(100.0 * greatest(s.score, 0) / greatest(s.top, 1)))::int as points, count(distinct s.user_id)::int as players, c.flag
  from s join public.club_members m on m.user_id = s.user_id join public.clubs c on c.id = m.club_id
  group by m.club_id, c.name, c.tag, c.badge, c.color, s.week, c.flag;

drop view if exists public.lb_club_members;
create view public.lb_club_members with (security_invoker = on) as
  with s as (
    select w.board, w.week, w.user_id, w.score, max(w.score) over (partition by w.board, w.week) as top
    from public.weekly_scores w join public.profiles p on p.id = w.user_id where not p.banned and p.role is distinct from 'owner'
  )
  select m.club_id, m.user_id, m.joined_at, p.username, p.title, p.icon, p.color, p.avatar, p.level, p.xp, s.week,
    coalesce(sum(round(100.0 * greatest(s.score, 0) / greatest(s.top, 1))), 0)::int as points
  from public.club_members m join public.profiles p on p.id = m.user_id
  left join s on s.user_id = m.user_id
  where p.username is not null and not p.banned
  group by m.club_id, m.user_id, m.joined_at, p.username, p.title, p.icon, p.color, p.avatar, p.level, p.xp, s.week;

grant select on public.lb_clubs, public.lb_club_weekly, public.lb_club_members to anon, authenticated;
