-- ALNAV DMS departmental identity and supply classification foundation
-- Additive-only: existing records are preserved. Unknown department ownership remains NULL.
-- Class V reads are restricted by RLS; explicit profile entitlement is required outside command/admin.

create table if not exists public.departments (
  unit_id uuid not null references public.units(id) on delete cascade,
  code text not null check (code in ('OPS','SIN','EKA','LOG')),
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (unit_id, code)
);

insert into public.departments(unit_id,code,name,description)
select u.id,d.code,d.name,d.description
from public.units u
cross join (values
 ('OPS','Operasi','Departemen Operasi'),
 ('SIN','Senjata','Departemen Senjata'),
 ('EKA','Elektronika','Departemen Elektronika'),
 ('LOG','Logistik','Departemen Logistik')
) as d(code,name,description)
where u.is_active = true
on conflict (unit_id,code) do update
set name=excluded.name, description=excluded.description;

alter table public.profiles
  add column if not exists department_code text,
  add column if not exists is_department_head boolean not null default false,
  add column if not exists can_access_class_v boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_department_fk;
alter table public.profiles
  add constraint profiles_department_fk
  foreign key (unit_id,department_code)
  references public.departments(unit_id,code)
  on update cascade on delete restrict;

alter table public.profiles
  drop constraint if exists profiles_department_head_requires_department;
alter table public.profiles
  add constraint profiles_department_head_requires_department
  check (is_department_head = false or department_code is not null);

alter table public.activity_logs add column if not exists department_code text;
alter table public.inventory_items
  add column if not exists supply_class text,
  add column if not exists department_code text;
alter table public.maintenance_assets add column if not exists department_code text;
alter table public.maintenance_records add column if not exists department_code text;
alter table public.checklists add column if not exists department_code text;
alter table public.checklist_runs add column if not exists department_code text;
alter table public.daily_watch_reports add column if not exists department_code text;
alter table public.personnel add column if not exists department_code text;

do $$
declare t text;
begin
  foreach t in array array['activity_logs','inventory_items','maintenance_assets','maintenance_records','checklists','checklist_runs','daily_watch_reports','personnel']
  loop
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_department_fk');
    execute format('alter table public.%I add constraint %I foreign key (unit_id,department_code) references public.departments(unit_id,code) on update cascade on delete restrict',t,t||'_department_fk');
  end loop;
end $$;

alter table public.inventory_items
  drop constraint if exists inventory_items_supply_class_check;
alter table public.inventory_items
  add constraint inventory_items_supply_class_check
  check (supply_class is null or supply_class in ('I','III','IV','V','VIII','IX'));

update public.inventory_items
set supply_class='I', department_code='LOG'
where supply_class is null and lower(category) in ('air tawar','class i · subsistence','subsistence','provisions');

update public.inventory_items
set supply_class='III', department_code='LOG'
where supply_class is null and lower(category) in ('bbm','fuel','hsd','bahan bakar');

update public.inventory_items
set supply_class='V', department_code='SIN'
where supply_class is null and lower(category)='amunisi';

create index if not exists idx_profiles_unit_department on public.profiles(unit_id,department_code);
create index if not exists idx_activity_logs_unit_department on public.activity_logs(unit_id,department_code);
create index if not exists idx_inventory_items_unit_class_department on public.inventory_items(unit_id,supply_class,department_code);
create index if not exists idx_maintenance_assets_unit_department on public.maintenance_assets(unit_id,department_code);
create index if not exists idx_maintenance_records_unit_department on public.maintenance_records(unit_id,department_code);
create index if not exists idx_checklists_unit_department on public.checklists(unit_id,department_code);
create index if not exists idx_checklist_runs_unit_department on public.checklist_runs(unit_id,department_code);
create index if not exists idx_daily_watch_reports_unit_department on public.daily_watch_reports(unit_id,department_code);
create index if not exists idx_personnel_unit_department on public.personnel(unit_id,department_code);

create or replace function private.current_department_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.department_code
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active = true
$$;

create or replace function private.is_department_head()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.is_department_head
    from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true
  ), false)
$$;

create or replace function private.can_access_class_v()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.can_access_class_v
    from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true
  ), false)
$$;

grant execute on function private.current_department_code() to authenticated;
grant execute on function private.is_department_head() to authenticated;
grant execute on function private.can_access_class_v() to authenticated;

alter table public.departments enable row level security;
drop policy if exists "read unit departments" on public.departments;
create policy "read unit departments"
on public.departments for select to authenticated
using (unit_id = (select private.current_unit_id()));

drop policy if exists "admins manage unit departments" on public.departments;
create policy "admins manage unit departments"
on public.departments for all to authenticated
using (unit_id = (select private.current_unit_id()) and private.current_navyhub_role() = 'admin')
with check (unit_id = (select private.current_unit_id()) and private.current_navyhub_role() = 'admin');

drop policy if exists "restrict class v inventory reads" on public.inventory_items;
create policy "restrict class v inventory reads"
on public.inventory_items as restrictive for select to authenticated
using (
  coalesce(supply_class,'') <> 'V'
  or private.current_navyhub_role() in ('admin','commander')
  or (select private.can_access_class_v())
);

drop policy if exists "restrict class v stock movement reads" on public.stock_movements;
create policy "restrict class v stock movement reads"
on public.stock_movements as restrictive for select to authenticated
using (
  exists (
    select 1 from public.inventory_items i
    where i.id = stock_movements.item_id
      and (
        coalesce(i.supply_class,'') <> 'V'
        or private.current_navyhub_role() in ('admin','commander')
        or (select private.can_access_class_v())
      )
  )
);
