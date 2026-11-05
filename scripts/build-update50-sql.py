"""Build the one-paste bootstrap/update from versioned SQL. No production connection."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
base=(root/'supabase/schema.sql').read_text()
# The historical schema contains intermediate versions of several views. Keep only the
# final definition and replace it in place, preserving downstream views on reruns.
pattern=r'create (?:or replace )?view public\.(\w+)\b.*?;'
matches=list(re.finditer(pattern,base,re.I|re.S))
last={m[1]:m.start() for m in matches}
base=re.sub(pattern,lambda m: re.sub(r'^create (?:or replace )?view','create or replace view',m[0],flags=re.I) if last[m[1]]==m.start() else '',base,flags=re.I|re.S)
base=re.sub(r'drop view if exists public\.\w+\s*;', '',base,flags=re.I)
# Defer view grants until all final view definitions exist.
view_grants=re.findall(r'grant select on public\.lb_.*?;',base,re.I|re.S)
base=re.sub(r'grant select on public\.lb_.*?;', '',base,flags=re.I|re.S)
base+='\n'+'\n'.join(view_grants)
# Ninefold policies in the older migration did not have DROP guards.
def repeatable(sql):
 sql=re.sub(r'^\s*(?:begin|commit);\s*$', '',sql,flags=re.I|re.M)
 sql=re.sub(r'create policy (\w+) on (public\.\w+)',lambda m:f'drop policy if exists {m[1]} on {m[2]};\n{m[0]}',sql,flags=re.I)
 return sql
parts=[('-- Complete core schema (final view definitions only)',base)]
for name in ['2026-10-25-ninefold-accounts.sql','2026-10-25-support-shop.sql','2026-10-31-release-progress.sql','2026-11-01-courtchat.sql','2026-11-01-custom-gifts.sql','2026-11-02-deliveries.sql','2026-11-02-career-cloud.sql','2026-11-02-push.sql']:
 parts.append((f'-- {name}',repeatable((root/'supabase/migrations'/name).read_text())))
text='''-- CourtVision Update 50 — ONE complete Supabase SQL script
-- Supabase -> SQL Editor -> New query -> paste ALL of this file -> Run.
-- Run as the project owner. Do not run the old individual migrations afterward.
-- Supports a fresh project or the existing CourtVision schema. Safe to rerun.
-- Keeps accounts/saves. Does not set an owner account or embed any keys.
-- Run before deploying the matching release branch. Push also needs Cloudflare VAPID secrets.
-- For push: generate keys with node scripts/generate-push-keys.mjs, then set
-- PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY (secret), PUSH_VAPID_SUBJECT
-- in Cloudflare. SQL alone cannot enable browser push or configure an ad provider.
-- All changes share one transaction: an error rolls back this run.
begin;
'''
text+='\n\n'.join(title+'\n'+sql for title,sql in parts)
text+='''
-- Match the API's existing 6 MB unpacked progress limit.
alter table public.progress drop constraint if exists progress_size_check;
alter table public.progress add constraint progress_size_check check(size>=0 and size<=6000000);
-- PostgREST exposes newly created tables/functions after this commit.
notify pgrst, 'reload schema';
commit;
'''
(root/'supabase/UPDATE_50_ALL_IN_ONE.sql').write_text(text)
print(f'Built {len(text):,} characters')
