-- ALNAV DMS: department code SIN is the engineering department (Mesin), not
-- weapons (Senjata). Confirmed by the owner on 26 Nov 2026.
-- Name/description only; the code 'SIN', keys, RLS and existing records are unchanged.
-- Reversible: set name='Senjata', description='Departemen Senjata' for code 'SIN'.
update public.departments
set name = 'Mesin',
    description = 'Departemen Mesin'
where code = 'SIN'
  and name = 'Senjata';
