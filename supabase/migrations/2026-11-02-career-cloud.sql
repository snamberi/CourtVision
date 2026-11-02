begin;
create table if not exists public.career_snapshots(
 user_id uuid not null references public.profiles(id) on delete cascade,
 career_id text not null check(length(career_id) between 1 and 120),
 revision bigint not null default 1, meta jsonb not null, world jsonb not null,
 updated_at timestamptz not null default now(), primary key(user_id,career_id)
);
alter table public.career_snapshots enable row level security;
revoke all on public.career_snapshots from anon,authenticated;
grant select,delete on public.career_snapshots to authenticated;
drop policy if exists "own career read" on public.career_snapshots;
create policy "own career read" on public.career_snapshots for select to authenticated using(user_id=auth.uid());
drop policy if exists "own career delete" on public.career_snapshots;
create policy "own career delete" on public.career_snapshots for delete to authenticated using(user_id=auth.uid());
create or replace function public.save_career_snapshot(p_id text,p_revision bigint,p_meta jsonb,p_world jsonb)
returns bigint language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); current_revision bigint; next_revision bigint;
begin
 if me is null or not exists(select 1 from profiles where profiles.id=me and not banned) then raise exception 'Sign in first.'; end if;
 if p_id is null or length(p_id) not between 1 and 120 or p_revision is null or p_revision<0
 or jsonb_typeof(p_meta) is distinct from 'object' or jsonb_typeof(p_world) is distinct from 'object'
 or p_meta->>'id' is distinct from p_id or p_world->>'id' is distinct from p_id
 or p_meta->>'status' is distinct from 'active' or jsonb_typeof(p_world->'league') is distinct from 'object'
 or jsonb_typeof(p_world->'extras') is distinct from 'object'
 or p_world->>'phase' is null or p_world->>'phase' not in ('atDraft','inSeason','over')
 then raise exception 'Invalid career snapshot.'; end if;
 if octet_length(p_meta::text)+octet_length(p_world::text)>20000000 then raise exception 'Career exceeds the 20 MB cloud limit.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cv-career:'||me,0));
 select revision into current_revision from career_snapshots where user_id=me and career_id=p_id for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'CAREER_CONFLICT: another device saved this career. Load the cloud copy or keep your local copy.'; end if;
 if current_revision is null and (select count(*) from career_snapshots where user_id=me)>=10 then raise exception 'Ten cloud careers are saved. Remove an old cloud copy first.'; end if;
 next_revision:=coalesce(current_revision,0)+1;
 insert into career_snapshots(user_id,career_id,revision,meta,world)
 values(me,p_id,next_revision,jsonb_set(p_meta,'{cloudOwner}',to_jsonb(me::text)),p_world)
 on conflict(user_id,career_id) do update set revision=excluded.revision,meta=excluded.meta,world=excluded.world,updated_at=now();
 return next_revision;
end $$;
revoke all on function public.save_career_snapshot(text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.save_career_snapshot(text,bigint,jsonb,jsonb) to authenticated;
commit;
