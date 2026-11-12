import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import fs from 'node:fs';
import {scenarios} from './sql/update50-scenarios.mjs';
const db=new PGlite({extensions:{citext}});
const bootstrap=`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant select on tables to authenticated,anon;
`;
try{
 await db.exec(bootstrap);
 const sql=fs.readFileSync(new URL('../supabase/UPDATE_50_ALL_IN_ONE.sql',import.meta.url),'utf8');
 await db.exec(sql);console.log('Fresh install PASS');
 await db.exec(sql);console.log('Rerun PASS');
 await scenarios(db);
 await db.exec(sql);console.log('Rerun with existing users/rewards/saves PASS');
 await db.close();
}catch(e){console.error(e.message, e.detail||'', e.hint||'');if(e.query&&e.position)console.error(e.query.slice(Math.max(0,Number(e.position)-200),Number(e.position)+200));process.exitCode=1;}
