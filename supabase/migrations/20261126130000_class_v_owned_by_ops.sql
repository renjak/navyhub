-- ALNAV DMS: Class V (ammunition) is held by the Operations department (OPS,
-- shown as DEPOPS). Decided by the owner on 26 Nov 2026; SIN is Mesin (engineering).
-- Moves department ownership of Class V inventory from SIN to OPS. Quantities,
-- movements, supply_class and RLS (Class V reads still require can_access_class_v)
-- are unchanged. Reversible: set department_code='SIN' for the same rows.
update public.inventory_items
set department_code = 'OPS',
    updated_at = now()
where supply_class = 'V'
  and department_code = 'SIN';
