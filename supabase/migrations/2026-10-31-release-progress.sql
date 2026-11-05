-- Release update-50. Review and apply only at release time, before deploying its API.
-- All figures are derived by /api/sync; clients get SELECT access only.
begin;
create or replace view public.lb_progress with (security_invoker = on) as
select p.*,
  case when jsonb_typeof(stats->'trophies') = 'number' then greatest(0, (stats->>'trophies')::numeric) else 0 end as trophies,
  case when jsonb_typeof(stats->'huntWins') = 'number' then greatest(0, (stats->>'huntWins')::numeric) else 0 end as hunt_wins,
  case when jsonb_typeof(stats->'perfectTitles') = 'number' then greatest(0, (stats->>'perfectTitles')::numeric) else 0 end as perfect_titles,
  case when jsonb_typeof(stats->'perfect98') = 'number' then greatest(0, (stats->>'perfect98')::numeric) else 0 end as perfect98
from public.lb_gms p;
grant select on public.lb_progress to anon, authenticated;

create table if not exists public.leader_reigns (
 id bigint generated always as identity primary key,
 board text not null check (board in ('gms','playtime','players','trophies','hunt','perfect')),
 user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(), ended_at timestamptz,
 check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists leader_reigns_one_current on public.leader_reigns(board) where ended_at is null;
alter table public.leader_reigns enable row level security;
drop policy if exists leader_reigns_read on public.leader_reigns;
create policy leader_reigns_read on public.leader_reigns for select using (true);
revoke all on public.leader_reigns from anon, authenticated;
grant select on public.leader_reigns to anon, authenticated;
create or replace view public.leader_reigns_public with (security_invoker = on) as
select r.*, p.username from public.leader_reigns r join public.profiles p on p.id = r.user_id
where p.username is not null and not p.banned and p.role is distinct from 'owner';
grant select on public.leader_reigns_public to anon, authenticated;

-- Serialized, database-observed tenures, not invented past history. Public callers cannot run this function.
create or replace function public.refresh_leader_reigns() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare b text; winner uuid; current_winner uuid; stamp timestamptz;
begin
 perform pg_advisory_xact_lock(50312750);
 stamp := clock_timestamp();
 foreach b in array array['gms','playtime','players','trophies','hunt','perfect'] loop
   winner := null;
   if b = 'players' then
     select user_id into winner from public.lb_players where legacy > 0 order by legacy desc, user_id, career_id limit 1;
   else
     select id into winner from public.lb_progress
     where (case b when 'gms' then xp when 'playtime' then play_hours when 'trophies' then trophies when 'hunt' then hunt_wins else perfect_titles end) > 0
     order by (case b when 'gms' then xp when 'playtime' then play_hours when 'trophies' then trophies when 'hunt' then hunt_wins else perfect_titles end) desc, id limit 1;
   end if;
   current_winner := null;
   select user_id into current_winner from public.leader_reigns where board = b and ended_at is null;
   if winner is distinct from current_winner then
     update public.leader_reigns set ended_at = greatest(stamp, started_at) where board = b and ended_at is null;
     if winner is not null then insert into public.leader_reigns(board,user_id,started_at) values(b,winner,stamp); end if;
   end if;
 end loop;
 return null;
end $$;
revoke all on function public.refresh_leader_reigns() from public, anon, authenticated;
drop trigger if exists progress_reigns on public.profiles;
create trigger progress_reigns after insert or update or delete on public.profiles for each statement execute function public.refresh_leader_reigns();
drop trigger if exists career_reigns on public.created_players;
create trigger career_reigns after insert or update or delete on public.created_players for each statement execute function public.refresh_leader_reigns();

-- Repair existing numeric title payloads without claiming we know their full unlock list.
update public.game_summaries set summary = jsonb_set(summary, '{cosmetics}',
 (summary->'cosmetics') || jsonb_build_object('titleCount', summary #> '{cosmetics,titles}',
 'titles', case when coalesce(summary->>'title','') <> '' then jsonb_build_array(summary->>'title') else '[]'::jsonb end))
where game = 'courtvision' and jsonb_typeof(summary #> '{cosmetics,titles}') = 'number';
commit;
