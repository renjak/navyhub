# ALNAV DMS — Departmental Access Control Design

## 1. Operating principle
ALNAV DMS is one shared ship information system for all active KRI ALAMANG-644 personnel. A person’s account is tied to an authenticated profile and, where applicable, one owning department. Read access to common ship information is broad within the active unit; create/update/approve rights are scoped to the user's assigned department and operational role. Hiding a button is not authorization: every write is checked by Supabase RLS and server-side validation.

## 2. Department structure
| Code | Department | Ownership examples |
|---|---|---|
| OPS | Operasi | Department-owned operational logbook activity, operational checklists, assigned operational records, and Class V (ammunition) accountability with authorised Class V access |
| SIN | Mesin (engineering; corrected by owner 26 Nov 2026 — previously mislabelled "Senjata") | Engineering/machinery department records. Class V is NOT held by SIN (see OPS). |
| EKA | Elektronika | Electronics/electrical equipment, electronics maintenance, and linked spare-part accountability |
| LOG | Logistik | Supply receipt/issue, Class I/III/IV/VIII and general logistics master records |

Class membership and department ownership are separate. For example, Class IX is the supply classification for spare parts, but an individual spare part may be owned by EKA, OPS, SIN or LOG depending on the supported equipment. A record therefore needs both its supply class/category and its responsible department.

## 3. Proposed access model
| Account scope | Read | Create | Edit/master-data | Approve |
|---|---|---|---|---|
| Active personnel / department member | Shared ship information and own department records; sensitive scopes excluded | Assigned records in own department where permitted | Own submitted draft records only, not another department's records | No |
| Department head | Shared ship information and full own-department records | Own department | Own department master data and submitted records | Own department workflow |
| Commander | All unit information permitted to command | As authorized | Limited to approved command workflows; not account provisioning | Cross-department approval |
| System Admin | All unit/system data subject to policy | All authorized modules | Account, role, department, configuration and global data management | Administrative override with audit |
| Read-only account | Common authorized information only | No | No | No |

Current database role enum only has admin, commander, officer, operator and viewer. Department-head status and department assignment do not exist in profiles yet. Do not pretend an officer/operator account is department-scoped until the schema and policies are changed.

## 4. Data model required
1. Add `profiles.department_code` (OPS/SIN/EKA/LOG; nullable only for command/system accounts) and a controlled department-head entitlement. Keep account identity in Supabase Auth; never let a user set their own department or head flag.
2. Add `department_code` to department-owned operational records, at minimum `activity_logs`, `inventory_items`, `maintenance_assets`, `maintenance_records`, `checklists`, `checklist_runs`/responses, `daily_watch_reports`, and relevant document metadata. Stock movements inherit/validate the department from their linked item. Do not create a free-text department value in each screen.
3. Keep supply taxonomy independent: `supply_class` = I/III/IV/V/VIII/IX, plus category/subcategory; `department_code` is the authorized owner. A class card is not itself an access rule.
4. Add auditable account provisioning/deactivation and department reassignment. Use a server-side Auth Admin invite endpoint; never expose the service-role key to browser code.
5. Sensitive scopes (Class V, sensitive personnel details, classified documents) need explicit entitlements in addition to ordinary department membership.

## 5. Database authorization rules
- Active users of the same unit may read shared/general ship records, subject to sensitive-data policies.
- Department members may create records only when `department_code = private.current_department_code()` and the department role permits that operation.
- Department heads may update/approve only records whose `department_code` matches their assigned department.
- Admin and Commander policies are separate: Admin configures accounts/permissions; Commander performs command approvals. Do not conflate these roles.
- Stock issue/receipt must validate the linked inventory item's department and class in a single database transaction.
- Class V reads must be denied by RLS to accounts without explicit ammunition entitlement, not merely hidden in the UI.
- Archive access must consider confidentiality level and department scope before issuing short-lived signed URLs.
- Personnel directory fields can be shared in a minimized form. Sensitive fields require a dedicated private table or restrictive column grants/RLS-backed server endpoint.
- All role, department, approval and sensitive-access changes must write audit events.

## 6. Module ownership model
| Module / data | Shared read | Department editing rule |
|---|---|---|
| DASHBOARD | All active personnel, excluding restricted details | No direct editing; values aggregate from source modules |
| LOGBOOK | Common activities visible unit-wide | Each record carries responsible department; department members edit only own allowed entries; shared PHST schedule changes are command/admin-controlled |
| STOCK | Common supply overview and class summaries as permitted | Item-level responsible department; Class V has a separate sensitive entitlement; transaction write validates item owner |
| PERSONEL | Minimal directory visible unit-wide | Personnel administrator/Admin owns master changes; department head may manage only assigned duty/department attributes if authorized |
| MAINTENANCE | General equipment readiness visible unit-wide | Each asset/work order belongs to responsible department; other departments can read shared status but cannot mutate its work order |
| ARCHIVE | Metadata visible only according to confidentiality policy | Owner department manages its documents; restricted downloads require authorization |
| ADMINISTRATION | No ordinary account sees account administration | System Admin manages profiles, department/head assignment and access policy; all actions audited |

## 7. Migration and test sequence
1. Build a data-bearing copy of the active Supabase database. The currently available Supabase branch is empty (`with_data=false`), so it is not a valid RLS regression environment.
2. Add nullable scope columns and constraints via reversible migrations; preserve existing rows with null/global ownership until each row's department is confirmed. Do not guess department ownership for legacy maintenance or document rows.
3. Backfill known PHST department rows and inventory ownership only where verified. For unresolved legacy rows, keep command/Admin ownership until reviewed.
4. Create helper functions using `auth.uid()` and active profile lookup; security-definer helpers must have a fixed search_path and least privilege.
5. Replace broad manager-only write policies with explicit department-aware policies, while preserving command approval and Admin management.
6. Run positive and negative tests for OPS/SIN/EKA/LOG heads, ordinary department members, Commander, Admin and Viewer. Test direct PostgREST access, not only frontend button visibility.
7. Verify Class V is denied to unauthorized accounts, cross-department update fails, inactive accounts fail, and signed document URLs expire.

## 8. Current blocker and safety
The active Supabase project is currently the live data-bearing project. Its available branch is empty and no verified database backup/restore development environment was confirmed in this audit. Therefore no department/RLS schema migration has been applied to the active database. Doing so without a data-bearing test copy would risk breaking authentication and current RLS behavior. The front-end Class V query filter is an interim minimization only; the database RLS restriction is still required before production.

## 9. Exact next implementation action
Create a verified data-bearing Supabase development project/restore, then implement the department scope migration and RLS policy tests against that copy. Once the matrix passes, integrate an ADMINISTRATION workspace for account invitation, department assignment, head designation, deactivation, and audit history.

## Implementation status — 25 November 2026

### Applied database foundation
- Departments table: OPS, SIN, EKA, LOG per unit.
- Profiles: department_code, is_department_head, can_access_class_v.
- Department ownership columns on activity_logs, inventory_items, maintenance_assets, maintenance_records, checklists, checklist_runs, daily_watch_reports and personnel.
- Inventory supply_class check: I, III, IV, V, VIII, IX.
- Existing known stock mapping: Air Tawar -> I/LOG; BBM -> III/LOG; Amunisi -> V/OPS (owner decision 26 Nov 2026: OPS holds Class V; migration 20261126061025 moves the 15 rows from SIN).
- Display labels: department codes are shown as DEPOPS, DEPSIN, DEPEKA, DEPLOG; stored codes remain OPS/SIN/EKA/LOG.
- Class V authorisation (profiles.can_access_class_v) may only be granted to OPS accounts (app + admin-invite-user function).
- Class V SELECT protection enforced by restrictive RLS on inventory_items and stock_movements.

### Account administration
- Admin can assign department, head designation and Class V entitlement to existing profiles.
- Admin can invite new personnel by email through the JWT-protected `admin-invite-user` Edge Function. It validates the caller's active Admin profile, restricts account roles to officer/operator/viewer, creates the Auth invitation, updates the profile, and writes an audit event.

### Not yet complete
- Department-specific write policies and test matrix across operational modules.
- Automated invitation acceptance/login QA.
- Account deactivation/revocation workflow and full role change audit.
- Column-level protection for sensitive personnel fields and document confidentiality controls.
- Existing legacy records with unknown department ownership must be reviewed before assigning department codes.
