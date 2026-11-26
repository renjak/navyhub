"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NavControls, fixState, useNav } from "./NavRuntime";
import NavMapButton from "./NavMap";
const VesselModel3D = dynamic(() => import("./VesselModel3D"), { ssr: false, loading: () => <div className="dg-3d-loading">Loading 3D model…</div> });

/* Dashboard — dark glass. Every number comes from Supabase under the
   signed-in user's RLS; anything missing renders "—". Nothing is invented. */

type Row = Record<string, any>;
type Period = 0 | 6 | 29;
type Props = {
  supabase: SupabaseClient;
  unitId: string;
  userId: string;
  role: string;
  greetingName: string;
  isAdmin: boolean;
  canAccessClassV: boolean;
  supplyRows: Row[];
  onOpen: (moduleId: string, partId?: string) => void;
  onEditSupply: (item: Row) => void;
};

const CLASSES = ["I", "III", "IV", "V", "VIII", "IX"] as const;
const DEPTS = ["OPS", "SIN", "EKA", "LOG"] as const;
const OPEN_FAULT = ["reported", "in_progress"];

function wibDate(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}
function wibHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date()));
}
function greeting() {
  const h = wibHour();
  return h < 11 ? "Good morning" : h < 15 ? "Good afternoon" : h < 18 ? "Good afternoon" : "Good evening";
}
const longDate = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
const timeWib = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) + " WIB";

function classOf(r: Row): string | null {
  if (r.supply_class) return String(r.supply_class);
  const c = String(r.category || "").toLowerCase();
  if (c === "air tawar" || c.startsWith("class i ") || c.startsWith("class i·") || c.includes("subsistence")) return "I";
  if (c === "bbm" || c.includes("fuel") || c === "hsd") return "III";
  if (c.includes("damage control") || c.startsWith("class iv")) return "IV";
  if (c === "amunisi" || c.includes("class v ") || c.includes("ammunition")) return "V";
  if (c.includes("medical") || c.startsWith("class viii")) return "VIII";
  if (c.includes("spare parts") || c.startsWith("class ix")) return "IX";
  return null;
}
function dm(v: number, pos: string, neg: string) {
  const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  return `${d}°${m.toFixed(3).padStart(6, "0")}′ ${v < 0 ? neg : pos}`;
}
const num = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const fmtInt = (v: number | null) => (v === null ? "—" : v.toLocaleString("en-GB"));

type Gps = { position_at: string; latitude: number; longitude: number; speed_knots: number | null; course_degrees: number | null; source: string | null; accuracy_m: number | null } | null;
function gpsState(g: Gps): { key: "live" | "proxy" | "stale" | "none" | "demo"; label: string } {
  const k = fixState(g);
  return { key: k, label: k === "live" ? "Live" : k === "proxy" ? "Admin device proxy" : k === "stale" ? "Not live" : "No data yet" };
}

function Gauge({ pct, tone, label }: { pct: number | null; tone: string; label: string }) {
  return (
    <svg viewBox="0 0 120 70" className="dg-gauge" role="img" aria-label={label}>
      <path d="M12 62 A48 48 0 0 1 108 62" pathLength={100} className="dg-gauge-track" />
      {pct !== null && pct > 0 && <path d="M12 62 A48 48 0 0 1 108 62" pathLength={100} className="dg-gauge-fill" style={{ stroke: tone, strokeDasharray: `${Math.min(100, pct)} 100` }} />}
    </svg>
  );
}

export default function DashboardHome({ supabase: sb, unitId, userId, role, greetingName, isAdmin, canAccessClassV, supplyRows, onOpen, onEditSupply }: Props) {
  const [period, setPeriod] = useState<Period>(0);
  const navRt = useNav();
  const gpsErr = !!navRt.gpsError;
  const sim = navRt.sim;
  const gps: Gps = sim || navRt.gps;
  const [gpsCount, setGpsCount] = useState<number | null>(null);
  const [items, setItems] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [phst, setPhst] = useState<Row | null | undefined>(undefined);

  /* period-independent data */
  useEffect(() => {
    let live = true;
    const head = (t: string) => sb.from(t).select("*", { count: "exact", head: true }).eq("unit_id", unitId);
    (async () => {
      const [gc, inv, per, prof, mov, chk, faults, watch, order] = await Promise.all([
        head("vessel_gps_positions"),
        sb.from("inventory_items").select("id,category,supply_class,department_code").eq("unit_id", unitId).eq("is_active", true).limit(2000),
        head("personnel"),
        head("profiles"),
        head("stock_movements"),
        head("checklists").eq("is_active", true),
        head("maintenance_records").in("status", OPEN_FAULT),
        head("daily_watch_reports").neq("status", "draft").is("approved_at", null),
        sb.from("phst_daily_orders").select("duty_officer,readiness_level").eq("unit_id", unitId).eq("activity_date", wibDate()).maybeSingle()
      ]);
      if (!live) return;
      setGpsCount(gc.error ? null : gc.count ?? 0);
      setItems(inv.error ? null : (inv.data || []).filter((r: Row) => canAccessClassV || classOf(r) !== "V"));
      const c = (r: { error: any; count: number | null }) => (r.error ? null : r.count ?? 0);
      setCounts(prev => ({ ...prev, personnel: c(per), accounts: c(prof), movements: c(mov), checklists: c(chk), faults: c(faults), watch: c(watch) }));
      setPhst(order.error ? undefined : order.data || null);
    })();
    return () => { live = false; };
  }, [sb, unitId, canAccessClassV]);

  /* period-dependent data */
  useEffect(() => {
    let live = true;
    const from = wibDate(period), to = wibDate();
    (async () => {
      const [logs, runs] = await Promise.all([
        sb.from("activity_logs").select("*", { count: "exact", head: true }).eq("unit_id", unitId).gte("activity_date", from).lte("activity_date", to).neq("category", "PHST META"),
        sb.from("checklist_runs").select("*", { count: "exact", head: true }).eq("unit_id", unitId).gte("duty_date", from).lte("duty_date", to)
      ]);
      if (!live) return;
      setCounts(prev => ({ ...prev, logs: logs.error ? null : logs.count ?? 0, runs: runs.error ? null : runs.count ?? 0 }));
    })();
    return () => { live = false; };
  }, [sb, unitId, period]);

  const byClass = useMemo(() => {
    const m: Record<string, number> = {};
    for (const k of CLASSES) m[k] = 0;
    for (const r of items || []) { const k = classOf(r); if (k && k in m) m[k]++; }
    return m;
  }, [items]);
  const maxClass = Math.max(1, ...Object.values(byClass));
  const filledClasses = CLASSES.filter(k => byClass[k] > 0).length;
  const byDept = useMemo(() => {
    const m: Record<string, { n: number; cls: Set<string> }> = {};
    for (const d of DEPTS) m[d] = { n: 0, cls: new Set() };
    for (const r of items || []) { const d = String(r.department_code || "").toUpperCase(); if (m[d]) { m[d].n++; const k = classOf(r); if (k) m[d].cls.add(k); } }
    return m;
  }, [items]);

  const tanks = (["BBM", "Air Tawar"] as const).map(cat => {
    const it = supplyRows.find(r => r.category === cat);
    const cap = num(it?.capacity_liters), stock = num(it?.stock_ready);
    const pct = it && cap && cap > 0 && stock !== null ? Math.max(0, Math.min(100, Math.round((stock / cap) * 100))) : null;
    const tone = pct === null ? "" : pct < 15 ? "var(--dg-bad)" : pct < 30 ? "var(--dg-warn)" : cat === "BBM" ? "var(--dg-ok)" : "var(--dg-info)";
    return { cat, label: cat === "BBM" ? "Fuel (HSD)" : "Fresh water", it, cap, stock, pct, tone };
  });
  const lowTank = tanks.filter(t => t.pct !== null).sort((a, b) => (a.pct! - b.pct!))[0];

  const gsReal = gpsState(navRt.gps);
  const gs = sim ? { key: "demo" as const, label: "Simulation (DEMO)" } : gpsState(navRt.gps);
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const envLabel = env === "production" ? "Production" : env === "preview" ? "Preview" : env === "development" || process.env.NODE_ENV === "development" ? "Local (dev)" : "—";
  const periodLabel = period === 0 ? "today" : `last ${period + 1} days`;
  const v = (k: string) => (counts[k] === undefined ? "…" : counts[k] === null ? "—" : fmtInt(counts[k] as number));

  return (
    <div className="dg-dash">
      <section className="dg-titlebar">
        <div>
          <h1 className="dg-h">{greeting()}, {greetingName}</h1>
          <p>KRI ALAMANG-644 summary · {longDate()}</p>
        </div>
        <div role="group" aria-label="Period" className="dg-glass dg-seg">
          {([[0, "Today"], [6, "7 days"], [29, "30 days"]] as [Period, string][]).map(([p, l]) => (
            <button type="button" key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>
          ))}
        </div>
      </section>

      <section className="dg-row">
        <article className="dg-glass dg-card dg-identity">
          <div className="dg-card-head">
            <div>
              <div className="dg-eyebrow">Ship identity</div>
              <h2 className="dg-h dg-ship-name">KRI ALAMANG-644</h2>
              <div className="dg-sub">High-tensile steel hull · aluminium superstructure</div>
            </div>
            <span className="dg-sub dg-hint">Click a ship part for details · drag to rotate</span>
          </div>
          <VesselModel3D supabase={sb} unitId={unitId} userId={userId} role={role} canAccessClassV={canAccessClassV}
            key={sim ? "3d-sim" : "3d-real"} modes={["status", "telemetri"]} initialMode={sim || gsReal.key === "live" || gsReal.key === "proxy" ? "telemetri" : "status"} panelCollapsed
            nav={{ gps: navRt.gps, sim: navRt.sim }} telemetrySlot={<p className="v3d-note">Master GPS and simulation controls are on the Telemetry card.</p>}
            onExternalMode={(m, partId) => onOpen(m === "tangki" ? "NAVYSTOCK" : m === "jaga" || m === "putar-ulang" || m === "latihan" ? "NAVYLOG" : "NAVYMAINT", partId)}
            className="dg-3d" />
          <div className="dg-specs">
            <div className="dg-well"><span>Length (LOA)</span><b>44,00 m</b></div>
            <div className="dg-well"><span>Beam · draught</span><b>7,40 · 1,80 m</b></div>
            <div className="dg-well"><span>Speed</span><b>27 / 24 kn</b></div>
            <div className="dg-well"><span>Engines</span><b>3 × MAN V12</b></div>
          </div>
        </article>

        <article className="dg-glass dg-card dg-telemetry">
          <div className="dg-card-head">
            <h2 className="dg-h dg-card-title">Telemetry</h2>
            <span className={"dg-pill dg-pill-" + gs.key}><i />{gpsErr ? "Could not load" : gs.label}</span>
          </div>
          <div className="dg-grid2">
            <div className="dg-well dg-span2"><span>{sim ? "Simulated position (DEMO)" : "Position"}{gps && !sim ? " · " + timeWib(gps.position_at) : ""}</span><b className="dg-mono">{gps ? `${dm(gps.latitude, "U", "S")}  ${dm(gps.longitude, "T", "B")}` : "—"}</b></div>
            <div className="dg-well"><span>SOG</span><b>{gps?.speed_knots != null ? gps.speed_knots.toFixed(1) + " kn" : "—"}</b></div>
            <div className="dg-well"><span>COG</span><b>{gps?.course_degrees != null ? String(Math.round(gps.course_degrees)).padStart(3, "0") + "°" : "—"}</b></div>
            <div className="dg-well dg-span2"><span>{sim ? "Heading · DEMO gyro" : "Heading"}</span><b>{sim && sim.heading_demo != null ? String(Math.round(sim.heading_demo)).padStart(3, "0") + "°" : "—"}</b></div>
          </div>
          <p className="dg-note">{sim ? "Simulated gyro heading (DEMO); real heading needs a gyro/AHRS. " : "Heading needs a gyro/AHRS; COG is not heading. "} {gpsCount === null ? "" : `${fmtInt(gpsCount)} positions stored`}{!sim && navRt.gps?.source ? `, last source: ${navRt.gps.source === "onboard_gps" ? "ship GPS" : navRt.gps.source === "admin_device_gps" ? "Admin device (proxy)" : navRt.gps.source}.` : "."}{sim ? " The values above come from the simulation and are not saved." : ""}</p>
          <NavControls />
          <div className="dg-btn-row">
            <NavMapButton className="dg-btn dg-btn-block" label="Open map" />
            <button type="button" className="dg-btn dg-btn-block" onClick={() => onOpen("NAVYLOG")}>Track in Logbook</button>
          </div>
        </article>
      </section>

      <section className="dg-row dg-kpis">
        <button type="button" className="dg-glass dg-card dg-kpi" onClick={() => onOpen("NAVYCREW")}><span>Personnel</span><b className="dg-h">{v("personnel")}</b><small>registered{counts.accounts != null ? ` · ${fmtInt(counts.accounts as number)} app accounts` : ""}</small></button>
        <button type="button" className="dg-glass dg-card dg-kpi" onClick={() => onOpen("NAVYSTOCK")}><span>Stock items</span><b className="dg-h">{items ? fmtInt(items.length) : "—"}</b><small>{items ? `${filledClasses} classes filled` : "—"}{counts.movements != null ? ` · ${fmtInt(counts.movements as number)} movements` : ""}</small></button>
        <button type="button" className="dg-glass dg-card dg-kpi" onClick={() => onOpen("NAVYLOG")}><span>Activity log</span><b className="dg-h">{v("logs")}</b><small>{periodLabel}</small></button>
        <button type="button" className="dg-glass dg-card dg-kpi" onClick={() => onOpen("NAVYLOG")}><span>Checklist</span><b className="dg-h">{v("checklists")}</b><small>templates · {v("runs")} run {periodLabel}</small></button>
      </section>

      <section className="dg-row">
        <article className="dg-glass dg-card dg-third">
          <h2 className="dg-h dg-card-title">Tanks</h2>
          <div className="dg-tanks">
            {tanks.map(t => {
              const editable = isAdmin && !!t.it;
              const body = <>
                <div className="dg-gauge-wrap"><Gauge pct={t.pct} tone={t.tone} label={`${t.label}, ${t.pct === null ? "no reading yet" : t.pct + " percent"}`} /><b>{t.pct === null ? "—" : t.pct + "%"}</b></div>
                <div className="dg-tank-name">{t.label}</div>
                <small>{t.stock !== null && t.it ? fmtInt(t.stock) + " L · " : ""}capacity {t.cap ? fmtInt(t.cap) + " L" : "—"}</small>
              </>;
              return editable
                ? <button type="button" key={t.cat} className="dg-tank dg-tank-edit" onClick={() => onEditSupply(t.it!)} title="Update sounding">{body}</button>
                : <div key={t.cat} className="dg-tank">{body}</div>;
            })}
          </div>
          <p className="dg-note">{tanks.every(t => t.pct === null) ? "No tank level reading yet." : "Amber below 30%, red below 15%."}{isAdmin && tanks.some(t => t.it) ? " Tap a tank to update the sounding." : ""}</p>
        </article>

        <article className="dg-glass dg-card dg-third">
          <h2 className="dg-h dg-card-title">Stock by supply class</h2>
          <div className="dg-bars">
            {CLASSES.map(k => {
              const locked = k === "V" && !canAccessClassV, n = byClass[k];
              return <div key={k} className="dg-bar-row">
                <span>Class {k}</span>
                <span className="dg-bar">{!locked && n > 0 && <i style={{ width: Math.max(4, Math.round((n / maxClass) * 100)) + "%" }} />}</span>
                <b className={locked || !n ? "dg-dim" : ""}>{locked ? "🔒" : items ? n : "—"}</b>
              </div>;
            })}
          </div>
          <p className="dg-note">Class V is restricted: Admin, Commander or entitled accounts only.</p>
        </article>

        <article className="dg-glass dg-card dg-third">
          <h2 className="dg-h dg-card-title">System status</h2>
          <div className="dg-status">
            <div className="dg-well"><i className={"dg-dot dg-dot-" + (gsReal.key === "live" ? "ok" : gsReal.key === "proxy" ? "info" : gsReal.key === "stale" ? "warn" : "none")} /><span>GPS</span><em>{gpsErr ? "—" : gsReal.key === "live" ? "live" : gsReal.key === "proxy" ? "Admin proxy" : gsReal.key === "stale" ? "not live" : "no data yet"}</em></div>
            <div className="dg-well"><i className={"dg-dot dg-dot-" + (!lowTank ? "none" : lowTank.pct! < 15 ? "bad" : lowTank.pct! < 30 ? "warn" : "ok")} /><span>Lowest tank</span><em>{lowTank ? `${lowTank.label} ${lowTank.pct}%` : "—"}</em></div>
            <div className="dg-well"><i className={"dg-dot dg-dot-" + (counts.faults == null ? "none" : counts.faults > 0 ? "bad" : "info")} /><span>Open faults</span><em>{counts.faults == null ? "—" : counts.faults === 0 ? "no reports" : fmtInt(counts.faults)}</em></div>
            <div className="dg-well"><i className="dg-dot dg-dot-info" /><span>Environment</span><em>{envLabel}</em></div>
          </div>
        </article>
      </section>

      <section className="dg-row">
        <article className="dg-glass dg-card dg-wide">
          <h2 className="dg-h dg-card-title">Needs action</h2>
          <div className="dg-grid2">
            <button type="button" className="dg-well dg-action" onClick={() => onOpen("NAVYDOCS")}><b className="dg-h">{v("watch")}</b><span>watch reports awaiting verification</span></button>
            <button type="button" className="dg-well dg-action" onClick={() => onOpen("NAVYMAINT")}><b className="dg-h">{v("faults")}</b><span>open faults</span></button>
            <button type="button" className="dg-well dg-action" onClick={() => onOpen("NAVYLOG")}><b className="dg-h">{v("runs")}</b><span>checklists run {periodLabel}</span></button>
            <button type="button" className="dg-well dg-action" onClick={() => onOpen("NAVYLOG")}><b className="dg-h">{phst === undefined ? "—" : phst ? "Yes" : "—"}</b><span>Today's PHST{phst?.duty_officer ? ` · OOW ${phst.duty_officer}` : ""}</span></button>
          </div>
        </article>
        <article className="dg-glass dg-card dg-third">
          <h2 className="dg-h dg-card-title">Departments</h2>
          <div className="dg-grid2">
            {DEPTS.map(d => {
              const x = byDept[d];
              return <div key={d} className="dg-well"><div className="dg-h dg-dept">{d}</div><div className={x.n ? "dg-sub" : "dg-dim"}>{x.n ? `${x.n} items · Class ${[...x.cls].sort((a, b) => CLASSES.indexOf(a as any) - CLASSES.indexOf(b as any)).join(", ")}` : "—"}</div></div>;
            })}
          </div>
        </article>
      </section>

      <p className="dg-foot">All figures are read directly from the database under this account's access rights. “—” means no data yet; no values are invented.</p>
    </div>
  );
}
