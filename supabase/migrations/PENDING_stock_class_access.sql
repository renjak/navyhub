-- Per-account stock class access (owner, 26 Nov 2026): the Admin decides which supply classes
-- (I, III, IV, V, VIII, IX) each account can see and record, not only Class V.
-- Defaults keep today's behaviour: every account sees I, III, IV, VIII, IX; V only when it was
-- already authorised. Admin and Commander always see all classes. Items without a class stay common.
-- profiles.can_access_class_v is kept and synchronised for older code paths.
-- Rollback: recreate the two "restrict class v ..." policies and the previous stock movement insert
-- policy (migrations 20261125091939 / 20261126064546), drop the new policies, trigger, functions and column.

alter table public.profiles
  add column stock_classes text[] not null default array['I','III','IV','VIII','IX']::text[];
alter table public.profiles
  add constraint profiles_stock_classes_valid check (stock_classes <@ array['I','III','IV','V','VIII','IX']::text[]);

update public.profiles
   set stock_classes = array(select distinct unnest(stock_classes || array['V']) order by 1)
 where can_access_class_v and not ('V' = any(stock_classes));

create or replace function private.sync_profile_stock_classes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stock_classes is distinct from old.stock_classes then
    new.can_access_class_v := 'V' = any(new.stock_classes);
  elsif new.can_access_class_v is distinct from old.can_access_class_v then
    if new.can_access_class_v then
      new.stock_classes := array(select distinct unnest(new.stock_classes || array['V']));
    else
      new.stock_classes := array_remove(new.stock_classes, 'V');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_profile_stock_classes() from public, anon, authenticated;
create trigger sync_profile_stock_classes
  before insert or update on public.profiles
  for each row execute function private.sync_profile_stock_classes();

create or replace function private.can_access_stock_class(p_class text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(p_class, '') = ''
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.is_active
          and (p.role::text in ('admin', 'commander') or p_class = any(p.stock_classes))
      )
$$;
revoke all on function private.can_access_stock_class(text) from public, anon;
grant execute on function private.can_access_stock_class(text) to authenticated;

-- inventory reads
create policy "restrict inventory reads by stock class" on public.inventory_items
  as restrictive for select to authenticated
  using (private.can_access_stock_class(supply_class));
drop policy "restrict class v inventory reads" on public.inventory_items;

-- stock movement reads follow the item's class
create policy "restrict stock movement reads by stock class" on public.stock_movements
  as restrictive for select to authenticated
  using (exists (select 1 from public.inventory_items i
                 where i.id = stock_movements.item_id and private.can_access_stock_class(i.supply_class)));
drop policy "restrict class v stock movement reads" on public.stock_movements;

-- stock movement writes: class access + owning department for non-managers
create policy "stock movement item class access and department" on public.stock_movements
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from public.inventory_items i
      where i.id = stock_movements.item_id
        and i.unit_id = stock_movements.unit_id
        and private.can_access_stock_class(i.supply_class)
        and (
          i.department_code is null
          or (select private.is_unit_manager())
          or i.department_code = (select private.current_department_code())
        )
    )
  );
drop policy "stock movement item class and department" on public.stock_movements;
