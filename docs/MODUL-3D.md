# Modul 3D — KRI ALAMANG-644

Menu **MODEL 3D** in the sidebar opens a WebGL2 model of the ship with nine views. It uses only existing tables and policies; there is no migration and no new dependency.

## Files

| File | Purpose |
|---|---|
| `src/app/VesselModel3D.tsx` | Client component: views, panels, Supabase reads/writes. Loaded with `next/dynamic` (`ssr:false`) from `page.tsx`. |
| `src/app/vessel3d/engine.ts` | Self-contained WebGL2 renderer (hull lofted from the GA lines, x-ray decks, water, line-drawing welcome view). `// @ts-nocheck` because it is generated geometry code. |
| `src/app/vessel3d/data.ts` | Rooms from the deck plans, parts, systems, watch posts, schematic tank boxes, demo track. |
| `src/app/vessel3d/vessel3d.css` | Styles, all prefixed `v3d-`. |

## Views and data sources

| View | Reads | Writes (who) |
|---|---|---|
| Status | all sources below | — |
| Telemetri | latest `vessel_gps_positions` row; live if newer than 15 min (`onboard_gps`) or 2 min (`admin_device_gps`) | — |
| Kerusakan | `maintenance_records` (+ `maintenance_assets` with code `3D-<PART>` if present) | insert `maintenance_records` status `reported` (admin, commander, officer, operator); status → `in_progress`/`completed` (admin, commander) |
| Tangki | `inventory_items` categories `BBM`, `Air Tawar` (same rows as Dashboard) | sounding → `stock_movements` inbound/outbound delta (admin only, same rule as Dashboard) |
| Geladak | static deck plan data; Class V rooms hidden without `can_access_class_v` | — |
| Jaga | today's `daily_watch_assignments` (Perwira Jaga). Other posts have no source and show `—` | — (edit in Logbook) |
| Putar ulang | `vessel_gps_positions` for a WIB date + `activity_logs` with time on that date | — |
| Latihan | in memory only, never saved | — |
| Sambut | — | — |

A fault is linked to a part by the tag at the start of `issue_description`, e.g. `[3D-M2] Mesin utama 2 (tengah) — Prioritas tinggi: …`. If a manager registers a `maintenance_assets` row with `asset_code = '3D-M2'`, new reports also set `asset_id`. Reports without a tag are counted as "not linked to the model" and stay visible in Maintenance.

## Rules kept

- Missing values show `—`; blue means "no fault report", not "healthy"; green only for live data.
- The hull turns by **COG**, labelled as COG. Heading shows `—` until a gyro/AHRS source exists. The hull only turns and shows wake when the fix is live and SOG ≥ 0.5 kn.
- Demo telemetry and the demo replay track are labelled DEMO and never written to the database. Drill marks are never saved.
- Tank positions in the model are schematic (the drawings do not show tanks); fill levels come only from inventory data.
- The welcome card uses `/branding/alnav-dms-logo.jpg` with `object-fit: contain`.

## Known issue: logo file

`public/branding/alnav-dms-logo.jpg` in the repo is a truncated JPEG (5,141 bytes, 450×150, fails to decode), and the Next.js app root is `src/`, so `/branding/alnav-dms-logo.jpg` is not served from `src/public/` either. The logo therefore does not render anywhere in the app. Fixing it needs the owner's approval because the file is the official asset: restore the original file into `public/branding/` and add the same file under `src/public/branding/`.

## Browser support

Needs WebGL2 (all current desktop and mobile browsers). Without it the module shows a message and the rest of the app is unaffected. Reduced-motion users get no auto-rotation, bobbing or marker pulses.
