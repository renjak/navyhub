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
