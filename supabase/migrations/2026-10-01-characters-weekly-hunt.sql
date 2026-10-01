-- Court Vision update: characters on the boards, the Weekly Hunt board and the new honors.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run. It is safe to run more than once.

-- Your character as a look code (written by the server at sync).
alter table public.profiles add column if not exists avatar text check (length(avatar) <= 64);

-- The Weekly Hunt board.
alter table public.weekly_scores drop constraint if exists weekly_scores_board_check;
alter table public.weekly_scores add constraint weekly_scores_board_check check (board in ('rebuild', 'career', 'hunt'));

-- The boards show each GM's character.
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
