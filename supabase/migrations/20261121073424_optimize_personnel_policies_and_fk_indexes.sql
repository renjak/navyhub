drop policy if exists personnel_manage_unit on public.personnel;
create policy personnel_insert_manage on public.personnel for insert to authenticated with check (
  unit_id = (select p.unit_id from public.profiles p where p.id = (select auth.uid()))
  and private.is_unit_manager()
);
create policy personnel_update_manage on public.personnel for update to authenticated using (
  unit_id = (select p.unit_id from public.profiles p where p.id = (select auth.uid()))
  and private.is_unit_manager()
) with check (
  unit_id = (select p.unit_id from public.profiles p where p.id = (select auth.uid()))
  and private.is_unit_manager()
);
create policy personnel_delete_manage on public.personnel for delete to authenticated using (
  unit_id = (select p.unit_id from public.profiles p where p.id = (select auth.uid()))
  and private.is_unit_manager()
);
create index if not exists stock_movements_approved_by_idx on public.stock_movements (approved_by);
create index if not exists vessel_gps_positions_reporter_user_id_idx on public.vessel_gps_positions (reporter_user_id);
