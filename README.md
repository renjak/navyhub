# NAVYHUB

NAVYHUB is the Next.js application for KRI Alamang-644, backed by the existing Supabase project.

## Active modules
- NAVYLOG: digital activity logbook
- NAVYMAINT: maintenance assets and records; categories are restricted to `SEWACO` and `PLATFORM`
- NAVYSTOCK: inventory list with inline cell editing
- NAVYCREW: personnel directory with inline cell editing
- GPS: administrator-controlled live vessel position

Other navigation modules remain visible while their workflows are implemented.

## GPS architecture
- One current position is retained per unit in `public.vessel_gps_positions`.
- The database has a unique index on `unit_id`; each incoming fix replaces the previous row.
- The onboard gateway posts to `POST /api/gps` every 60 seconds.
- The gateway sends `Authorization: Bearer <VESSEL_GPS_INGEST_TOKEN>`. Only this hardware-authenticated path may publish the `onboard_gps` source label.
- The token is stored only as a server-side Vercel environment variable and is never exposed to browser code.
- Admin users can explicitly submit a one-time device/browser location from the GPS screen; it is always labeled `admin_device_gps` and is never represented as onboard GPS.
- Only requests authenticated with the server-side `VESSEL_GPS_INGEST_TOKEN` are labeled `onboard_gps`; the API enforces this source label server-side.
- Browser/device geolocation is not collected or published automatically.
- Other authenticated users can view the latest position for their own unit.
- Preview deployments are read-only and GPS ingest is disabled there.

Example request body:

```json
{
  "latitude": -5.123456,
  "longitude": 106.654321,
  "speed_knots": 12.4,
  "course_degrees": 275,
  "satellites": 9,
  "fix_quality": "3D",
  "position_at": "2026-11-21T03:00:00Z",
  "source": "onboard_gps"
}
```

Use the actual GPS receiver coordinates and UTC timestamp. Do not send estimated or fabricated positions.

## Environment variables
Client:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_NAVYHUB_PREVIEW=true` (Preview only; enforces read-only mode)

Server:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to browser)
- `VESSEL_GPS_INGEST_TOKEN`

Never commit Supabase secret/service-role keys or the GPS ingest token.

## Deployment
The Vercel project is `navyhub`, connected to `renjak/navyhub`. Use a preview branch to validate UI/build before merging changes into `main` and deploying production.

The legacy Prisma/PostgreSQL recovery ZIP is not the active application and must not replace the Supabase/RLS foundation.
