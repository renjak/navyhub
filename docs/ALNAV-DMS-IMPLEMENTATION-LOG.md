# ALNAV DMS — Implementation Log
## 25 November 2026

### Audit
- Confirmed active repository, production baseline branch and Vercel project.
- Inspected Supabase schema, 20 migrations, public RLS status, row counts, profile roles, stock categories, triggers, functions and private Storage bucket.
- Inspected PHST ALAMANG 2025 copy.docx and confirmed A/B/C/D/F structure with OPS/SIN/EKA/LOG table.

### Code changes in current implementation branch
- Changed visible application wordmark metadata/PWA labels and user-facing module labels to ALNAV DMS, DASHBOARD, LOGBOOK, STOCK, PERSONEL, MAINTENANCE and ARCHIVE.
- Kept internal module IDs and database table names unchanged for compatibility.
- Corrected PHST parsing to recognize F. Lain-lain and normalize old E category for compatibility.
- Changed PHST importer to append unseen records only, preserve all historical rows, and skip exact duplicates.
- Removed automatically generated blank department task entries.
- Restricted the general PERSONEL list to an explicit allow-list and changed its ordinary editor so it does not overwrite private fields.
- Updated audit and implementation documentation.

### Not complete
- Official ALNAV DMS logo asset has not been identified.
- Database-level personnel column privacy is still pending; UI allow-list is not complete server-side security.
- Full stock classes, PHST completion/verification lifecycle, preventive maintenance, general Archive and admin continuous GPS mode remain.
- GSAP/ScrollTrigger/Lenis not integrated.
- TypeScript/build and functional/security tests for this code slice are not yet confirmed.

### Release safety
- All changes are on an isolated preview branch.
- No production deployment, production data mutation or Supabase schema migration occurred.

### 25 November 2026 — STOCK and access-control direction
- Implemented a six-card expandable STOCK interface: Class I, III, IV, V, VIII, IX. Cards show only inventory items already present in Supabase; empty classes are explicitly empty, not seeded with mock data.
- Mapped existing Air Tawar to Class I, BBM to Class III, and Amunisi to Class V without changing database rows or categories.
- Existing non-manager STOCK query excludes the legacy Amunisi category as an interim UI/API query minimization. Direct RLS protection for Class V still must be implemented and tested before production readiness.
- Confirmed current role enum is admin/commander/officer/operator/viewer and profiles has no department field. Recorded the OPS/SIN/EKA/LOG department RBAC model, data ownership requirements, and RLS test plan in docs/ALNAV-DMS-DEPARTMENTAL-RBAC.md.
- Updated DigitalLogbook, Archive, PWA manifest and offline message to ALNAV DMS / current display labels.
- Stock class preview build passed Next.js compilation, lint/type validity and static page generation (Vercel preview READY for commit a1f3f97). Later branding string changes triggered another preview build; verify its newest result separately.
- No Supabase schema migration, live data writes, production merge or production deployment in this slice.


### 25 November 2026 — Administration workspace and preview validation
- Added an Admin-only ADMINISTRATION navigation item and actual profile directory read from Supabase. Current account names, ranks, roles and active state are displayed; department assignment is explicitly marked pending because the profile schema has no department_code/head designation yet.
- Added department access overview for OPS/SIN/EKA/LOG without granting any unverified access.
- Stabilized role-aware navigation filtering with useMemo.
- Latest Vercel Preview deployment: READY, commit `265599cbfdd1d19d2d3257298165419869978243`, branch `alnav-dms/phase-1-gps-safety`.
- Build evidence: Next.js compile succeeded; type validity passed; static pages generated; deployment completed; npm audit reported zero vulnerabilities. This confirms build health only, not E2E behavior, logged-in role checks, direct database RLS tests or mobile QA.


### 25 November 2026 — Department schema, Class V RLS and Admin account provisioning
- Applied additive Supabase migration `departmental_identity_and_supply_classification` to the active project after a transaction-wrapped syntax test. Existing records were preserved.
- Seeded OPS/SIN/EKA/LOG departments for the active unit and added department ownership columns to core operational tables.
- Added profile entitlements `department_code`, `is_department_head`, `can_access_class_v` and supply class classification on inventory items.
- Verified inventory classification: 1 Class I/LOG, 1 Class III/LOG, 15 Class V/SIN.
- Added restrictive RLS for Class V inventory and linked stock-movement reads. Admin and Commander have command-level visibility; other users require explicit profile entitlement.
- Deployed JWT-protected Supabase Edge Function `admin-invite-user`; server verifies active Admin profile, sends invite email, assigns profile scope, and writes audit log.
- Added Admin UI to assign department/head/Class V entitlement and invite new personnel by email.
- Security advisor still flags leaked-password protection disabled; enable in Supabase Auth security settings.
- Department write-side RLS matrix remains outstanding; do not merge to production until the module-specific policies and cross-department deny tests pass.


## Supplemental implementation checkpoint — 25 November 2026
### Verified
- Preview commit `c4751bd8c4bcb33a5801344fa7d13ce0310ba405` is Vercel `READY` (preview only): https://navyhub-kj5lwhs5j-644warship-2118.vercel.app
- The latest dashboard telemetry panel separates COG from ship heading. The GPS schema has no heading field; no heading value is fabricated.
- PHST source was reopened and inspected from the uploaded 10-page `PHST ALAMANG 2025 copy.docx`. The source is dated and includes A/B/C/D/F sections; page-separated, undated content is not auto-assigned to a day.
- Supabase currently has 20 migrations; 16 public tables have RLS enabled.

### Security blockers — not auto-remediated
- Supabase advisor flags `private.vessel_gps_ingest_config` with RLS disabled. A safe server-only policy/grant design must be reviewed before changing it.
- Supabase Auth leaked-password protection is disabled.
- Personnel sensitive columns remain present in the same table; frontend allow-list is not column-level enforcement.
- Department-specific write-side RLS matrix is incomplete.

### Next actions
1. Review schema exposure/grants and implement tested personnel column privacy.
2. Design safe access for the private GPS ingest configuration and admin-controlled source registry.
3. Link dated PHST schedule instances to execution responses and approval records.
4. Expand stock attributes and transaction types using additive/reversible migrations.
5. Add preventive maintenance/work orders and a private document archive lifecycle.
6. Add the GSAP/ScrollTrigger/Lenis foundation with reduced-motion handling.
7. Execute TypeScript/build, role-based RLS, authenticated E2E and tablet/mobile regression checks.

Production remains unchanged. A preview marked READY is not a production release.


### Additional source reconciliation
- Read the current 10 active checklist templates and all 32 checklist items directly from Supabase.
- The current templates contain DIKO/scenario-based machinery, radar, bilge, logistics and watch tasks. They are not a faithful date-by-date transcription of the uploaded PHST document. Do not relabel them as PHST or automatically mark them as PHST activities.
- The source PHST has dated daily events and variable D. KHUSUS department activities; some page-separated entries lack a repeated date. A proper PHST schedule/execution data model is required before linking these records.
- Added GSAP 3.13.x and Lenis 1.1.x dependencies, a root MotionProvider with ScrollTrigger synchronization, word-by-word heading reveal for marked headings, cleanup and reduced-motion opt-out.
- Vercel preview for commit `902e2330c5316dc69c892d055f85285c20bed4f1` reached READY. Build logs show successful compilation, type checking, static page generation and optimized build. This does not replace interactive/RLS/E2E QA.

## 2026-11-26 — Department correction and Class V ownership (owner-approved)
- Owner confirmed SIN = Mesin (engineering). UI shows department codes as DEPOPS/DEPSIN/DEPEKA/DEPLOG; stored codes unchanged.
- Owner decided OPS (DEPOPS) holds Class V. With explicit owner approval ("terapkan migrasi dan deploy fungsi"):
  - Applied migration 20261126061018_rename_sin_department_to_mesin: departments SIN name Senjata → Mesin.
  - Applied migration 20261126061025_class_v_owned_by_ops: 15 Class V inventory rows department SIN → OPS (stock total 9,030 unchanged; 2 stock movements unchanged; RLS unchanged).
  - Deployed admin-invite-user v2 (verify_jwt true): Class V access may only be granted to OPS accounts. Only that line changed versus v1.
- Verified by read-only queries after apply. No profiles had a department or Class V access at the time, so no account was affected.

- 2026-11-26: `admin-invite-user` v3 deployed (no-department invites allowed; AAL2 required for Admins with verified MFA). Migrations applied: protect_personnel_pii_and_class_v_movements, personnel_directory_include_nrp, require_mfa_when_enrolled.

## 2026-11-26 — Logbook: Jaga Darat / Jaga Laut (owner direction)
- Logbook opens on **Jaga Darat** (default) with a three-way switch: Jaga Darat · Jaga Laut · Arsip. The previous five tabs (summary, Jaga, PHST, Agenda, Jejak) are no longer shown.
- **Jaga Darat** flow: Komandan/Admin upload the PHST (PDF/Word) → reviewed preview (date, Perwira/Bintara Jaga, Caraka, posisi sandar, number of Section C items) → "Simpan PHST" (non-destructive, duplicate-aware, as before). View: crew + A (posisi kapal, kesiagaan), B (tugas pokok) and D (khusus, collapsible) summarised at the top; Section C as the Perwira Jaga daily checklist (items already due but unchecked are marked); F (Lain-lain) at the bottom. Viewer: read-only.
- Import now also stores A·Posisi → `phst_daily_orders.situation`, A·Tingkat kesiagaan → `readiness_level`, B → `main_task` (only when present in the document). Parser fix: the signature block ("a.n. Komandan … Palaksa") no longer becomes a Section F item. Verified against `PHST_ALAMANG_2025.docx` (13 Section C items, 4 F items).
- **Jaga Laut**: current watch from WIB clock — Divisi A = PH-MH (08–12, 20–24), B = SH-LM (12–16, 00–04), C = SH-DH (16–20, 04–08), assumed in the order the owner listed them; 24-hour board; ship position/SOG/COG with source label, heading "—" (no gyro). Voyage replay & drill (3D) moved here as a collapsible section.
- 3D loading mark stays at least 1.5 s on the INITIALIZING screen.
