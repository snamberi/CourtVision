-- Review and run on staging before an approved release. No client can write messages directly.
begin;
create table if not exists public.courtchat_messages (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 400),
 created_at timestamptz not null default now()
);
create index if not exists courtchat_recent on public.courtchat_messages(created_at desc);
create table if not exists public.courtchat_presence (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_seen timestamptz not null default now(), last_message timestamptz
);
alter table public.courtchat_messages enable row level security;
alter table public.courtchat_presence enable row level security;
revoke all on public.courtchat_messages, public.courtchat_presence from anon, authenticated;
create or replace function public.courtchat_presence() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and not coalesce(banned,false)) then raise exception 'Sign in with an active account.'; end if;
 insert into courtchat_presence(user_id,last_seen) values(auth.uid(),now()) on conflict(user_id) do update set last_seen=excluded.last_seen;
end $$;
create or replace function public.courtchat_send(message text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare last_at timestamptz;
begin
 perform courtchat_presence();
 if char_length(trim(message)) not between 1 and 400 then raise exception 'Use 1–400 characters.'; end if;
 select last_message into last_at from courtchat_presence where user_id=auth.uid() for update;
 if last_at > clock_timestamp()-interval '5 seconds' then raise exception 'Wait five seconds between messages.'; end if;
 update courtchat_presence set last_message=clock_timestamp() where user_id=auth.uid();
 insert into courtchat_messages(user_id,body) values(auth.uid(),trim(message));
 delete from courtchat_messages where created_at < now()-interval '7 days';
end $$;
create or replace function public.courtchat_read() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 return jsonb_build_object('online',(select count(*) from courtchat_presence cp join profiles p on p.id=cp.user_id where cp.last_seen>now()-interval '60 seconds' and not coalesce(p.banned,false)), 'messages',coalesce((select jsonb_agg(q order by q.created_at) from (select m.id,p.username,m.body,m.created_at from courtchat_messages m join profiles p on p.id=m.user_id where not coalesce(p.banned,false) and m.created_at>now()-interval '7 days' order by m.created_at desc limit 50) q),'[]'::jsonb));
end $$;
revoke all on function public.courtchat_presence(),public.courtchat_send(text),public.courtchat_read() from public;
grant execute on function public.courtchat_presence(),public.courtchat_send(text),public.courtchat_read() to authenticated;
commit;
