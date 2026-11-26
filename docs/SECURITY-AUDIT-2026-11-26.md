# ALNAV DMS — Security & Capability Audit (2026-11-26)

Scope: live Supabase project `navyhub` (ap-southeast-1, Postgres 17), Vercel project `navyhub`,
repository branch `alnav-dms/ui-polish` (3e27118). Method: Supabase advisors, policy/grant/function
inspection, role-impersonation tests inside transactions that were always rolled back (no data
changed), code review, `npm audit` on production dependencies, Vercel firewall read-out.
Strix (AI pentest agent) was **not** run: it needs an LLM API key and actively attacks a live
target; Preview and production share one database. Run it only against an isolated staging copy
with explicit approval.

## 1. Verified OK
| Check | Result |
|---|---|
| RLS enabled on all 23 public tables | ✅ |
| Anonymous (anon key) read of profiles, personnel, inventory, GPS, PHST, audit, units, storage | ✅ 0 rows each |
| Viewer self-escalation to admin (`update profiles`) | ✅ 0 rows |
| Viewer role-change RPC `admin_set_profile_role` | ✅ denied |
| Viewer writes: stock movement, inventory, personnel, PHST checklist, storage upload | ✅ denied / 0 rows |
| Class V (ammunition) hidden from viewer (RESTRICTIVE policies on items + movements) | ✅ |
| Audit log hidden from non-managers | ✅ |
| Self sign-up cannot join the unit (trigger ignores `unit_id` metadata; default role viewer, no unit) | ✅ |
| SECURITY DEFINER functions use `search_path=''`; internal ones not executable by anon/auth | ✅ |
| GPS ingest token compared with `timingSafeEqual`; only SHA-256 hash stored in DB; table in `private`, no grants | ✅ |
| Storage bucket `navyhub-files` private, 10 MB limit, per-unit folder policies | ✅ |
| No secrets in tracked files or git history; client only has URL + publishable key | ✅ |
| Logbook Word/PDF export HTML-escapes all values | ✅ |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Security headers: HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy | ✅ |

## 2. Findings (priority order)
| # | Severity | Finding | Recommendation |
|---|---|---|---|
| F1 | **High** | Every unit account (incl. Viewer) can read all 39 personnel rows **including NRP, birth place/date, education** (`personnel_read_unit`). UI hiding is not protection. | Split sensitive columns into a `personnel_private` table (or view + column grants) readable only by Admin/Commander/personnel officer; keep a directory view for others. |
| F2 | **High** | Officer/Operator can insert `stock_movements` for **Class V items they cannot see**; the SECURITY DEFINER balance trigger then changes ammunition balances. No department check on stock writes either. | Add RESTRICTIVE insert policy (Class V requires `can_access_class_v()`/admin/commander) and department write rule; re-test allow/deny. |
| F3 | **High** | No MFA (0 factors enrolled), leaked-password protection disabled, no idle-logout. A stolen phone/session = full access. | Enable HIBP check (Dashboard → Auth), enforce TOTP MFA for admin/commander (AAL2 in RLS for Class V + personnel), auto sign-out after idle, shorter JWT expiry. |
| F4 | Medium | Public sign-up probably still enabled (app is invite-only). Strangers can create auth users (spam, email cost), even though they see no data. | Disable "Allow new users to sign up" in Supabase Auth; invite via `admin-invite-user` only. Verify in Dashboard. |
| F5 | Medium | Single hard-coded main admin UUID in policy + RPC: if that account is lost/compromised there is no recovery path and no second approver. | Documented break-glass procedure; second admin with MFA; consider two-person rule for role changes and Class V. |
| F6 | Medium | Vercel: default firewall only, no rate limiting on `/api/gps` or login; no spend cap verified. (Reel risk: bandwidth/DDoS bill.) | Add WAF rate-limit rule for `/api/*` and auth paths; set Spend Management with **hard pause**, not only alerts; keep project on a plan with spend cap. |
| F7 | Medium | No Content-Security-Policy. | Add CSP (self + Supabase + OSM tiles + Open-Meteo + Google Fonts), start in Report-Only. |
| F8 | Medium | No lockfile committed; CI `npm install` resolves fresh versions each build (supply-chain / reproducibility). | Commit `package-lock.json`, use `npm ci`. |
| F9 | Low | Department write-side RLS incomplete: any operator can update any PHST checklist item / create movements for any department. | Implement department matrix from `ALNAV-DMS-DEPARTMENTAL-RBAC.md` with tests. |
| F10 | Low | `admin-invite-user` CORS `*`; error messages return raw DB text. Repo v3 (no-department invites) not deployed. | Restrict origin to app domains; generic errors; deploy v3 after approval. |
| F11 | Low | `/api/gps` accepts any `position_at` (future/old) — spoofable timestamps. | Reject fixes >5 min in future / flag stale. |
| F12 | Info | 7 unindexed FKs, 23 unused indexes, duplicate permissive policies (departments, phst_daily_orders). | Add FK indexes; merge policies. |
| F13 | Info | Accessibility: images have alt text; colour contrast/keyboard not formally tested (reel: ADA risk is US-specific but WCAG is good practice). | Run axe/Lighthouse in CI. |

Reel themes mapped: RLS-off leak → **not affected** (verified). Budget alerts ≠ cap → F6. DDoS/bandwidth → F6.
Messaging without consent → app sends only Supabase invite emails, no SMS/WhatsApp marketing → not applicable.

## 3. System / application / efficiency gaps
- **Bundle**: `pdfjs-dist` imported eagerly in `page.tsx` (only needed for PHST import) → lazy-load with `import()`. `page.tsx` still a large client shell.
- **Connectivity at sea**: app is online-only. No offline queue/sync; at sea with poor SATCOM the logbook and stock cannot be written. Needs offline-first (IndexedDB queue + conflict rules) — the biggest functional gap for a warship.
- **Data sovereignty / OPSEC**: personnel, ammunition and live ship position stored on foreign cloud (Supabase Singapore, Vercel global). For operational use this needs a formal decision by command (Dinas Infolahta/Siber) or a self-hosted/on-board node.
- **GPS exposure**: live position is visible to every unit account and in the opening animation; consider role-limited position or delayed display when underway/EMCON.
- **Backups**: verify PITR/daily backup on the Supabase plan and do a restore drill; export audit log off-site.
- **Monitoring**: no error tracking/alerting; no automated tests (only typecheck/build/audit in CI).
- **Heading**: still no real gyro source — DEMO only (correct by design).

## 4. Missing warship functions (candidate roadmap)
1. Planned Maintenance System (PMS): periodic schedules per equipment, overdue alerts, running-hours.
2. Ammunition: expenditure/firing record, lot/batch, magazine temperature log, two-person issue approval.
3. Navigation/deck log (hourly position, weather, events) generated from GPS + watch.
4. Readiness report (status siap tempur per department, defects affecting capability) for command.
5. Damage control board / watertight-door status, drills record (fire, flooding, man overboard) with times.
6. Personnel qualifications, leave/onboard count (POB), watch bill rotation fairness.
7. Fuel/water consumption trend & endurance estimate.
8. Communications log (signals in/out) with classification handling.
