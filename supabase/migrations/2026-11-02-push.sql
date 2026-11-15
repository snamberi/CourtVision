begin;
create table if not exists public.push_subscriptions(endpoint text primary key,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now());
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
create table if not exists public.push_jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,event_key text unique not null,created_at timestamptz not null default now(),next_attempt timestamptz not null default now(),attempts integer not null default 0,lease uuid,leased_until timestamptz,delivered_at timestamptz);
create index if not exists push_jobs_pending on public.push_jobs(next_attempt) where delivered_at is null;
alter table public.push_subscriptions enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_subscriptions,public.push_jobs from anon,authenticated;
create or replace function public.register_push_subscription(p_user uuid,p_endpoint text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=p_user and not banned) then raise exception 'Account unavailable.'; end if;
 if (select count(*) from push_subscriptions where user_id=p_user and endpoint<>p_endpoint)>=5 then raise exception 'Five notification devices are already registered.'; end if;
 insert into push_subscriptions(endpoint,user_id) values(p_endpoint,p_user) on conflict(endpoint) do update set user_id=excluded.user_id,created_at=now();
end $$;
create or replace function public.enqueue_gift_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from push_subscriptions where user_id=new.recipient) then insert into push_jobs(user_id,event_key) values(new.recipient,'gift:'||new.id) on conflict do nothing; end if;return new;
end $$;
drop trigger if exists gift_push on public.gifts;
create trigger gift_push after insert on public.gifts for each row execute function public.enqueue_gift_push();
create or replace function public.enqueue_activity_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.score<=old.score then return new; end if;
 insert into push_jobs(user_id,event_key)
 select f.user_id,'activity:'||new.user_id||':'||f.user_id||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24')
 from follows f join profiles p on p.id=f.user_id and not p.banned
 where f.target_id=new.user_id and exists(select 1 from push_subscriptions s where s.user_id=f.user_id)
 on conflict do nothing;return new;
end $$;
drop trigger if exists activity_push on public.weekly_scores;
create trigger activity_push after insert or update on public.weekly_scores for each row execute function public.enqueue_activity_push();
create or replace function public.lease_push_jobs() returns table(id uuid,user_id uuid,lease uuid) language plpgsql security definer set search_path=public as $$
begin
 delete from push_jobs where created_at<now()-interval '7 days';
 return query with selected as (
 select j.id from push_jobs j join profiles p on p.id=j.user_id and not p.banned where j.delivered_at is null and j.next_attempt<=now() and j.attempts<5 and (j.leased_until is null or j.leased_until<now()) order by j.created_at for update of j skip locked limit 5
 ) update push_jobs j set lease=gen_random_uuid(),leased_until=now()+interval '5 minutes',attempts=j.attempts+1 from selected s where j.id=s.id returning j.id,j.user_id,j.lease;
end $$;
create or replace function public.finish_push_job(p_id uuid,p_lease uuid,p_retry boolean) returns void language sql security definer set search_path=public as $$
 update push_jobs set delivered_at=case when p_retry then null else now() end,next_attempt=now()+interval '5 minutes',leased_until=null,lease=null where id=p_id and lease=p_lease;
$$;
revoke all on function public.register_push_subscription(uuid,text),public.lease_push_jobs(),public.finish_push_job(uuid,uuid,boolean),public.enqueue_gift_push(),public.enqueue_activity_push() from public,anon,authenticated;
grant execute on function public.register_push_subscription(uuid,text),public.lease_push_jobs(),public.finish_push_job(uuid,uuid,boolean) to service_role;
commit;
