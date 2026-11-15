begin;
alter table public.gifts add column if not exists message text not null default '' check (char_length(message)<=300);
alter table public.gifts add column if not exists spins integer not null default 0 check(spins between 0 and 10000);
alter table public.gifts add column if not exists gems integer not null default 0 check(gems between 0 and 100000);
alter table public.gifts add column if not exists items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=20);
alter table public.gifts add column if not exists cosmetics jsonb not null default '[]' check(jsonb_typeof(cosmetics)='array' and jsonb_array_length(cosmetics)<=20);
commit;
