"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/* App-level navigation runtime. Lives in the authenticated shell, so Admin
   Master GPS and the demo simulation keep running when the user switches
   modules, until they are stopped explicitly.
   - Master GPS posts the Admin device position to /api/gps every 30 s as
     source "admin_device_gps" (a proxy position, not onboard hardware GPS).
   - Simulation is a synthetic track kept in memory only; it is never sent
     to /api/gps or written to the database. COG is never called heading. */

export type Fix = {
  position_at: string; latitude: number; longitude: number;
  speed_knots: number | null; course_degrees: number | null;
  source: string | null; accuracy_m: number | null;
  /** Simulation only: synthetic gyro heading (DEMO). Never set for real data. */
  heading_demo?: number | null;
};
export type TrackState = "STOPPED" | "ACQUIRING" | "ACTIVE" | "ERROR" | "UNAVAILABLE";
type Ctx = {
  gps: Fix | null; gpsError: string; reload: () => void;
  canMaster: boolean; tracking: boolean; trackState: TrackState; lastSentAt: string | null; trackError: string;
  startMaster: () => void; stopMaster: () => void;
  sim: Fix | null; startSim: () => void; stopSim: () => void;
};
const NavCtx = createContext<Ctx | null>(null);
export function useNav() {
  const c = useContext(NavCtx);
  if (!c) throw new Error("useNav must be used inside NavRuntimeProvider");
  return c;
}

const n = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const toFix = (r: any): Fix => ({ position_at: r.position_at, latitude: Number(r.latitude), longitude: Number(r.longitude), speed_knots: n(r.speed_knots), course_degrees: n(r.course_degrees), source: r.source ?? null, accuracy_m: n(r.accuracy_m) });

/** Live = onboard ≤ 15 min, Admin proxy ≤ 2 min (same thresholds everywhere). */
export function fixState(f: Fix | null): "live" | "proxy" | "stale" | "none" {
  if (!f) return "none";
  const age = (Date.now() - new Date(f.position_at).getTime()) / 60000;
  if (f.source === "onboard_gps" && age <= 15) return "live";
  if (f.source === "admin_device_gps" && age <= 2) return "proxy";
  return "stale";
}

export function NavRuntimeProvider({ supabase, unitId, isAdmin, children }: { supabase: SupabaseClient; unitId: string; isAdmin: boolean; children: React.ReactNode }) {
  const [gps, setGps] = useState<Fix | null>(null), [gpsError, setGpsError] = useState("");
  const [tracking, setTracking] = useState(false), [trackState, setTrackState] = useState<TrackState>("STOPPED");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null), [trackError, setTrackError] = useState("");
  const [sim, setSim] = useState<Fix | null>(null);
  const timer = useRef<number | null>(null), enabled = useRef(false), pending = useRef(false);

  const reload = useCallback(async () => {
    if (!unitId) return;
    const { data, error } = await supabase.from("vessel_gps_positions").select("position_at,latitude,longitude,speed_knots,course_degrees,source,accuracy_m").eq("unit_id", unitId).order("position_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { setGpsError(error.message); return; }
    setGpsError(""); setGps(data ? toFix(data) : null);
  }, [supabase, unitId]);
  useEffect(() => { void reload(); const t = window.setInterval(() => void reload(), 60000); return () => window.clearInterval(t); }, [reload]);

  const publish = useCallback(async (pos: GeolocationPosition) => {
    if (pending.current) return;
    pending.current = true; setTrackError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin session not available. Please sign in again.");
      const position_at = new Date(pos.timestamp).toISOString();
      const speed = pos.coords.speed == null ? null : Math.max(0, pos.coords.speed * 1.943844);
      const course = pos.coords.heading == null || Number.isNaN(pos.coords.heading) ? null : ((pos.coords.heading % 360) + 360) % 360;
      const accuracy = pos.coords.accuracy ?? null;
      const res = await fetch("/api/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, speed_knots: speed, course_degrees: course, accuracy_m: accuracy, position_at, fix_quality: "Admin device location; proxy for ship position, not onboard GPS", source: "admin_device_gps" })
      });
      const body = await res.json().catch(() => ({ error: "Invalid server response." }));
      if (!res.ok) throw new Error(body.error || "Failed to send device location.");
      if (!enabled.current) return;
      setGps({ position_at, latitude: pos.coords.latitude, longitude: pos.coords.longitude, speed_knots: speed, course_degrees: course, source: "admin_device_gps", accuracy_m: accuracy });
      setLastSentAt(position_at); setTrackState("ACTIVE");
    } catch (e: any) {
      setTrackState("ERROR"); setTrackError(e?.message || "Failed to send device position.");
    } finally { pending.current = false; }
  }, [supabase]);

  const requestFix = useCallback(() => {
    if (!enabled.current || pending.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) { setTrackState("UNAVAILABLE"); setTrackError("This device does not provide location services."); return; }
    setTrackState(s => (s === "ACTIVE" ? s : "ACQUIRING"));
    navigator.geolocation.getCurrentPosition(p => void publish(p), err => {
      setTrackState("ERROR");
      setTrackError(err.code === 1 ? "Location permission denied. Allow ALNAV DMS to access location in your browser settings." : err.code === 2 ? "Device location not available yet. Check GPS and location services." : "Device GPS is not responding. Will retry.");
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }, [publish]);

  const startMaster = useCallback(() => {
    if (!isAdmin || enabled.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) { setTrackState("UNAVAILABLE"); setTrackError("This device does not provide location services."); return; }
    enabled.current = true; setTracking(true); setTrackState("ACQUIRING"); setTrackError("");
    requestFix();
    timer.current = window.setInterval(requestFix, 30000);
  }, [isAdmin, requestFix]);
  const stopMaster = useCallback(() => {
    enabled.current = false;
    if (timer.current !== null) { window.clearInterval(timer.current); timer.current = null; }
    setTracking(false); setTrackState("STOPPED");
  }, []);
  useEffect(() => () => { enabled.current = false; if (timer.current !== null) window.clearInterval(timer.current); }, []);

  /* simulation — memory only */
  const startSim = useCallback(() => {
    setSim(prev => prev || {
      position_at: new Date().toISOString(),
      latitude: gps?.latitude ?? -6.042, longitude: gps?.longitude ?? 106.887,
      speed_knots: 12, course_degrees: gps?.course_degrees != null ? Math.round(gps.course_degrees) : 55,
      source: "SIMULATION", accuracy_m: null,
      heading_demo: gps?.course_degrees != null ? Math.round(gps.course_degrees) : 55
    });
  }, [gps]);
  const stopSim = useCallback(() => setSim(null), []);
  const simOn = sim !== null;
  useEffect(() => {
    if (!simOn) return;
    const t = window.setInterval(() => setSim(p => {
      if (!p) return p;
      const now = Date.now();
      const cog = ((Number(p.course_degrees) + Math.sin(now / 11000) * 2.2) % 360 + 360) % 360;
      const sog = 12 + Math.sin(now / 9000) * 1.5;
      const dNm = sog * (2 / 3600), r = (cog * Math.PI) / 180;
      const drift = Math.sin(now / 13000) * 5 + Math.sin(now / 4100) * 1.2; // synthetic set/leeway, degrees
      return {
        ...p, position_at: new Date(now).toISOString(), speed_knots: Math.round(sog * 10) / 10, course_degrees: cog,
        heading_demo: ((cog + drift) % 360 + 360) % 360,
        latitude: p.latitude + (dNm / 60) * Math.cos(r),
        longitude: p.longitude + (dNm / (60 * Math.max(0.2, Math.cos((p.latitude * Math.PI) / 180)))) * Math.sin(r)
      };
    }), 2000);
    return () => window.clearInterval(t);
  }, [simOn]);

  const value = useMemo<Ctx>(() => ({ gps, gpsError, reload: () => void reload(), canMaster: isAdmin, tracking, trackState, lastSentAt, trackError, startMaster, stopMaster, sim, startSim, stopSim }),
    [gps, gpsError, reload, isAdmin, tracking, trackState, lastSentAt, trackError, startMaster, stopMaster, sim, startSim, stopSim]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

/** Header indicator shown on every module while something is running. */
export function NavRunningChips() {
  const { tracking, trackState, stopMaster, sim, stopSim } = useNav();
  if (!tracking && !sim) return null;
  return <div className="dg-running" role="status">
    {tracking && <span className={"dg-run-chip" + (trackState === "ERROR" || trackState === "UNAVAILABLE" ? " is-err" : "")}><i />Master GPS {trackState === "ACTIVE" ? "active" : trackState === "ACQUIRING" ? "acquiring" : "error"}<button type="button" onClick={stopMaster}>Stop</button></span>}
    {sim && <span className="dg-run-chip is-demo"><i />Simulation running (DEMO)<button type="button" onClick={stopSim}>Stop</button></span>}
  </div>;
}

/** Compact Master GPS + simulation controls (used on the Dashboard telemetry card). */
export function NavControls() {
  const { canMaster, tracking, trackState, lastSentAt, trackError, startMaster, stopMaster, sim, startSim, stopSim } = useNav();
  const t = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso)) + " WIB";
  return <div className="dg-navctl">
    {canMaster && <div className="dg-well dg-navctl-row">
      <div><b>Admin device Master GPS</b><small>{tracking ? (trackState === "ACTIVE" ? "Sending position every 30 seconds" : trackState === "ACQUIRING" ? "Acquiring device position…" : "Check location permission/connection") + (lastSentAt ? " · last " + t(lastSentAt) : "") : "Device position is sent as a proxy for ship position, not onboard GPS."}</small></div>
      <button type="button" className={"dg-btn" + (tracking ? " dg-btn-stop" : "")} onClick={tracking ? stopMaster : startMaster}>{tracking ? "Stop" : "Activate"}</button>
    </div>}
    <div className="dg-well dg-navctl-row">
      <div><b>Navigation simulation (DEMO)</b><small>{sim ? "Synthetic track running; not saved to the database." : "Test 3D model motion without changing GPS data."}</small></div>
      <button type="button" className={"dg-btn" + (sim ? " dg-btn-stop" : "")} onClick={sim ? stopSim : startSim}>{sim ? "Stop" : "Run"}</button>
    </div>
    {trackError && tracking && <p className="dg-note dg-err">{trackError}</p>}
    <p className="dg-note">Both keep running when you switch modules, until stopped. On phones, locking the screen or closing the browser can stop GPS updates.</p>
  </div>;
}
