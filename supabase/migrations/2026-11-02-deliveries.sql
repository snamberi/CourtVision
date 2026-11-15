begin;
create table if not exists public.reward_receipts (
 id text primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 coins integer not null default 0 check(coins>=0), spins integer not null default 0 check(spins>=0),
 lucky integer not null default 0 check(lucky>=0), gems integer not null default 0 check(gems>=0),
 items jsonb not null default '[]', cosmetics jsonb not null default '[]', label text not null,
 created_at timestamptz not null default now()
);
create index if not exists reward_receipts_owner on public.reward_receipts(user_id,id);
alter table public.reward_receipts enable row level security;
revoke all on public.reward_receipts from anon, authenticated;
grant select on public.reward_receipts to authenticated;
drop policy if exists "own rewards" on public.reward_receipts;
create policy "own rewards" on public.reward_receipts for select to authenticated using(user_id=auth.uid());
create or replace function public.claim_gifts_v2()
returns table(id text, coins integer, spins integer, lucky integer, gems integer, items jsonb, cosmetics jsonb, label text)
language plpgsql security definer set search_path=public as $$
declare me uuid := auth.uid(); g public.gifts%rowtype; rotation_week integer; coin_multiplier integer;
begin
 if me is null or not exists(select 1 from profiles p where p.id=me and not p.banned) then raise exception 'Sign in to collect gifts.'; end if;
 rotation_week:=floor(extract(epoch from (now()-timestamptz '2026-01-05 00:00:00+00'))/604800);
 coin_multiplier:=case when (rotation_week<41 and mod(mod(rotation_week,5)+5,5)=3) or (rotation_week>=41 and mod(rotation_week-41,6)=4) then 2 else 1 end;
 -- Receipt insertion and marking the gift claimed share one transaction. No acknowledgement window.
 for g in select * from gifts where recipient=me and not claimed for update loop
  insert into reward_receipts(id,user_id,coins,spins,lucky,gems,items,cosmetics,label)
  values('gift:'||g.id,me,g.coins*coin_multiplier,g.spins,g.lucky,g.gems,g.items,g.cosmetics,'Gift from '||coalesce((select username::text from profiles where profiles.id=g.sender),'a friend'))
  on conflict do nothing;
  update gifts set claimed=true where gifts.id=g.id;
 end loop;
 -- Durable history permits recovery after a dropped response or a full local disk.
 return query select r.id,r.coins,r.spins,r.lucky,r.gems,r.items,r.cosmetics,r.label from reward_receipts r where r.user_id=me and r.id like 'gift:%' order by r.created_at desc limit 1000;
end $$;
revoke all on function public.claim_gifts_v2() from public,anon;
grant execute on function public.claim_gifts_v2() to authenticated;

create table if not exists public.clan_reward_weeks(week text primary key, settled_at timestamptz not null default now());
create table if not exists public.clan_reward_results(
 week text not null references public.clan_reward_weeks(week), club_id uuid not null,
 place integer not null, points integer not null, primary key(week,club_id)
);
alter table public.clan_reward_weeks enable row level security;
alter table public.clan_reward_results enable row level security;
revoke all on public.clan_reward_weeks,public.clan_reward_results from anon,authenticated;
grant select on public.clan_reward_results to authenticated;
drop policy if exists "read settled results" on public.clan_reward_results;
create policy "read settled results" on public.clan_reward_results for select to authenticated using(true);
create or replace function public.claim_clan_rewards()
returns table(id text, coins integer, spins integer, lucky integer, gems integer, items jsonb, cosmetics jsonb, label text)
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); wk text; starts timestamptz; cid uuid; total_xp bigint; tier integer;
begin
 if me is null or not exists(select 1 from profiles p where p.id=me and not p.banned) then raise exception 'Sign in first.'; end if;
 starts:=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC' - interval '7 days';
 wk:=to_char(starts at time zone 'UTC','IYYY-"W"IW');
 -- One immutable settlement for the completed week, shared by simultaneous claims.
 perform pg_advisory_xact_lock(hashtextextended('cv-clan-rewards:'||wk,0));
 if not exists(select 1 from clan_reward_weeks where week=wk) then
  insert into clan_reward_weeks(week) values(wk);
  insert into clan_reward_results(week,club_id,place,points)
   select wk,b.club_id,row_number() over(order by b.points desc,b.club_id)::integer,b.points
   from lb_club_weekly b where b.week=wk and b.points>0;
  insert into reward_receipts(id,user_id,coins,spins,gems,label)
   select 'clanweek:'||wk||':'||m.user_id,m.user_id,
    case when r.place=1 then 3000 when r.place<=3 then 2000 when r.place<=10 then 1000 else 500 end,
    case when r.place=1 then 5 when r.place<=3 then 4 when r.place<=10 then 3 else 2 end,
    case when r.place=1 then 50 when r.place<=3 then 30 when r.place<=10 then 20 else 10 end,
    'Clan weekly reward · '||wk||' · #'||r.place
   from clan_reward_results r join club_members m on m.club_id=r.club_id
   join profiles p on p.id=m.user_id and not p.banned and p.role is distinct from 'owner'
   where r.week=wk and m.joined_at<=starts
    and exists(select 1 from weekly_scores s where s.user_id=m.user_id and s.week=wk and s.score>0)
   on conflict do nothing;
 end if;
 select m.club_id into cid from club_members m where m.user_id=me;
 if cid is not null then
  select coalesce(sum(p.xp),0) into total_xp from club_members m join profiles p on p.id=m.user_id where m.club_id=cid and not p.banned and p.role is distinct from 'owner';
  for tier in 1..least(10,(total_xp/25000)::integer) loop
   insert into reward_receipts(id,user_id,coins,spins,gems,label)
    values('clanpass:'||me||':'||(tier*5),me,500,1,5,'Clan pass · tier '||(tier*5)) on conflict do nothing;
  end loop;
 end if;
 return query select r.id,r.coins,r.spins,r.lucky,r.gems,r.items,r.cosmetics,r.label from reward_receipts r where r.user_id=me and r.id like 'clan%' order by r.created_at desc limit 1000;
end $$;
revoke all on function public.claim_clan_rewards() from public,anon;
grant execute on function public.claim_clan_rewards() to authenticated;
commit;
