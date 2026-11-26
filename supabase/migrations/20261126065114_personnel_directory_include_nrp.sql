-- Owner decision 2026-11-26: NRP may be visible to every active unit account; date of birth must not.
-- Birth place, education, TMT and remarks also stay private (Admin/Commander only).
-- Return type changes, so the function is dropped and recreated in one transaction. No data is changed.
drop function public.personnel_directory();
create function public.personnel_directory()
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
revoke all on function public.personnel_directory() from public, anon;
grant execute on function public.personnel_directory() to authenticated;
comment on function public.personnel_directory() is
  'Unit personnel directory incl. NRP; excludes birth place/date, education, TMT and remarks. Full rows: managers only via RLS.';
