-- Owner correction 2026-11-26: the 16–20 / 04–08 watch is SH-LM (not SH-DH). Table was empty.
alter table public.sea_watch_rotations drop constraint sea_watch_rotations_watch_code_check;
alter table public.sea_watch_rotations add constraint sea_watch_rotations_watch_code_check
  check (watch_code in ('PH-MH', 'PT-DH', 'SH-LM'));
