-- Security audit 2026-11-26, findings F1 and F2. Additive and reversible; no data is changed.
--
-- F1: personnel rows (NRP, birth place/date, education, TMT, remarks) were readable by every
--     active unit account. Full rows are now readable only by unit managers (admin/commander).
--     Everyone else in the unit reads a directory without private fields via
--     public.personnel_directory(). Watch handover no longer needs NRP on the client: a trigger
--     copies name/rank/NRP of the selected watch officers from personnel on the server.
-- F2: officers/operators could record stock movements for Class V items they cannot see (the
--     SECURITY DEFINER balance trigger then changed ammunition balances) and for any department.
--     A RESTRICTIVE insert policy now requires Class V entitlement and, for non-managers, that the
--     item belongs to the user's own department (items without a department stay common).
--
-- Rollback:
--   drop policy "stock movement item class and department" on public.stock_movements;
--   drop trigger fill_watch_officer_identity on public.daily_watch_assignments;
--   drop function private.fill_watch_officer_identity(); drop function public.personnel_directory();
--   alter policy personnel_read_unit on public.personnel using (<previous qual without is_unit_manager>);

-- F1 ---------------------------------------------------------------------------------------
alter policy personnel_read_unit on public.personnel
  using (
    unit_id = (select private.current_unit_id())
    and (select private.is_unit_manager())
  );

create or replace function public.personnel_directory()
returns table (
  id uuid, unit_id uuid, roster_period date, sequence_no integer, full_name text,
  rank_title text, "position" text, department_code text, has_nrp boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.unit_id, p.roster_period, p.sequence_no, p.full_name, p.rank_title, p.position,
         p.department_code, (nullif(btrim(p.nrp), '') is not null), p.created_at, p.updated_at
  from public.personnel p
  where p.unit_id = (select private.current_unit_id())
  order by p.sequence_no
$$;
revoke all on function public.personnel_directory() from public, anon;
grant execute on function public.personnel_directory() to authenticated;
comment on function public.personnel_directory() is
  'Unit personnel directory without private fields (NRP, birth data, education, TMT, remarks). Full rows: managers only via RLS.';

create or replace function private.fill_watch_officer_identity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare o public.personnel; n public.personnel;
begin
  if tg_op = 'UPDATE'
     and new.old_watch_personnel_id is not distinct from old.old_watch_personnel_id
     and new.new_watch_personnel_id is not distinct from old.new_watch_personnel_id then
    new.old_watch_name := old.old_watch_name; new.old_watch_rank := old.old_watch_rank; new.old_watch_nrp := old.old_watch_nrp;
    new.new_watch_name := old.new_watch_name; new.new_watch_rank := old.new_watch_rank; new.new_watch_nrp := old.new_watch_nrp;
    return new;
  end if;
  if new.old_watch_personnel_id is null and new.new_watch_personnel_id is null then return new; end if;
  select * into o from public.personnel where id = new.old_watch_personnel_id and unit_id = new.unit_id;
  select * into n from public.personnel where id = new.new_watch_personnel_id and unit_id = new.unit_id;
  if o.id is null or n.id is null then
    raise exception 'Perwira Jaga tidak ditemukan pada personel unit ini' using errcode = '23503';
  end if;
  if nullif(btrim(o.rank_title), '') is null or nullif(btrim(o.nrp), '') is null
     or nullif(btrim(n.rank_title), '') is null or nullif(btrim(n.nrp), '') is null then
    raise exception 'Lengkapi pangkat dan NRP kedua Perwira Jaga di PERSONEL sebelum menetapkan jaga.' using errcode = '23514';
  end if;
  new.old_watch_name := o.full_name; new.old_watch_rank := o.rank_title; new.old_watch_nrp := o.nrp;
  new.new_watch_name := n.full_name; new.new_watch_rank := n.rank_title; new.new_watch_nrp := n.nrp;
  return new;
end;
$$;
revoke all on function private.fill_watch_officer_identity() from public, anon, authenticated;

create trigger fill_watch_officer_identity
  before insert or update on public.daily_watch_assignments
  for each row execute function private.fill_watch_officer_identity();

-- F2 ---------------------------------------------------------------------------------------
create policy "stock movement item class and department"
  on public.stock_movements
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.inventory_items i
      where i.id = stock_movements.item_id
        and i.unit_id = stock_movements.unit_id
        and (
          coalesce(i.supply_class, '') <> 'V'
          or (select private.current_navyhub_role()) in ('admin', 'commander')
          or (select private.can_access_class_v())
        )
        and (
          i.department_code is null
          or (select private.is_unit_manager())
          or i.department_code = (select private.current_department_code())
        )
    )
  );
