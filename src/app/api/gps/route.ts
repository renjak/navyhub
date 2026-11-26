import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ingestToken = process.env.VESSEL_GPS_INGEST_TOKEN;
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !ingestToken) {
    return NextResponse.json({ error: "GPS ingest is not configured on the server." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return NextResponse.json({ error: "Authorization required." }, { status: 401 });

  let isHardware = sameSecret(bearer, ingestToken);
  let userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: isHardware ? {} : { Authorization: `Bearer ${bearer}` } }
  });

  if (!isHardware) {
    const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !authData.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role,is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "admin" || !profile.is_active) {
      return NextResponse.json({ error: "Only an active ALNAV DMS admin can submit a manual/device GPS fix." }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const speed = body.speed_knots == null ? null : Number(body.speed_knots);
  const course = body.course_degrees == null ? null : Number(body.course_degrees);
  const satellites = body.satellites == null ? null : Number(body.satellites);
  const positionAt = typeof body.position_at === "string" ? body.position_at : null;
  const source = isHardware ? "onboard_gps" : "admin_device_gps";

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Latitude/longitude out of range." }, { status: 400 });
  }
  if (speed !== null && (!Number.isFinite(speed) || speed < 0)) return NextResponse.json({ error: "Invalid speed_knots." }, { status: 400 });
  if (course !== null && (!Number.isFinite(course) || course < 0 || course > 360)) return NextResponse.json({ error: "Invalid course_degrees." }, { status: 400 });
  if (satellites !== null && (!Number.isInteger(satellites) || satellites < 0)) return NextResponse.json({ error: "Invalid satellites." }, { status: 400 });
  if (positionAt && Number.isNaN(Date.parse(positionAt))) return NextResponse.json({ error: "Invalid position_at timestamp." }, { status: 400 });

  const rpcClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await rpcClient.rpc("ingest_vessel_gps", {
    p_token: ingestToken,
    p_latitude: latitude,
    p_longitude: longitude,
    p_speed_knots: speed,
    p_course_degrees: course,
    p_satellites: satellites,
    p_fix_quality: isHardware ? (typeof body.fix_quality === "string" ? body.fix_quality.slice(0, 80) : null) : "Admin device location; not onboard GPS",
    p_position_at: positionAt,
    p_source: source
  });

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true, result: data, received_at: new Date().toISOString() });
}
