-- Owner decision 2026-11-26: two-step verification mode removed. Reverts
-- 20261126065753_require_mfa_when_enrolled. Sign-in is email + password; all other RLS
-- (unit isolation, roles, Class V, personnel privacy, department stock writes) is unchanged.
-- No data is changed; existing auth.mfa_factors rows are left untouched and have no effect.

do $$
declare t text;
begin
  for t in select tablename from pg_policies
           where schemaname = 'public' and policyname = 'require mfa when enrolled' loop
    execute format('drop policy "require mfa when enrolled" on public.%I', t);
  end loop;
end $$;

drop policy if exists "require mfa when enrolled" on storage.objects;

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
  order by p.sequence_no
$$;

drop function if exists private.mfa_ok();
