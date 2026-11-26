# ALNAV DMS — Complete Claude Handover
Snapshot: **25 November 2026 (Asia/Jakarta)**
Prepared from repository and connected service inspection. This is a handover snapshot, not a guarantee that every item remains unchanged.

## 1. Mission and identity
**ALNAV DMS — ALAMANG NAVAL DATA MANAGEMENT SYSTEM** is the existing Navyhub application being adapted for **KRI ALAMANG-644**. Continue the existing product and codebase. Do not rebuild from scratch.

The user expects a premium naval command interface, operationally reliable modules, correct role permissions, real data provenance, and preservation of historical records. Work directly in GitHub/Next.js/Supabase/Vercel. Base44 was explicitly cancelled.

## 2. Repository and Git state
- Repository: `renjak/navyhub` (private).
- Active development branch inspected: `alnav-dms/phase-1-gps-safety`.
- Branch HEAD at snapshot: `5b0113287c7d2cbc4d9ac7d1dabf3ec712b7e0c8`.
- Latest commit message: `feat(alnav): surface official brand and fit responsive layouts`.
- Production baseline documented in README: branch `feat/navyhub-operational-modules`, commit `49d69aa741181caa22f627be9ed4d5c966d36009`. Do not assume GitHub default branch is production.
- Do not merge divergent branches blindly. Compare file-by-file.
- Active Next.js project root: `src/`, not repository root.
- Package scripts: `dev`, `build`, `start`, `typecheck`, `check`, Capacitor sync/open/generate.
- Runtime versions from package/docs: Next.js 15.5.29, React 19.2.6, TypeScript ^5.8.3, Supabase JS ^2.57.0, Capacitor ^8.6.2; Node engine >=22.
- Root repository contains docs, Supabase migrations/functions, public assets, and the app under src.

## 3. Latest Preview / release status
- Vercel project: `navyhub`.
- Project ID: `prj_NBiDqtZgs8i364HalRHQr8HdCLP2`.
- Team ID: `team_5PxIBONkFWqNSN1n6HiyWJQF`.
- Latest deployment inspected for the active branch:
  - Deployment ID: `dpl_GhSNXkKGLdAXuXHfF1SAmq3xocD9`
  - State: **READY**
  - Commit: `5b0113287c7d2cbc4d9ac7d1dabf3ec712b7e0c8`
  - Preview URL: https://navyhub-kv4xkonae-644warship-2118.vercel.app
- Previous preview at commit `998af312429178940f7ee6e07a4ae6b71fd556e5` also showed READY.
- Production domain: `navyhub.app`. No production change was made as part of this handover.
- READY means Vercel deployment/build completed. It does **not** prove authenticated end-to-end flows, role-based access, direct RLS allow/deny tests, GPS hardware integration, or mobile visual QA.
- Never promote/alias/merge to production without explicit user approval.

## 4. Official brand assets
- Exact user-provided ALNAV DMS wordmark is committed at `public/branding/alnav-dms-logo.jpg`.
- Blob SHA: `bfe7ce374c1d8f36895fef013865a62e4eb865eb`.
- KRI Alamang emblem is a separate asset: `public/alamang-emblem.jpg`.
- The application source at the inspected HEAD references the ALNAV logo in login (2 matches), sidebar, Welcome Aboard and loading UI (5 total references).
- `src/app/layout.tsx` still references `/navyhub-icon.svg` for the browser icon and the KRI emblem as Apple icon. Review favicon/app icon requirements separately; do not replace or distort the official source image.
- Verify actual browser rendering and responsive appearance; code references alone do not prove visual QA.

## 5. Application structure and key files
- `src/app/page.tsx`: main app shell, authentication/profile gates, navigation, dashboard and much module logic; large client component.
- `src/app/VesselStatus.tsx`: navigation telemetry, COG, gyro demo, GPS map, Admin Master GPS and simulation.
- `src/app/PHSTLogbook.tsx`: dated PHST order and Section C checklist.
- `src/app/PHSTManager.tsx`: PHST import/management.
- `src/app/DigitalLogbook.tsx`: digital logbook.
- `src/app/DailyWatchArchive.tsx`: daily watch archive.
- `src/app/api/gps/route.ts`: GPS ingestion API.
- `src/app/globals.css`: app styles and responsive design.
- `src/app/layout.tsx`: metadata, icons, viewport and providers.
- `src/app/MotionProvider.tsx`: motion provider; respect reduced motion.
- `src/app/PWAClient.tsx`, `src/app/manifest.ts`, `public/sw.js`: PWA.
- `supabase/migrations/`: database migration history.
- `supabase/functions/admin-invite-user/index.ts`: Admin-protected account invitation Edge Function.
- `docs/ALNAV-DMS-AUDIT.md`: prior detailed audit.
- `docs/ALNAV-DMS-IMPLEMENTATION-LOG.md`: implementation history.
- `docs/ALNAV-DMS-DEPARTMENTAL-RBAC.md`: target department access design.

## 6. Current visual/UI direction and recent work
User's reference direction:
- Midnight navy / dark blue-black base.
- Translucent blue-grey glass panels, subtle silver borders, controlled red accents.
- Elegant, readable typography; no generic SaaS or gaming appearance.
- KRI ALAMANG-644 is central vessel identity. Use only verified vessel assets; don't imply a generic ship model is the actual ship.
- Fit-to-content: no crushed cards, clipping, excessive fixed heights or horizontal overflow. Cards should wrap naturally; test desktop, iPad landscape/portrait and mobile.
- User asked to remove three Vessel Navigation cards: GPS Fix Quality, Position Accuracy and Telemetry Source. At current inspected source those three headings are absent from `VesselStatus.tsx`.
- COG card was reduced to a compact card while keeping gyro heading separate.
- Welcome Aboard empty marked area was removed/cleaned; official ALNAV wordmark is now added to the Welcome identity area.
- Latest styling/brand changes are in commit `5b011328...`. Check the preview visually; don't infer visual success from code alone.

## 7. GPS, COG and gyro semantics
- GPS API uses `src/app/api/gps/route.ts`.
- Hardware submissions authenticate using server-side `VESSEL_GPS_INGEST_TOKEN` and are labeled `onboard_gps`.
- Authenticated active Admin submissions are labeled `admin_device_gps`; they represent the Admin device location as a proxy, not independent shipboard GPS.
- The API validates latitude/longitude, speed, COG, satellites and timestamp, then calls `ingest_vessel_gps` through a server-only service-role client.
- Never expose service role or ingest token to browser code.
- Existing device Master GPS tracking requests browser geolocation and sends updates every 30 seconds while the page remains open. iOS background/screen lock can delay updates.
- COG is direction of movement over ground. Heading is vessel bow orientation. Do not equate them.
- Existing GPS table previously had latitude, longitude, speed_knots, course_degrees, satellites, fix_quality, source, received_at, position_at and accuracy_m; no verified heading_degrees field. Reinspect current schema before modifying.
- Simulation is a synthetic front-end demo and must be clearly labeled. It must not be written to production GPS stream or represented as hardware spoofing.

## 8. PHST / Logbook rules and current status
- PHST uploaded source document: `PHST ALAMANG 2025 copy.docx` (was inspected in the prior audit).
- Source sections: A. SITUASI, B. TUGAS POKOK, C. UMUM, D. KHUSUS, F. LAIN-LAIN.
- Section C is the daily Perwira Jaga checklist source. Other sections remain separate.
- Preserve date-specific source blocks and original wording, duty officer, NRP only where sourced, division, NCO, messenger, tenue, situation, readiness, main task, times and activities.
- Do not assign undated continuation pages to a date. Do not invent missing names/activities.
- Importer was changed to append unseen records and skip exact duplicates rather than delete old PHST rows. Preserve this behavior.
- Parser recognizes F. Lain-lain and normalizes legacy E category for compatibility.
- New PHST tables observed in schema: `phst_daily_orders`, `phst_checklist_items`; also existing `phst_templates`, `phst_schedule_items`, `phst_execution_records`, `phst_verifications`.
- UI in `PHSTLogbook.tsx` loads by date and displays duty metadata and Section C checklist statuses. Verify importer per-date grouping and lifecycle linkage; prior audit said complete activity execution/verification lifecycle remains incomplete.

## 9. Supabase project and verified schema snapshot
- Project ID: `unrczmuesfcelqeesrnp`.
- Current public tables returned by read-only inspection: 23. RLS is enabled on all 23:
  1. activity_logs
  2. audit_logs
  3. checklist_items
  4. checklist_responses
  5. checklist_runs
  6. checklists
  7. daily_watch_assignments
  8. daily_watch_reports
  9. departments
  10. inventory_items
  11. maintenance_assets
  12. maintenance_records
  13. personnel
  14. phst_checklist_items
  15. phst_daily_orders
  16. phst_execution_records
  17. phst_schedule_items
  18. phst_templates
  19. phst_verifications
  20. profiles
  21. stock_movements
  22. units
  23. vessel_gps_positions
- Schema migration count observed: 23.
- RLS enabled is not proof policies are correct. Test grants, policies, RPCs and direct REST access for each sensitive module.
- Historical baseline row counts in the older audit (before PHST and departments additions) were: activity_logs 42, audit_logs 314, checklist_items 32, checklist_responses 0, checklist_runs 0, checklists 10, daily_watch_assignments 0, daily_watch_reports 0, inventory_items 17, maintenance_assets 0, maintenance_records 0, personnel 39, profiles 3, stock_movements 2, units 1, vessel_gps_positions 1. These are historical baseline counts, not freshly re-counted current totals.
- Prior audit noted private Storage bucket `navyhub-files`, public=false, then 0 objects. Inspect current state/policies before relying on this.
- Prior audit noted leaked-password protection disabled in Supabase Auth; verify current setting and resolve through approved security settings, not by weakening auth.
- Prior security finding: `private.vessel_gps_ingest_config` RLS disabled (server-only private schema context); review grants/access design before changing.
- Personnel sensitive columns remain a privacy concern: UI allow-list is interim; RLS is row-level and does not automatically hide sensitive columns.
- Department write-side RLS matrix remained incomplete in the last implementation note. Class V read restrictions were introduced; re-test exact policy behavior.

## 10. Departments, roles and stock
- Department codes: OPS (Operasi), SIN (Mesin / engineering — corrected by the owner on 26 Nov 2026; the earlier "Senjata" label was wrong), EKA (Elektronika), LOG (Logistik).
- Supply classes: I, III, IV, V, VIII, IX.
- Existing inventory classification from the migration: Air Tawar → Class I / LOG; BBM → Class III / LOG; Amunisi → Class V / OPS (owner decision 26 Nov 2026; previously SIN, moved by migration 20261126061025). Class V authorisation is for OPS accounts only. Department codes are displayed as DEPOPS/DEPSIN/DEPEKA/DEPLOG. No other stock should be fabricated.
- Class V visibility is intended for Admin/Commander or explicitly entitled users. Verify the actual policy, including linked stock movements.
- Department ownership and supply class are distinct fields.
- Proposed department read/write/approval matrix is in `docs/ALNAV-DMS-DEPARTMENTAL-RBAC.md`; not all write policies are complete.
- Existing role names must be confirmed against current enum/profile data before adding roles or changing permission logic.

## 11. Current modules and gaps (from prior code audit)
| Module | State at handover | Main remaining work |
|---|---|---|
| Dashboard | Partial | Operational readiness aggregation, alerts, PHST progress, freshness/source clarity |
| LOGBOOK/PHST | Partial | Full dated execution, verification, approval lifecycle; verify multi-date parser |
| STOCK | Partial | Full class metadata, lots/locations/expiry, robust transaction and capacity integrity |
| PERSONEL | Partial / sensitive | Database-level privacy/column access restrictions and direct API tests |
| MAINTENANCE | Basic foundation | Asset population, preventive schedules, work orders, approvals, stock linkage |
| ARCHIVE | Daily-watch archive only | General document register, metadata/classification, revisions, private downloads |
| TELEMETRY | Partial | Master GPS operating workflow, freshness/stale/offline states, actual gyro/AHRS integration |
| ADMIN/RBAC | Partial | Department-scoped write RLS and complete allow/deny test matrix |
| UI/QA | Partial | Verify exact brand display, responsive fit, accessibility, functional regression |

## 12. Known technical and security boundaries
- `src/app/page.tsx` is a large client component. Refactor incrementally and protect current routes/permissions.
- No Base44.
- No production DB reset, no destructive migration, no test data seeded into production.
- Do not put secrets in handover or Claude context. Environment variable names may be documented; values must remain private.
- Vercel preview build READY is not the same as functional/security acceptance.
- Run TypeScript and production build from `src/`; use current lockfile/package manager as discovered, do not guess.

## 13. Recommended first actions in Claude Code
1. Read `CLAUDE.md`, this handover and all three existing ALNAV docs.
2. Run `git status --short --branch`; verify HEAD is `5b011328...` or later.
3. Inspect root tree and `src/package.json`; determine package manager/lockfile actually present.
4. Run non-mutating local checks: install only if needed, `npm run typecheck`, `npm run build`.
5. Open current preview and visually inspect logo on login/sidebar/Welcome/loading, Navigation compact COG, removal of three marked cards, fit-to-content and iPad/mobile layouts.
6. Audit actual branch files and Supabase schema/policies before planning the next change.
7. Create a new feature branch; don't commit directly to production branch.
8. Report a proposed plan and risk before migrations or live data changes.

## 14. Claude initial instruction
You are continuing an existing live operational application. Start by auditing the current repository and comparing it to this handover. Do not immediately rewrite code. First report: (a) confirmed current branch/commit, (b) package manager and available scripts, (c) latest preview state, (d) exact implementation status of logo, dashboard, GPS/COG/gyro, PHST, stock, personnel privacy, maintenance, archive and RBAC, (e) build/test results, and (f) prioritized next steps. Preserve all data and production boundaries.

- 2026-11-26: `admin-invite-user` v3 deployed (no-department invites allowed; AAL2 required for Admins with verified MFA). Migrations applied: protect_personnel_pii_and_class_v_movements, personnel_directory_include_nrp, require_mfa_when_enrolled.
