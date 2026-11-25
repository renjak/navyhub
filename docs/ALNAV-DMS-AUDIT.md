# ALNAV DMS — Phase 1 Audit Report
Snapshot date: 25 November 2026
Repository: renjak/navyhub
Production baseline: feat/navyhub-operational-modules — 49d69aa741181caa22f627be9ed4d5c966d36009
Implementation branch: alnav-dms/phase-1-gps-safety

## 1. Executive result
The active application is the existing Next.js/Supabase application in the src directory of renjak/navyhub. The current production baseline is not the archived default branch. Keep work isolated from production and reconcile divergent feature branches deliberately; an alternative rebuild branch is substantially diverged from the production baseline and is not a safe blind merge candidate.

The current product is a functioning foundation, not a completed naval management suite. Authentication, data tables, row-level policies, stock-balance triggers, GPS ingestion, journal/PHST components and dark-glass styling already exist. Most advanced workflows requested in the master prompt remain incomplete.

## 2. Repository, runtime and deployment
- Frameworks: Next.js 15.5.29, React 19.2.6, TypeScript 5.8.3.
- Supabase JS: 2.57.x; Capacitor Core/Android/iOS: 8.6.x.
- App package and Next.js project are under src; the application page is still a large client component in src/app/page.tsx.
- Existing PWA client and service worker registration are present.
- GSAP, ScrollTrigger and Lenis are not declared in the active src/package.json.
- Vercel project is navyhub, repository renjak/navyhub. A prior GPS safety preview is READY, but validates only that earlier code slice.
- Visible module labels and application metadata are being moved to ALNAV DMS; internal IDs remain stable.

## 3. Supabase schema and data inventory
All 16 public application tables have Row Level Security enabled.

| Table | Rows | Current purpose |
|---|---:|---|
| activity_logs | 42 | Operational journal and PHST imports |
| audit_logs | 314 | Audit trail |
| checklist_items | 32 | Checklist template items |
| checklist_responses | 0 | Checklist execution responses |
| checklist_runs | 0 | Checklist executions |
| checklists | 10 | Checklist templates |
| daily_watch_assignments | 0 | Daily watch assignments |
| daily_watch_reports | 0 | Daily handover reports |
| inventory_items | 17 | Inventory master |
| maintenance_assets | 0 | Maintenance asset register |
| maintenance_records | 0 | Maintenance reports/history |
| personnel | 39 | Personnel master |
| profiles | 3 | Authenticated user profiles |
| stock_movements | 2 | Inventory movements |
| units | 1 | Vessel/unit master |
| vessel_gps_positions | 1 | Latest vessel position |

Current active profile roles: admin, commander, viewer (one account each). The prompt's additional proposed roles must be mapped to the current policy model before any role seeding or policy change.

### Existing inventory classification
- Air Tawar: 1 item.
- Amunisi: 15 items.
- BBM: 1 item.
The existing Class V data must not be re-created, reclassified speculatively, or exposed in general-purpose dashboards.

### Existing storage
The project has a private Supabase Storage bucket named navyhub-files, marked public=false, currently with zero objects. Inspect its storage.objects policies before building Archive upload workflow; a new public bucket is not warranted.

### Existing database functions and triggers
- Stock-balance application function and insert trigger exist for stock_movements.
- Audit triggers exist for activity logs, checklist runs, maintenance records and stock movements.
- GPS ingest function exists as a privileged database function and should remain server-mediated.

## 4. Module audit
| Module | Status | Findings and next work |
|---|---|---|
| Dashboard | PARTIALLY WORKING | Reads live counters, tank balances and current position. Requires operational summary, alerts, PHST progress and strict telemetry freshness/source labels. |
| LOGBOOK | PARTIALLY WORKING | Journal, PHST DOCX/PDF import, DigitalLogbook and daily-watch archive components exist. No full execution status per activity, timestamped verification, or stable template/daily-instance separation yet. |
| STOCK | PARTIALLY WORKING | Inventory list, item edit, movement history and tank summaries exist. Class cards, richer class model and atomic capacity-plus-movement operation remain incomplete. |
| PERSONEL | SECURITY RISK / PARTIALLY WORKING | 39 personnel records. The old general query used select(*) and rendered NRP, birthplace, date of birth, TMT and education fields. Current code uses an explicit allow-list; database/API column restriction remains required. |
| MAINTENANCE | PARTIALLY WORKING | SEWACO/PLATFORM asset categories and corrective records exist; tables currently contain no assets or maintenance records. Preventive schedules, work orders, approval and stock linkage are absent. |
| ARCHIVE | NOT IMPLEMENTED AS GENERAL ARCHIVE | Current feature primarily covers daily-watch reports. Document register, metadata, classification, revision history and signed download workflow are still needed. |
| TELEMETRY | PARTIALLY WORKING | One current GPS row. Latest source string is KRI_ALAMANG_644_MASTER_GPS, while speed and course are NULL and reported accuracy is about 19 m. Source value alone does not prove a genuine onboard receiver. |
| Administration/RBAC | PARTIALLY WORKING | Current role values are admin/commander/viewer. Role model requested by the master prompt needs a permission matrix before extensions. |
| UI/UX/animation | PARTIALLY WORKING | Dark glass style and PWA foundation exist. Page state/business logic is concentrated in page.tsx; GSAP/ScrollTrigger/Lenis are not installed. |
| Performance/QA | REQUIRES TESTING | Package scripts include typecheck, build and check; fresh build and functional/security status must be measured on the updated preview. |

## 5. High-priority findings
### A — PHST history loss (CRITICAL)
The former importer selected all existing PHST-category activity_logs, inserted the new payload, then deleted the old IDs. The current code slice changes this to a non-destructive append: read existing rows, normalize legacy E. Lain-lain to F. Lain-lain, skip exact duplicates, and never bulk-delete prior PHST records. Test by uploading an identical PHST twice and then a second date; first date must remain.

### B — PHST parser missed F. Lain-lain (HIGH)
The supplied PHST document contains A. SITUASI, B. TUGAS POKOK, C. UMUM, D. KHUSUS and F. LAIN-LAIN. The previous parser reset the section at F and omitted those entries. Current code recognizes F and removes synthetic blank department activity rows.

### C — Personnel privacy (CRITICAL)
The old general list used select(*) and rendered sensitive fields. Current code selects only ID/unit/date, sequence, name, rank and position; the ordinary editor writes only those safe directory fields. This is an interim UI minimization, not complete server-side protection. Supabase documentation confirms RLS restricts rows, not columns; implement a dedicated private-details table or approved column grants and test direct API requests.

### D — Telemetry source provenance (HIGH)
A legacy row uses a custom source string and has no speed or course. The existing GPS-safety branch enforces onboard_gps only when the dedicated hardware token is used; Admin browser requests are labeled admin_device_gps. Still required: Admin start/stop watch mode, physically onboard confirmation, stale/offline handling and heading vs GPS course-over-ground distinction.

### E — STOCK model is a narrow inventory list (HIGH)
Only three free-text categories are present. Existing stock movement trigger applies balance changes, but class model, locations, expiry, lots, and atomic tank-capacity updates remain. Preserve the 17 existing rows including restricted ammunition.

### F — MAINTENANCE and ARCHIVE foundations only (HIGH)
Maintenance currently has two base tables and zero records. Archive UI reuses daily-watch reports while private storage bucket is empty. Work orders/maintenance schedules and document metadata/register/revisions remain.

## 6. PHST source inspection
The Library document PHST ALAMANG 2025 copy.docx was inspected. It contains dated entries with A. SITUASI, B. TUGAS POKOK, C. UMUM time-stamped entries, D. KHUSUS department rows OPS/SIN/EKA/LOG, and F. LAIN-LAIN. Preserve source dates/content and never invent missing activities.

## 7. Security observations
- RLS is enabled on all 16 public application tables; still verify grants and every policy through explicit allow/deny tests.
- Supabase RLS restricts rows, not sensitive columns. See https://supabase.com/docs/guides/database/postgres/column-level-security and https://supabase.com/docs/guides/database/postgres/row-level-security.
- Private Storage access relies on policies on storage.objects; time-limited signed URLs can be used for authorized downloads. See https://supabase.com/docs/guides/storage/security/access-control.
- Never expose service-role keys or GPS ingest tokens to client code.
- Proposed extra roles should not be seeded until mapped to existing account identity and command authority.

## 8. Brand asset
No asset confirmed as the official ALNAV DMS logo was located in the available Library search. Existing KRI Alamang crest art is not assumed to be the ALNAV DMS logo. Wordmark metadata and visible product labels can be updated, but final logo integration remains pending the exact official file.

## 9. Migration safety
The project reports one default Supabase branch with with_data=false; this is not a tested copy of production data. No schema migration was run in this work slice. Before DDL, create a data-bearing development database or restore a verified backup in a separate project, create reversible migrations, test against copied data, run RLS allow/deny tests, and obtain release approval.

## 10. Next phase
1. Validate current branch build and TypeScript.
2. Complete Admin master GPS start/stop and freshness handling.
3. Refactor monolithic page into feature modules without changing data contracts.
4. Implement STOCK class structure against existing real rows.
5. Implement PHST daily instances and completion/verification records.
6. Implement personnel private-detail separation at database/API level.
7. Implement preventive maintenance/work orders and private Archive metadata.
8. Add animation stack with reduced-motion and mobile fallbacks.
9. Run full preview QA and only later seek production approval.

## 11. STOCK class interface and departmental access
- The current preview branch adds expandable class cards for I, III, IV, V, VIII and IX and groups existing records without data migration. Existing 1 Air Tawar, 1 BBM and 15 Amunisi records map to Class I, III and V respectively. Other classes remain empty until actual physical inventory is entered.
- Existing non-manager item query filters the old Amunisi category as an interim frontend minimization. This is not a security boundary; a dedicated RLS policy on the database is still mandatory for Class V.
- Supabase currently supports only generic roles admin/commander/officer/operator/viewer. The profiles table has no department_code or department-head entitlement. Therefore heads of OPS/SIN/EKA/LOG cannot yet be safely scoped to edit their department. See docs/ALNAV-DMS-DEPARTMENTAL-RBAC.md for the target permission matrix and migration/test sequence.
- All active personnel should be able to read shared vessel information; writes are scoped to department-owned records and enforced server-side/RLS. Supply class and responsible department are separate dimensions.
- No department RBAC migration was applied because the only available Supabase branch is empty (with_data=false); production schema was not changed.


## 12. Latest implemented UI and preview status
- ADMINISTRATION appears only for the Admin account. It displays the live profile directory with name, rank, current role and active status, and makes the missing department assignment explicit. It does not yet create accounts or modify roles.
- All visible component labels in the Logbook, Archive and PWA manifest have been aligned with ALNAV DMS display naming; stable route/table identifiers and legacy asset filenames are preserved for compatibility.
- Vercel preview for commit `265599cbfdd1d19d2d3257298165419869978243` is READY. The build log shows successful Next.js compile, type validity, static generation and deployment completion. The preview is not production and no authenticated UI/E2E/RLS workflow validation has yet been completed.


## 13. Department foundation — applied 25 November 2026
- Additive production migration applied successfully: departments master data, profile department/head/Class V entitlements, department_code columns, inventory supply_class, helper functions, and Class V restrictive read policies.
- Seeded OPS/SIN/EKA/LOG for the active ship unit. Inventory classification verified: Class I / LOG = 1, Class III / LOG = 1, Class V / SIN = 15.
- Class V row reads are now blocked at the database RLS layer for accounts without command/admin role or explicit can_access_class_v entitlement. The same restriction is applied to stock movement reads linked to Class V items.
- Deployed Supabase Edge Function `admin-invite-user` (JWT required). It verifies an active Admin profile server-side, sends Auth email invitations, assigns unit/role/department/head/Class V fields, and records an audit event. It does not permit creating Admin or Commander accounts.
- Admin UI now supports department assignment, head designation, explicit Class V entitlement and email invitation. Profile assignment uses the existing Admin-only profile update policy.
- Important remaining work: write-side RLS for activity logs, stock transactions, maintenance, checklists, daily reports and personnel must be implemented and tested before department heads can edit their own module data. Legacy record ownership stays NULL until confirmed; no guessed department mapping.


## 10. Supplemental verification — 25 November 2026
### Active source and release
- GitHub repository is private `renjak/navyhub`; repository default branch is `main`. The project README records `feat/navyhub-operational-modules` as the production baseline and `alnav-dms/phase-1-gps-safety` as the implementation branch. Do not equate the GitHub default branch with the Vercel production branch.
- The Next.js app root is `src/`; `src/package.json` declares Next.js 15.5.29, React 19.2.6, TypeScript 5.8.3, Supabase JS 2.57.x and Capacitor 8.6.x. No `src/package-lock.json` was found.
- Vercel project `navyhub` is linked to this repository, custom domain `navyhub.app` exists, and SSO protection is enabled for non-custom deployment URLs.
- Preview commit `c4751bd8c4bcb33a5801344fa7d13ce0310ba405` reached `READY` at `https://navyhub-kj5lwhs5j-644warship-2118.vercel.app`. This is a successful preview build/deployment, not full authenticated QA.

### PHST source and workflow
- The inspected source is the 10-page uploaded `PHST ALAMANG 2025 copy.docx`. Its extracted pages contain dated PHST records for 23 November 2026, 1–3 September 2026, 28 August 2026 and 8–9 August 2026, plus page-separated D. KHUSUS/F. Lain-lain content. Some page-separated department entries do not repeat a date; do not assign those entries to a date without source evidence.
- Existing parser handles A. SITUASI, B. TUGAS POKOK, C. UMUM, D. KHUSUS and F. LAIN-LAIN. The importer appends unseen entries and skips exact duplicates.
- Checklist tables exist with 10 templates and 32 items, but the current database snapshot has zero checklist runs and zero responses. The current DigitalLogbook execution flow is limited to Perwira Jaga. Its animated ship tour is explicitly a visual demo, not PHST evidence or an operational completion record.

### Security and database findings
- All 16 public application tables have RLS enabled. The separate `private.vessel_gps_ingest_config` table is reported by the Supabase security advisor with RLS disabled. Do not simply enable RLS without policies: first verify schema exposure and design/test service-only grants and server access.
- Supabase Auth leaked-password protection is disabled (security WARN).
- Personnel table contains sensitive fields including birthplace, birth date and NRP. The frontend general directory uses an allow-list, but RLS alone does not protect columns. Direct API/column-level access still needs a security boundary and role tests.
- Performance advisor flags a missing covering index on `inventory_items_department_fk`, multiple permissive SELECT policies on `departments`, and unused indexes. Investigate plans before index changes; do not delete indexes solely because they are currently unused.
- Current stock data remains 17 records (Air Tawar 1, BBM 1, Amunisi 15); stock movement history has 2 rows. Do not seed or fabricate other classes.
- Maintenance assets and records, daily watch assignments/reports, checklist runs/responses have zero rows in the last recorded snapshot. This is absence of data, not permission to create sample operational records.

### Updated status classifications
| Feature | Status | Root cause / next implementation |
|---|---|---|
| Dashboard | PARTIALLY WORKING | Existing counts, consumables, GPS/map/weather and navigation panel; readiness aggregation and complete LIVE/DELAYED/STALE/OFFLINE states remain. |
| Heading | NOT IMPLEMENTED FROM SENSOR | Database exposes COG only; no heading/gyro/AHRS column or confirmed onboard source. |
| STOCK | PARTIALLY WORKING | Class cards and existing inventory transactions; requested full attributes and transaction types (return/transfer/disposal/reversal) remain. |
| PHST execution | PARTIALLY WORKING | PHST import and generic checklist tables exist; dated PHST execution/verification lifecycle is not yet linked. |
| PERSONEL privacy | SECURITY RISK | Frontend allow-list is not sufficient column security; sensitive detail isolation and direct API tests required. |
| MAINTENANCE | PARTIALLY WORKING | Corrective reports/basic assets only; preventive schedules, work orders and stock linkage remain. |
| ARCHIVE | NOT IMPLEMENTED AS FULL ARCHIVE | Existing daily-watch archive and private bucket; document register/versioning/access history remain. |
| Departmental RBAC | PARTIALLY WORKING | Admin identity and Class V access foundation; full department-specific write policies remain. |
| GSAP/ScrollTrigger/Lenis | NOT IMPLEMENTED | Dependencies are absent from `src/package.json`; motion layer and reduced-motion support remain. |
| End-to-end QA | NOT VERIFIED | Vercel preview is READY, but authenticated E2E, RLS matrix, responsive and operational regression tests have not been evidenced. |
