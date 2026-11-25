# CLAUDE.md — ALNAV DMS Working Agreement

## Project identity
- Product: **ALNAV DMS — ALAMANG NAVAL DATA MANAGEMENT SYSTEM**
- Vessel: **KRI ALAMANG-644**
- Former repository/product name: NAVYHUB. Keep repository and internal identifiers stable unless a separately approved migration requires a change.
- Stack: Next.js App Router, React, TypeScript, Supabase, Vercel, Capacitor.
- Active source directory: `src/` (Next.js app and package.json live here).
- Repository: `renjak/navyhub`.

## Mandatory starting procedure
1. Read this file, `README.md`, `docs/ALNAV-DMS-AUDIT.md`, `docs/ALNAV-DMS-IMPLEMENTATION-LOG.md`, `docs/ALNAV-DMS-DEPARTMENTAL-RBAC.md`, and `docs/CLAUDE-HANDOVER.md`.
2. Run `git status --short --branch`; do not overwrite uncommitted user work.
3. Confirm current branch and HEAD. The active development branch at handover is `alnav-dms/phase-1-gps-safety`. Production baseline is separately documented in README. Do not assume GitHub default branch is production.
4. Inspect relevant source, schema and migrations before changing anything. Treat the code and live database as source of truth; docs are snapshots and may become stale.
5. Work on a new task branch from the active development branch unless the user explicitly directs otherwise. Do not commit to production branch.

## Non-negotiable safety rules
- **Never deploy, promote, alias, merge into production, or change `navyhub.app` without explicit user approval.**
- **Never delete, truncate, bulk-replace, or reset production data.** Preserve historical PHST, logbook, audit, personnel, stock and GPS records.
- Do not run destructive SQL. Prefer additive, reversible migrations. Before any schema change: inspect dependencies, policies, triggers, grants, functions, and existing data; explain impact; obtain approval for any destructive or high-risk operation.
- Do not disable or weaken Supabase RLS. Test both allowed and denied access paths.
- Never expose `service_role`, database passwords, GPS ingest tokens, auth secrets, or private environment values in client code, logs, commits, prompts, or documentation.
- Do not copy secrets into Claude. Use secure environment-variable configuration in the appropriate provider.
- Do not fabricate operational, personnel, stock, GPS, gyro, maintenance, or readiness data. Missing values display `—` and cards remain visible where required.
- Distinguish real telemetry, Admin-device proxy position, and demo simulation. Demo simulation must never be persisted as real GPS telemetry.
- GPS Course Over Ground (COG) is not vessel heading. Actual heading requires a real gyro/AHRS source. Never infer heading from COG.
- Admin is the Master GPS administrator; do not downgrade Admin to Viewer. Respect current role checks and server-side authorization.
- Preserve the official ALNAV DMS logo at `public/branding/alnav-dms-logo.jpg`. Use the exact asset with `object-fit: contain`; do not redraw, crop, replace, recolor, or substitute the KRI crest for the ALNAV wordmark.
- User cancelled Base44. Do not introduce Base44. Keep the existing GitHub + Next.js + Supabase + Vercel architecture.
- Do not create Supabase branches without approval; they incur cost.

## Product and design direction
- Premium naval command interface, dark midnight navy, restrained red accents, silver/blue-grey glass surfaces, readable typography and clean technical hierarchy.
- KRI ALAMANG-644 is the vessel identity. Use verified vessel imagery/assets only; do not represent a generic ship as the actual vessel.
- Fit-to-content layouts: cards should size to their content, wrap safely, avoid clipped labels, compressed text, forced equal heights and horizontal overflow.
- Responsive targets: desktop, laptop, iPad landscape/portrait, mobile.
- Keep reduced-motion accessibility. Avoid decorative motion that harms readability or performance.
- Main dashboard visual priority: vessel identity/visualization with balanced telemetry and status cards. No fake ACTIVE/ONLINE states.
- Official logo is a mandatory brand asset. Existing integration locations include login, sidebar, Welcome Aboard and loading; verify actual rendering on each target viewport. The current metadata icon may still reference the older `navyhub-icon.svg`; review favicon/application icons separately without changing the original logo.

## Architecture and important files
- `src/app/page.tsx`: primary authenticated application shell/dashboard and many module integrations; currently large client component. Refactor incrementally, not as a rewrite.
- `src/app/VesselStatus.tsx`: GPS, COG, gyro-demo, Admin Master GPS and navigation UI.
- `src/app/PHSTLogbook.tsx`: date-based PHST daily order and Section C checklist view.
- `src/app/PHSTManager.tsx`, `src/app/DigitalLogbook.tsx`, `src/app/DailyWatchArchive.tsx`: PHST/import, logbook and daily-watch archive foundations.
- `src/app/api/gps/route.ts`: server-side GPS ingestion boundary.
- `src/app/globals.css`: shared visual system and responsive rules.
- `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/PWAClient.tsx`: metadata/PWA.
- `supabase/migrations/`: additive schema/policy history. Review all relevant migrations before touching live DB.
- `supabase/functions/admin-invite-user/index.ts`: Admin-controlled account invitation.
- `public/branding/alnav-dms-logo.jpg`: official ALNAV DMS logo.
- `public/alamang-emblem.jpg`: KRI emblem, distinct from ALNAV DMS logo.

## Roles, departments and security
- Existing role values observed in project history: `admin`, `commander`, `officer`, `operator`, `viewer`. Confirm current enum and profile records before relying on the list.
- Department codes: `OPS`, `SIN`, `EKA`, `LOG`.
- Supply classes: `I`, `III`, `IV`, `V`, `VIII`, `IX`.
- Department ownership and supply class are separate concepts.
- Current Class V visibility is restricted by RLS to Admin/Commander or explicitly entitled profiles; verify current policies before any changes.
- Department-specific **write-side** RLS matrix was still incomplete at handover. Do not claim department-head write access is complete unless policies and direct allow/deny tests prove it.
- Personnel UI allow-list is not equivalent to column-level database protection. Sensitive fields (NRP, birthplace/date of birth and other private data) require server/database-level restrictions and direct API tests.
- Inspect private Storage bucket `navyhub-files` and `storage.objects` policies before implementing document access. Do not make it public.

## Telemetry rules
- Existing API accepts onboard hardware token and authenticated active Admin device fixes. Hardware source is `onboard_gps`; Admin browser location is `admin_device_gps` and is a device-position proxy, not independent shipboard hardware GPS.
- Never expose the hardware ingest token to browser code.
- Existing GPS schema has position, speed, COG, satellite/fix/source/time/accuracy fields; no verified heading field was present in the earlier audit. Inspect current schema before changes.
- Admin device tracking runs only while page/browser remains active; mobile background/screen lock may interrupt updates.
- Simulation is demonstration-only, visibly labeled, and isolated from production GPS writes.

## PHST and logbook rules
- Uploaded PHST is the source of truth. Preserve source date, duty officer, division, NCO, messenger, tenue, situation, task, sections, times and activity wording.
- Sections A (Situasi), B (Tugas Pokok), C (Umum), D (Khusus), F (Lain-lain) must remain distinct. Section C is the Perwira Jaga checklist source.
- Do not invent missing dates, names, watch assignments, times or activities. Undated continuation pages remain undated until source evidence exists.
- PHST import must be non-destructive, duplicate-aware, and preserve historical rows. Never bulk-delete previous imports.
- Distinguish source/template records from dated daily orders and execution/verification records.

## Commands and verification
Run from `src/`:
- `npm install` only when dependencies changed or lockfile/install state requires it.
- `npm run typecheck`
- `npm run build`
- `npm run check` (typecheck + build)

Also perform relevant functional tests, direct Supabase RLS allow/deny tests, responsive checks (especially iPad), and regression checks for GPS/PHST/role access. A successful build is not proof of end-to-end correctness.

## Change and release workflow
1. State the exact files/schema/API being changed and why.
2. Keep changes scoped; avoid unrelated rewrites.
3. Add/update tests and docs with the change.
4. Review diff for secrets, fabricated values, accidental deletions and security regressions.
5. Run typecheck/build and relevant functional/security checks.
6. Commit to the development/task branch with a descriptive message.
7. Verify the resulting Vercel **Preview** deployment and its build logs.
8. Report what is verified and what is not. Do not call Preview "production".
9. Ask before production merge/deploy, domain alias, destructive migration, or live-data mutation.

## Handover status warning
The companion `docs/CLAUDE-HANDOVER.md` records a point-in-time snapshot. Re-check branch HEAD, Vercel status, Supabase schema/policies and code before each new task. Never treat a historical audit as live proof.
