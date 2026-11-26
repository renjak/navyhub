-- Jaga Laut: daily division rotation, filled in by the Perwira Jaga (owner decision 2026-11-26).
-- Three watches per WIB calendar day (PH-MH 08–12/20–24, PT-DH 12–16/00–04, SH-DH 16–20/04–08);
-- divisions A/B/C rotate, so each day records which division stands which watch.
-- Additive: new table only. Rollback: drop table public.sea_watch_rotations;

create table public.sea_watch_rotations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  duty_date date not null,
  watch_code text not null check (watch_code in ('PH-MH', 'PT-DH', 'SH-DH')),
  division text not null check (division in ('A', 'B', 'C')),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sea_watch_rotations_one_division_per_watch unique (unit_id, duty_date, watch_code),
  -- one watch per division per day; deferred so two divisions can be swapped in one save
  constraint sea_watch_rotations_one_watch_per_division unique (unit_id, duty_date, division) deferrable initially deferred
);
create index sea_watch_rotations_set_by_idx on public.sea_watch_rotations (set_by);

alter table public.sea_watch_rotations enable row level security;

create policy "read unit sea watch rotations" on public.sea_watch_rotations
  for select to authenticated
  using (unit_id = (select private.current_unit_id()));

-- Perwira Jaga = officer-level accounts; Admin and Commander may correct.
create policy "officers set sea watch rotations" on public.sea_watch_rotations
  for insert to authenticated
  with check (
    unit_id = (select private.current_unit_id())
    and set_by = (select auth.uid())
    and (select private.current_navyhub_role()) in ('admin', 'commander', 'officer')
  );

create policy "officers update sea watch rotations" on public.sea_watch_rotations
  for update to authenticated
  using (
    unit_id = (select private.current_unit_id())
    and (select private.current_navyhub_role()) in ('admin', 'commander', 'officer')
  )
  with check (
    unit_id = (select private.current_unit_id())
    and set_by = (select auth.uid())
    and (select private.current_navyhub_role()) in ('admin', 'commander', 'officer')
  );

revoke all on public.sea_watch_rotations from anon;
grant select, insert, update on public.sea_watch_rotations to authenticated;

create trigger audit_sea_watch_rotations
  after insert or update or delete on public.sea_watch_rotations
  for each row execute function private.write_audit_log();
