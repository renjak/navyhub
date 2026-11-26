-- Admin account management (owner, 26 Nov 2026): the Admin must be able to save role, department,
-- Head of Department, stock classes and active state for any account in the unit. profiles only
-- grants UPDATE(role, updated_at) to authenticated, so direct updates of the other columns failed
-- with "permission denied". This SECURITY DEFINER function performs the change after checking that
-- the caller is the active Admin of the same unit, validates input, and writes an audit entry.
-- Column grants stay narrow. Rollback: drop function public.admin_update_account(uuid,text,text,boolean,text[],boolean);

create or replace function public.admin_update_account(
  p_profile_id uuid, p_role text, p_department_code text, p_is_department_head boolean,
  p_stock_classes text[], p_is_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  target public.profiles;
  v_dept text := nullif(upper(btrim(coalesce(p_department_code, ''))), '');
begin
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or not actor.is_active or actor.role::text <> 'admin' or actor.unit_id is null then
    raise exception 'Only an active Admin can manage accounts' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = p_profile_id for update;
  if target.id is null or target.unit_id is distinct from actor.unit_id then
    raise exception 'Account not found in this unit' using errcode = 'P0002';
  end if;
  if target.id = actor.id or target.role::text = 'admin' then
    raise exception 'The Admin account cannot be changed here' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('viewer', 'operator', 'officer', 'commander') then
    raise exception 'Role not allowed' using errcode = '22023';
  end if;
  if v_dept is not null and v_dept not in ('OPS', 'SIN', 'EKA', 'LOG') then
    raise exception 'Unknown department' using errcode = '22023';
  end if;
  if coalesce(p_is_department_head, false) and v_dept is null then
    raise exception 'A Head of Department needs a department' using errcode = '22023';
  end if;

  update public.profiles set
    role = p_role::public.navyhub_role,
    department_code = v_dept,
    is_department_head = coalesce(p_is_department_head, false) and v_dept is not null,
    stock_classes = coalesce(p_stock_classes, stock_classes),
    is_active = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = p_profile_id;

  insert into public.audit_logs (unit_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (actor.unit_id, actor.id, 'admin_update_account', 'profiles', p_profile_id::text,
    jsonb_build_object('role', target.role, 'department_code', target.department_code, 'is_department_head', target.is_department_head, 'stock_classes', target.stock_classes, 'is_active', target.is_active),
    (select jsonb_build_object('role', p.role, 'department_code', p.department_code, 'is_department_head', p.is_department_head, 'stock_classes', p.stock_classes, 'is_active', p.is_active) from public.profiles p where p.id = p_profile_id));
end;
$$;
revoke all on function public.admin_update_account(uuid, text, text, boolean, text[], boolean) from public, anon;
grant execute on function public.admin_update_account(uuid, text, text, boolean, text[], boolean) to authenticated;
