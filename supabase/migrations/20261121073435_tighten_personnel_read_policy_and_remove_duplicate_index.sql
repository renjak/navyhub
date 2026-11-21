drop policy if exists personnel_read_unit on public.personnel;
create policy personnel_read_unit on public.personnel for select to authenticated using (
  unit_id = (select p.unit_id from public.profiles p where p.id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
);
drop index if exists public.checklist_responses_run_item_unique;
