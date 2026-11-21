-- Restrict profile role changes to the immutable primary administrator.
-- The RPC now runs as SECURITY INVOKER; RLS and column grants provide the boundary.
begin;

revoke update on table public.profiles from anon, authenticated;
grant update (role, updated_at) on table public.profiles to authenticated;

drop policy if exists "main admin can manage unit member roles" on public.profiles;
create policy "main admin can manage unit member roles"
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = 'dfd12351-10c9-4ba8-947b-3e11dcee835f'::uuid
  and id <> 'dfd12351-10c9-4ba8-947b-3e11dcee835f'::uuid
  and unit_id = '86b98b87-0c09-4247-86ec-b873269d8dac'::uuid
)
with check (
  (select auth.uid()) = 'dfd12351-10c9-4ba8-947b-3e11dcee835f'::uuid
  and id <> 'dfd12351-10c9-4ba8-947b-3e11dcee835f'::uuid
  and unit_id = '86b98b87-0c09-4247-86ec-b873269d8dac'::uuid
  and role <> 'admin'::public.navyhub_role
);

alter function public.admin_set_profile_role(uuid, public.navyhub_role) security invoker;
revoke all on function public.admin_set_profile_role(uuid, public.navyhub_role) from public, anon;
grant execute on function public.admin_set_profile_role(uuid, public.navyhub_role) to authenticated;

commit;
