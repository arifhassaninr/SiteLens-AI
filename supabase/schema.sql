-- Run once in Supabase -> SQL Editor. Requires Supabase Auth (email/password).
-- The browser receives ONLY the public anon/publishable key; never service_role.
create extension if not exists pgcrypto;
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint result_size_check check (octet_length(result::text) <= 50000)
);
create index if not exists reports_user_created_idx on public.reports(user_id, created_at desc);
create index if not exists reports_shared_idx on public.reports(id) where is_public = true;
alter table public.reports enable row level security;
-- Restrict SQL privileges in addition to RLS policies.
revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to anon;
grant select, insert, update, delete on table public.reports to authenticated;

drop policy if exists "read owned or shared" on public.reports;
create policy "read owned or shared" on public.reports for select to anon, authenticated
  using (is_public = true or (select auth.uid()) = user_id);

drop policy if exists "insert own report" on public.reports;
create policy "insert own report" on public.reports for insert to authenticated
  with check ((select auth.uid()) = user_id and is_public = false);

drop policy if exists "update own report" on public.reports;
create policy "update own report" on public.reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delete own report" on public.reports;
create policy "delete own report" on public.reports for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Optional: user can delete their account data via Supabase policies/platform operations.
-- Before production, test that anon cannot read private reports or modify rows,
-- and that user B cannot change user A's report.
