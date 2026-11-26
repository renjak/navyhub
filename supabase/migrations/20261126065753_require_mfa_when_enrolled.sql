-- Security audit 2026-11-26, finding F3 (MFA). Additive; no data is changed.
-- Once an account has a verified MFA factor, its sessions must be AAL2 (password + authenticator
-- code) to read or write any ALNAV DMS table or file. A stolen password alone then gives nothing.
-- Accounts without a factor are unaffected (the app forces Admin/Commander to enroll).
-- Own profile row stays readable at AAL1 so the app can show the verification step.
--
-- Rollback: drop policy "require mfa when enrolled" on every public table and storage.objects;
--           drop function private.mfa_ok(); restore personnel_directory() without the mfa check.

create or replace function private.mfa_ok()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      )
$$;
revoke all on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'profiles' loop
    execute format(
      'create policy "require mfa when enrolled" on public.%I as restrictive for all to authenticated
         using ((select private.mfa_ok())) with check ((select private.mfa_ok()))', t);
  end loop;
end $$;

create policy "require mfa when enrolled" on public.profiles
  as restrictive for all to authenticated
  using ((select private.mfa_ok()) or id = (select auth.uid()))
  with check ((select private.mfa_ok()));

create policy "require mfa when enrolled" on storage.objects
  as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- SECURITY DEFINER directory bypasses RLS, so it checks MFA itself.
create or replace function public.personnel_directory()
returns table (
  id uuid, unit_id uuid, roster_period date, sequence_no integer, full_name text,
  rank_title text, nrp text, "position" text, department_code text, has_nrp boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.unit_id, p.roster_period, p.sequence_no, p.full_name, p.rank_title, p.nrp, p.position,
         p.department_code, (nullif(btrim(p.nrp), '') is not null), p.created_at, p.updated_at
  from public.personnel p
  where p.unit_id = (select private.current_unit_id())
    and (select private.mfa_ok())
  order by p.sequence_no
$$;
