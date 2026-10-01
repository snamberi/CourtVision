-- Game-owner access: every cosmetic open for an account with role 'owner'.
-- Players cannot write this column (it is not in the profiles update grant); set it here, in the SQL editor.
alter table public.profiles add column if not exists role text check (role in ('owner'));

-- Then give yourself owner access (use your GM name from the boards):
-- update public.profiles set role = 'owner' where username = 'YourName';
