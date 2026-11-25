# ALNAV DMS
## ALAMANG NAVAL DATA MANAGEMENT SYSTEM

The active application for KRI ALAMANG-644, developed from the former NAVYHUB codebase. It remains on the existing Next.js and Supabase infrastructure. Database identifiers and deployment environment-variable names remain unchanged until separately reviewed migrations are approved.

## Source and release safety
- Production baseline: feat/navyhub-operational-modules at 49d69aa741181caa22f627be9ed4d5c966d36009.
- Implementation branch: alnav-dms/phase-1-gps-safety.
- Preview validation is separate from production. No production merge or deployment is authorized by this work.
- Do not merge divergent feature/rebuild branches without file-by-file reconciliation.

## User-facing module names
| Stable internal ID | Display name | Current source |
|---|---|---|
| Dashboard | DASHBOARD | Existing dashboard queries and telemetry |
| NAVYLOG | LOGBOOK | activity_logs, checklists, daily-watch components |
| NAVYSTOCK | STOCK | inventory_items, stock_movements |
| NAVYCREW | PERSONEL | personnel, profiles |
| NAVYMAINT | MAINTENANCE | maintenance_assets, maintenance_records |
| NAVYDOCS | ARCHIVE | daily_watch_reports (not yet a full document archive) |

Internal identifiers remain stable to avoid breaking current application logic, database relationships, and RLS policies.

## Verified infrastructure snapshot — 2026-11-25
- Next.js 15.5.29, React 19.2.6, TypeScript 5.8.3, Supabase JS 2.57.x, Capacitor 8.6.x.
- Sixteen public application tables are present; RLS is enabled on all sixteen.
- Exact current row counts: activity_logs 42, audit_logs 314, checklist_items 32, checklist_responses 0, checklist_runs 0, checklists 10, daily_watch_assignments 0, daily_watch_reports 0, inventory_items 17, maintenance_assets 0, maintenance_records 0, personnel 39, profiles 3, stock_movements 2, units 1, vessel_gps_positions 1.
- Current active profile roles: admin, commander, viewer (one account each).
- Existing private Storage bucket: navyhub-files (public=false, currently 0 objects); review its object policies before extending Archive.
- Existing Supabase migrations: 20. Existing migrations include atomic stock balance application, checklist integrity, GPS ingestion and personnel RLS tuning.
- Current inventory categories: Air Tawar (1), Amunisi (15), BBM (1). No Class I/III/IV/V/VIII/IX inventory should be invented.
- Existing stock-balance and audit triggers are present.

## Current implementation status
- Dashboard: partially implemented; requires readiness/alert aggregation and clearer live/stale/offline telemetry indicators.
- LOGBOOK/PHST: import, activity logs and daily-watch components exist. PHST importer is now non-destructive, duplicate-aware and recognizes F. Lain-lain. Full per-activity completion and verification lifecycle remains.
- STOCK: basic inventory and stock movement work exists. Full class-based structure and transaction-integrity review remain.
- PERSONEL: general list now requests a safe allow-list and ordinary editor only changes directory fields. Database-level privacy restrictions are still pending.
- MAINTENANCE: basic asset and fault records exist; no asset or maintenance records are currently stored.
- ARCHIVE: daily-watch archive exists; general document register/versioning is not implemented.
- TELEMETRY: existing GPS and source enforcement foundation exists. Admin continuous device-GPS tracking mode, heading/COG distinction and stale handling still require implementation.
- UI: dark glass foundations and PWA exist; GSAP/ScrollTrigger/Lenis are not installed in the current package.
- Security: RLS enabled for all 16 public tables; column-level/personnel details policy testing remains.
- Official ALNAV DMS logo: not confirmed among available Library assets. Do not substitute or distort the KRI crest to claim completion.

## Important safeguards
1. The supplied PHST document contains A. SITUASI, B. TUGAS POKOK, C. UMUM, D. KHUSUS and F. LAIN-LAIN. Preserve dated entries; never synthesize tasks.
2. Class V/ammunition data is existing restricted data; preserve current rows and policies.
3. RLS policies control rows, not sensitivity of individual columns. Use a private personnel-details design or approved column grants and test direct API access before calling privacy complete.
4. Private Storage access relies on object policies and time-limited signed URLs; do not expose private documents through public URLs.
5. Admin device GPS is a position proxy only when the device is physically onboard and an authorized Admin enables it. Do not call it independent hardware GPS; do not fabricate heading or speed.
6. Do not deploy production until preview build, TypeScript, functional, RLS and regression checks succeed and release is approved.

See docs/ALNAV-DMS-AUDIT.md and docs/ALNAV-DMS-IMPLEMENTATION-LOG.md for detailed audit and work history.