"use client";

/* ALNAV DMS — Modul 3D KRI ALAMANG-644.
   The ship model is the interface: nine views over the same hull, all fed by existing tables.
   Rules kept from CLAUDE.md: no fabricated values (missing data shows —), live vs proxy vs demo are
   always labelled, the hull is turned by COG only (never called heading), demo data is never saved. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEngine, type Engine, type EngineMarker } from "./vessel3d/engine";
import {
  MODES, DECKN, ROOMS, ROOM, TYPEC, TYPEN, PARTS, PART, SYS, POSTS, TANKS, DRILLC, DRILLN,
  DEMO_TRACK, DEMO_LOGS, gpsTrack, trackAt, assetCode,
  type Mode, type Deck, type SysId, type TrackPoint, type Rgb
} from "./vessel3d/data";
import "./vessel3d/vessel3d.css";

type Props = { supabase: any; unitId: string; userId: string; role: string; canAccessClassV: boolean };
type Gps = { position_at: string; latitude: number; longitude: number; speed_knots: number | null; course_degrees: number | null; source: string; accuracy_m: number | null };
type Supply = { id: string; item_name: string; category: string; capacity: number | null; stock: number | null; unit: string | null; updated_at: string | null };
type FaultStatus = "reported" | "in_progress" | "completed" | "deferred";
type Fault = { id: string; part: string | null; text: string; status: FaultStatus; report_date: string; created_at: string; completed_at: string | null };
type Watch = { duty_role: string | null; watch_type: string | null; new_watch_name: string | null; new_watch_rank: string | null };
type Tone = "live" | "demo" | "info" | "warn" | "bad" | "none";
type LogPoint = { t: number; title: string };
type Drill = "api" | "bocor" | "asap";

const WIB = "Asia/Jakarta";
const localDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: WIB, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const fmtT = (iso: string | number) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : d.toLocaleString("id-ID", { timeZone: WIB, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB"; };
const fmtHM = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { timeZone: WIB, hour: "2-digit", minute: "2-digit" });
const nf = (n: number) => Math.round(n).toLocaleString("id-ID");
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const rgb = (c: Rgb) => "rgb(" + c.map(v => Math.round(v * 255)).join(",") + ")";
const deg3 = (v: number) => String(Math.round(((v % 360) + 360) % 360)).padStart(3, "0") + "°";
const dm = (v: number, pos: string, neg: string) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return `${d}°${m.toFixed(3).padStart(6, "0")}′ ${v >= 0 ? pos : neg}`; };
const COL: Record<Tone, string> = { live: "var(--v3d-ok)", demo: "var(--v3d-demo)", info: "var(--v3d-info)", warn: "var(--v3d-warn)", bad: "var(--v3d-bad)", none: "var(--v3d-none)" };
const SRC: Record<string, string> = { onboard_gps: "GPS kapal", admin_device_gps: "Posisi perangkat Admin (proxy)" };
const FS: Record<FaultStatus, string> = { reported: "Dilaporkan", in_progress: "Dikerjakan", deferred: "Ditunda", completed: "Selesai" };
const OPEN: FaultStatus[] = ["reported", "in_progress", "deferred"];
const TAG = /^\[(3D-[A-Z0-9]+)\]\s*/i;
const CODE2PART: Record<string, string> = Object.fromEntries(PARTS.map(p => [assetCode(p).toUpperCase(), p.id]));
const DRILL_NEXT: Record<string, Drill | null> = { none: "api", api: "bocor", bocor: "asap", asap: null };
const REPLAY_SECONDS = 40;

const ICON: Record<Mode, React.ReactNode> = {
  status: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  telemetri: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  kerusakan: <><path d="M14.5 6.5a4 4 0 005 5L13 18a2.1 2.1 0 01-3-3z" /><path d="M9 15l-5 5" /></>,
  tangki: <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />,
  geladak: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  jaga: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>,
  "putar-ulang": <><path d="M4 12a8 8 0 108-8" /><path d="M4 4v4h4M12 8v4l3 2" /></>,
  latihan: <path d="M12 3c3 4 6 6 6 10a6 6 0 01-12 0c0-2 1-4 3-5 0 2 1 3 2 3 0-3 0-5 1-8z" />,
  sambut: <><circle cx="12" cy="5" r="2" /><path d="M12 7v14M8 11h8M5 15c1 3 3.5 5 7 5s6-2 7-5" /></>
};
const Svg = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) =>
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

function Gauge({ p, col }: { p: number | null; col: string }) {
  const q = Math.max(0, Math.min(1, p ?? 0)), a = Math.PI * (1 - q), x = 60 + 48 * Math.cos(a), y = 62 - 48 * Math.sin(a);
  return <svg viewBox="0 0 120 70" width="100%" height="76" aria-hidden="true">
    <path d="M12 62A48 48 0 0 1 108 62" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={10} strokeLinecap="round" />
    {p !== null && q > 0 && <path d={`M12 62A48 48 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />}
  </svg>;
}

export default function VesselModel3D({ supabase, unitId, userId, role, canAccessClassV }: Props) {
  const isAdmin = role === "admin", canManage = role === "admin" || role === "commander";
  const canOperate = ["admin", "commander", "officer", "operator"].includes(role);

  const rootRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), marksRef = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null), panelRef = useRef<HTMLDivElement>(null), engineRef = useRef<Engine | null>(null);
  const [glFail, setGlFail] = useState<"" | "nogl" | "lost">("");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const el = rootRef.current; if (!el) return; const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 600)); ro.observe(el); return () => ro.disconnect(); }, []);

  const [mode, setModeState] = useState<Mode>("sambut");
  const [panelMin, setPanelMin] = useState(false);
  const [notice, setNotice] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /* data from Supabase */
  const [gps, setGps] = useState<Gps | null>(null);
  const [supply, setSupply] = useState<Supply[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [unlinkedOpen, setUnlinkedOpen] = useState(0);
  const [assetByPart, setAssetByPart] = useState<Record<string, string>>({});
  const [watch, setWatch] = useState<Watch | null>(null);
  const [loadErr, setLoadErr] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  /* per-view state */
  const [part, setPart] = useState("m2");
  const [faultText, setFaultText] = useState(""), [faultPrio, setFaultPrio] = useState("Sedang");
  const [sounding, setSounding] = useState<Record<string, string>>({});
  const [deck, setDeck] = useState<"semua" | Deck>("semua"), [room, setRoom] = useState<string | null>(null);
  const [sim, setSim] = useState<{ cog: number; sog: number } | null>(null);
  const [drill, setDrill] = useState<Record<string, Drill>>({}), [drillDeck, setDrillDeck] = useState<Deck>("bawah");
  const [drillT0, setDrillT0] = useState<number | null>(null), [drillAcc, setDrillAcc] = useState(0);
  const [replayDate, setReplayDate] = useState(""), [replayRows, setReplayRows] = useState<TrackPoint[]>([]), [replayLogs, setReplayLogs] = useState<LogPoint[]>([]);
  const [replayDemo, setReplayDemo] = useState(false), [replayBusy, setReplayBusy] = useState(false), [replayErr, setReplayErr] = useState("");
  const [rf, setRf] = useState(0), [playing, setPlaying] = useState(false);

  const setMode = useCallback((m: Mode) => {
    setModeState(m); setRoom(null); setNotice(null); setPanelMin(false);
    if (m !== "sambut") { try { sessionStorage.setItem("alnav-dms-3d-seen", "1"); } catch { /* storage unavailable */ } }
  }, []);
  useEffect(() => { try { if (sessionStorage.getItem("alnav-dms-3d-seen")) setModeState("status"); } catch { /* storage unavailable */ } }, []);

  /* ---------- loading ---------- */
  const loadCore = useCallback(async () => {
    const [g, s, f, a, w] = await Promise.all([
      supabase.from("vessel_gps_positions").select("position_at,latitude,longitude,speed_knots,course_degrees,source,accuracy_m").eq("unit_id", unitId).order("position_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,unit_of_measure,updated_at").eq("unit_id", unitId).eq("is_active", true).in("category", ["BBM", "Air Tawar"]),
      supabase.from("maintenance_records").select("id,asset_id,report_date,issue_description,status,completed_at,created_at").eq("unit_id", unitId).order("created_at", { ascending: false }).limit(300),
      supabase.from("maintenance_assets").select("id,asset_code").eq("unit_id", unitId).like("asset_code", "3D-%"),
      supabase.from("daily_watch_assignments").select("duty_role,watch_type,new_watch_name,new_watch_rank").eq("unit_id", unitId).eq("duty_date", localDate()).maybeSingle()
    ]);
    const errs: Record<string, string> = {};
    if (g.error) errs.gps = g.error.message; else setGps(g.data ? { ...g.data, latitude: Number(g.data.latitude), longitude: Number(g.data.longitude), speed_knots: num(g.data.speed_knots), course_degrees: num(g.data.course_degrees), accuracy_m: num(g.data.accuracy_m) } : null);
    if (s.error) errs.supply = s.error.message; else setSupply((s.data || []).map((r: any) => ({ id: r.id, item_name: r.item_name, category: r.category, capacity: num(r.capacity_liters), stock: num(r.stock_ready), unit: r.unit_of_measure, updated_at: r.updated_at })));
    const assetPart: Record<string, string> = {}, partAsset: Record<string, string> = {};
    if (!a.error) for (const r of a.data || []) { const pid = CODE2PART[String(r.asset_code).toUpperCase()]; if (pid) { assetPart[r.id] = pid; partAsset[pid] = r.id; } }
    setAssetByPart(partAsset);
    if (f.error) errs.faults = f.error.message;
    else {
      let unlinked = 0;
      const list: Fault[] = [];
      for (const r of f.data || []) {
        const desc = String(r.issue_description || ""), m = TAG.exec(desc);
        const pid = (r.asset_id && assetPart[r.asset_id]) || (m ? CODE2PART[m[1].toUpperCase()] : undefined) || null;
        if (!pid) { if (OPEN.includes(r.status)) unlinked++; continue; }
        const body = m ? desc.slice(m[0].length) : desc, pn = PART[pid]?.n;
        list.push({ id: r.id, part: pid, text: pn && body.startsWith(pn + " — ") ? body.slice(pn.length + 3) : body, status: r.status, report_date: r.report_date, created_at: r.created_at, completed_at: r.completed_at });
      }
      setFaults(list); setUnlinkedOpen(unlinked);
    }
    if (w.error) errs.watch = w.error.message; else setWatch(w.data || null);
    setLoadErr(errs); setLoaded(true); setNow(Date.now());
  }, [supabase, unitId]);

  useEffect(() => {
    let alive = true;
    const run = () => { if (alive && !document.hidden) loadCore().catch(() => setLoadErr({ all: "Data belum dapat dimuat. Periksa koneksi." })); };
    run();
    const id = window.setInterval(run, 60_000), onVis = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [loadCore]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(id); }, []);

  /* ---------- derived ---------- */
  const gpsAgeMin = gps ? (now - new Date(gps.position_at).getTime()) / 60000 : null;
  const gpsLive = !!gps && gpsAgeMin !== null && gpsAgeMin <= (gps.source === "admin_device_gps" ? 2 : 15);
  const openFaults = useMemo(() => faults.filter(f => OPEN.includes(f.status)), [faults]);
  const openByPart = useMemo(() => { const m: Record<string, number> = {}; for (const f of openFaults) if (f.part) m[f.part] = (m[f.part] || 0) + 1; return m; }, [openFaults]);
  const tankInfo = useMemo(() => {
    const out: Record<string, { row: Supply | null; frac: number | null }> = {};
    for (const t of TANKS) { const row = supply.find(r => r.category === t.category) || null; const frac = row && row.capacity && row.capacity > 0 && row.stock !== null ? Math.max(0, row.stock / row.capacity) : null; out[t.id] = { row, frac }; }
    return out;
  }, [supply]);
  const roomLocked = (id: string) => ROOM[id]?.type === "terbatas" && !canAccessClassV;
  const roomName = (id: string) => roomLocked(id) ? "Ruang terbatas" : ROOM[id]?.n ?? id;
  const pjName = watch && (watch.new_watch_name || "").trim() ? [watch.new_watch_rank, watch.new_watch_name].filter(Boolean).join(" ") : null;

  function sysStatus(id: SysId): [Tone, string] {
    if (id === "bbm" || id === "aw") {
      const t = tankInfo[id]; if (loadErr.supply || !t || t.frac === null || !t.row) return ["none", "Belum ada data"];
      return [t.frac < 0.15 ? "bad" : t.frac < 0.3 ? "warn" : "info", Math.round(t.frac * 100) + "% · " + nf(t.row.stock ?? 0) + " L"];
    }
    if (loadErr.faults) return ["none", "Laporan kerusakan belum dapat dimuat"];
    const n = openFaults.filter(f => f.part && PART[f.part]?.sys === id).length;
    if (n) return ["bad", n + " kerusakan terbuka"];
    if (id === "gps") { if (!gps) return ["none", "Belum ada data posisi"]; return gpsLive ? ["live", "Live · " + fmtT(gps.position_at)] : ["warn", "Data lama · " + fmtT(gps.position_at)]; }
    return ["info", "Tidak ada laporan kerusakan"];
  }

  /* replay track */
  const track: TrackPoint[] = replayDemo ? DEMO_TRACK : replayRows;
  const rp = track.length >= 2 ? trackAt(track, rf) : null;

  const nav = useMemo(() => {
    if (mode === "telemetri") {
      if (sim) return { cog: sim.cog, sog: sim.sog };
      if (gpsLive && gps && gps.course_degrees !== null && (gps.speed_knots ?? 0) >= 0.5) return { cog: gps.course_degrees, sog: gps.speed_knots ?? 0 };
    }
    if (mode === "putar-ulang" && rp && rp.cog !== null) return { cog: rp.cog, sog: rp.sog ?? 0 };
    return { cog: null as number | null, sog: 0 };
  }, [mode, sim, gpsLive, gps, rp]);

  /* ---------- engine ---------- */
  const onMarkerRef = useRef<(k: string) => void>(() => {});
  useEffect(() => {
    const cv = canvasRef.current, marks = marksRef.current;
    if (!cv || !marks) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let eng: Engine | null = null;
    try {
      eng = createEngine(cv, {
        marks, reducedMotion: reduced, onMarker: k => onMarkerRef.current(k), onLost: () => setGlFail("lost"),
        getPads: () => {
          const root = rootRef.current?.getBoundingClientRect(); if (!root) return {};
          const pads = { L: 0, R: 0, T: 0, B: 0 };
          const bar = modesRef.current?.getBoundingClientRect();
          if (bar) { if (bar.top > root.top + root.height / 2) pads.B = Math.max(pads.B, root.bottom - bar.top + 8); else pads.T = Math.max(pads.T, bar.bottom - root.top + 8); }
          const pn = panelRef.current, pr = pn && pn.offsetParent ? pn.getBoundingClientRect() : null;
          if (pr) { if (pr.left > root.left + root.width / 2) pads.R = root.right - pr.left + 8; else if (pr.top > root.top + root.height * 0.3) pads.B = Math.max(pads.B, root.bottom - pr.top + 8); }
          return pads;
        }
      });
    } catch (e) { console.error("Modul 3D gagal dimulai", e); eng = null; }
    if (!eng) { setGlFail("nogl"); return; }
    engineRef.current = eng;
    return () => { eng?.destroy(); engineRef.current = null; };
  }, []);

  useEffect(() => { engineRef.current?.set({ mode }); }, [mode, glFail]);
  useEffect(() => { const id = window.setTimeout(() => engineRef.current?.view(true), 60); return () => window.clearTimeout(id); }, [panelMin]);

  const roomTints = useMemo(() => {
    const t: Record<string, number[]> = {};
    for (const r of ROOMS) {
      let c: Rgb = r.type === "terbatas" && canAccessClassV ? TYPEC.senjata : TYPEC[r.type], a = 0.36;
      if (mode === "geladak") { if (deck !== "semua" && r.deck !== deck) continue; }
      else if (mode === "jaga") { const posts = POSTS.filter(p => p.room === r.id); a = posts.length ? (posts.some(p => p.id === "pj") && pjName ? 0.55 : 0.2) : 0.08; }
      else if (mode === "latihan") { if (r.deck !== drillDeck) continue; const s = drill[r.id]; if (s) { c = DRILLC[s]; a = 0.72; } else a = 0.16; }
      else continue;
      if (room === r.id) { a = Math.min(0.85, a + 0.35); c = c.map(v => Math.min(1, v * 1.15)) as Rgb; }
      t[r.id] = [c[0], c[1], c[2], a];
    }
    return t;
  }, [mode, deck, drillDeck, drill, room, pjName, canAccessClassV]);

  const markers = useMemo<EngineMarker[]>(() => {
    const L: EngineMarker[] = [];
    if (mode === "status") for (const s of SYS) {
      const [k, t] = sysStatus(s.id);
      const short = k === "info" ? "" : k === "none" ? " · —" : k === "live" ? " · Live" : k === "warn" && s.id === "gps" ? " · data lama" : /kerusakan/.test(t) ? " · " + t.replace(" kerusakan terbuka", " rusak") : " · " + t.split(" · ")[0];
      L.push({ key: "sys:" + s.id, p: s.p, label: s.n + short, col: COL[k], lb: !narrow || k !== "info", pulse: k === "bad" && /rusak|kerusakan/.test(t) });
    }
    else if (mode === "kerusakan") for (const p of PARTS) { const n = openByPart[p.id] || 0; L.push({ key: "part:" + p.id, p: p.p, label: p.n + (n ? " · " + n + " terbuka" : ""), col: n ? COL.bad : COL.info, sel: part === p.id, pulse: n > 0 }); }
    else if (mode === "tangki") for (const t of TANKS) { const f = tankInfo[t.id]?.frac ?? null; L.push({ key: "tank:" + t.id, p: [(t.x0 + t.x1) / 2, 0, t.z1 + 0.4], label: t.short + " · " + (f === null ? "—" : Math.round(f * 100) + "%"), col: rgb(t.col), lb: true }); }
    else if (mode === "geladak") for (const r of ROOMS) { if (deck !== "semua" && r.deck !== deck) continue; const lock = roomLocked(r.id); L.push({ key: "room:" + r.id, r: r.id, label: roomName(r.id), col: rgb(lock ? TYPEC.terbatas : r.type === "terbatas" ? TYPEC.senjata : TYPEC[r.type]), sel: room === r.id }); }
    else if (mode === "jaga") for (const p of POSTS) { const name = p.id === "pj" ? pjName : null; L.push({ key: "post:" + p.id, p: p.p, label: p.n + " · " + (name || "—"), col: name ? COL.live : COL.none, lb: true }); }
    else if (mode === "latihan") for (const r of ROOMS) { if (r.deck !== drillDeck) continue; const s = drill[r.id]; L.push({ key: "drill:" + r.id, r: r.id, label: (roomLocked(r.id) ? "Kompartemen terbatas" : r.n) + (s ? " · " + DRILLN[s] : ""), col: s ? rgb(DRILLC[s]) : COL.none, lb: !!s, pulse: !!s }); }
    else if ((mode === "telemetri" || mode === "putar-ulang") && nav.cog !== null) L.push({ key: "n", w: [0, 0.1, -38], label: "U (utara)", col: "var(--v3d-red)", lb: true });
    return L;
  }, [mode, part, deck, room, drillDeck, drill, openByPart, tankInfo, pjName, gps, gpsLive, loadErr, nav.cog === null, canAccessClassV, narrow]);

  useEffect(() => { engineRef.current?.set({ markers }); }, [markers, glFail]);
  useEffect(() => {
    const tanks: Record<string, number> = {};
    for (const t of TANKS) { const f = tankInfo[t.id]?.frac; if (f !== null && f !== undefined) tanks[t.id] = f; }
    engineRef.current?.set({ roomTints, tanks, faultParts: mode === "kerusakan" || mode === "status" ? Object.keys(openByPart) : [], part: mode === "kerusakan" ? part : null, ringOn: mode === "telemetri" || mode === "putar-ulang", nav });
  }, [roomTints, tankInfo, openByPart, part, mode, nav, glFail]);

  /* ---------- marker clicks ---------- */
  const goSys = (id: SysId) => {
    const s = SYS.find(x => x.id === id); if (!s) return;
    setMode(s.mode);
    if (s.mode === "kerusakan") { const withFault = PARTS.find(p => p.sys === id && openByPart[p.id]); const first = withFault || PARTS.find(p => p.sys === id); if (first) setPart(first.id); }
  };
  onMarkerRef.current = (key: string) => {
    const [k, id] = key.split(":");
    if (k === "sys") goSys(id as SysId);
    else if (k === "part") setPart(id);
    else if (k === "tank") document.getElementById("v3d-tank-" + id)?.focus();
    else if (k === "room") setRoom(r => r === id ? null : id);
    else if (k === "drill") setDrill(d => { const n = DRILL_NEXT[d[id] || "none"]; const c = { ...d }; if (n) c[id] = n; else delete c[id]; return c; });
  };

  /* ---------- writes (same tables and rules as the rest of the app) ---------- */
  async function reportFault() {
    const p = PART[part], text = faultText.trim();
    if (!canOperate || !p) { setNotice({ text: "Akun ini tidak dapat membuat laporan kerusakan.", err: true }); return; }
    if (!text) { setNotice({ text: "Uraian kerusakan wajib diisi.", err: true }); return; }
    setBusy(true); setNotice(null);
    const issue = `[${assetCode(p)}] ${p.n} — Prioritas ${faultPrio.toLowerCase()}: ${text}`.slice(0, 600);
    const { error } = await supabase.from("maintenance_records").insert({ unit_id: unitId, asset_id: assetByPart[p.id] || null, report_date: localDate(), issue_description: issue, status: "reported", reported_by: userId });
    if (error) setNotice({ text: "Laporan gagal disimpan: " + error.message, err: true });
    else { setFaultText(""); setNotice({ text: "Laporan kerusakan tercatat di Maintenance dengan status Dilaporkan." }); await loadCore(); }
    setBusy(false);
  }
  async function setFaultStatus(f: Fault, status: FaultStatus) {
    if (!canManage) { setNotice({ text: "Hanya Admin atau Komandan yang dapat mengubah status pemeliharaan.", err: true }); return; }
    setBusy(true); setNotice(null);
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "completed") payload.completed_at = new Date().toISOString();
    const { error } = await supabase.from("maintenance_records").update(payload).eq("id", f.id).eq("unit_id", unitId);
    if (error) setNotice({ text: "Status gagal diperbarui: " + error.message, err: true });
    else { setNotice({ text: "Status diperbarui: " + FS[status] + "." }); await loadCore(); }
    setBusy(false);
  }
  async function saveSounding(tankId: string) {
    const t = TANKS.find(x => x.id === tankId), row = tankInfo[tankId]?.row;
    if (!isAdmin) { setNotice({ text: "Hanya Admin yang dapat mengubah data Air Tawar dan HSD.", err: true }); return; }
    if (!t || !row) { setNotice({ text: "Data persediaan untuk tangki ini belum ada.", err: true }); return; }
    const target = Number(sounding[tankId]), cap = row.capacity;
    if (!cap || cap <= 0) { setNotice({ text: "Kapasitas tangki belum diisi. Atur kapasitas di Dashboard.", err: true }); return; }
    if (sounding[tankId] === undefined || sounding[tankId].trim() === "" || !Number.isFinite(target) || target < 0 || target > cap) { setNotice({ text: `Isi antara 0 dan ${nf(cap)} liter.`, err: true }); return; }
    const delta = target - (row.stock ?? 0);
    if (delta === 0) { setNotice({ text: "Tidak ada perubahan saldo." }); return; }
    setBusy(true); setNotice(null);
    const label = t.category === "Air Tawar" ? "Air Tawar" : "HSD";
    const { error } = await supabase.from("stock_movements").insert({ unit_id: unitId, item_id: row.id, movement_type: delta > 0 ? "inbound" : "outbound", quantity: Math.abs(delta), movement_date: localDate(), condition_status: "not_applicable", movement_purpose: "Hasil sounding tangki melalui Modul 3D", notes: "Penyesuaian saldo " + label, recorded_by: userId });
    if (error) setNotice({ text: "Penyesuaian stok gagal: " + error.message, err: true });
    else { setSounding(s => ({ ...s, [tankId]: "" })); setNotice({ text: `Saldo ${label} diperbarui. Penyesuaian tercatat pada riwayat transaksi stok.` }); await loadCore(); }
    setBusy(false);
  }

  /* ---------- replay ---------- */
  useEffect(() => { if (!replayDate && gps) setReplayDate(localDate(new Date(gps.position_at))); else if (!replayDate && loaded && !gps) setReplayDate(localDate()); }, [gps, loaded, replayDate]);
  useEffect(() => {
    if (mode !== "putar-ulang" || !replayDate) return;
    let alive = true;
    (async () => {
      setReplayBusy(true); setReplayErr("");
      const start = new Date(replayDate + "T00:00:00+07:00"), end = new Date(start.getTime() + 864e5);
      const [g, l] = await Promise.all([
        supabase.from("vessel_gps_positions").select("position_at,latitude,longitude,speed_knots,course_degrees").eq("unit_id", unitId).gte("position_at", start.toISOString()).lt("position_at", end.toISOString()).order("position_at", { ascending: true }).limit(5000),
        supabase.from("activity_logs").select("activity_time,title").eq("unit_id", unitId).eq("activity_date", replayDate).not("activity_time", "is", null).order("activity_time", { ascending: true }).limit(200)
      ]);
      if (!alive) return;
      if (g.error) { setReplayErr(g.error.message); setReplayRows([]); }
      else setReplayRows(gpsTrack((g.data || []).map((r: any) => ({ position_at: r.position_at, latitude: Number(r.latitude), longitude: Number(r.longitude), speed_knots: num(r.speed_knots), course_degrees: num(r.course_degrees) }))));
      setReplayLogs(l.error ? [] : (l.data || []).map((r: any) => ({ t: new Date(replayDate + "T" + String(r.activity_time).slice(0, 8) + "+07:00").getTime(), title: String(r.title || "") })).filter((x: LogPoint) => Number.isFinite(x.t)));
      setRf(0); setPlaying(false); setReplayBusy(false);
    })().catch(() => { if (alive) { setReplayErr("Jejak belum dapat dimuat."); setReplayBusy(false); } });
    return () => { alive = false; };
  }, [mode, replayDate, supabase, unitId]);
  useEffect(() => {
    if (!playing || mode !== "putar-ulang") return;
    let raf = 0, last = performance.now();
    const step = (t: number) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; setRf(f => { const n = f + dt / REPLAY_SECONDS; if (n >= 1) { setPlaying(false); return 1; } return n; }); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode]);
  const jumpTo = (t: number) => { if (track.length < 2) return; const t0 = track[0].t, t1 = track[track.length - 1].t; setRf(Math.max(0, Math.min(1, (t - t0) / Math.max(1, t1 - t0)))); setPlaying(false); };
  const logsOnTrack: LogPoint[] = replayDemo ? DEMO_LOGS.map(([f, title]) => ({ t: DEMO_TRACK[0].t + f * (DEMO_TRACK[DEMO_TRACK.length - 1].t - DEMO_TRACK[0].t), title })) : replayLogs;

  /* ---------- drill timer ---------- */
  useEffect(() => { if (drillT0 === null) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [drillT0]);
  const drillMs = drillAcc + (drillT0 !== null ? Math.max(0, now - drillT0) : 0);
  const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

  /* ---------- fullscreen ---------- */
  const [fsOk, setFsOk] = useState(false);
  useEffect(() => { setFsOk(!!document.fullscreenEnabled); }, []);
  const toggleFs = () => { const el = rootRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else el.requestFullscreen().catch(() => {}); };

  /* ---------- panels ---------- */
  const modeInfo = MODES.find(m => m[0] === mode) || MODES[0];
  const chev = <Svg size={16}><path d="M9 6l6 6-6 6" /></Svg>;
  const errLine = (k: string) => loadErr[k] || loadErr.all ? <p className="v3d-msg err">Data belum dapat dimuat: {loadErr[k] || loadErr.all}</p> : null;

  let banner: { text: string; col: string } | null = null;
  if (mode === "latihan") banner = { text: "LATIHAN · tidak tersimpan sebagai kejadian nyata", col: "var(--v3d-bad)" };
  else if (mode === "putar-ulang" && replayDemo) banner = { text: "DEMO · jejak contoh, bukan data kapal", col: "var(--v3d-demo)" };
  else if (mode === "telemetri" && sim) banner = { text: "DEMO · telemetri simulasi, tidak disimpan", col: "var(--v3d-demo)" };

  function panelBody() {
    switch (mode) {
      case "status": return <>
        {errLine("all")}
        <p className="v3d-note">Warna mengikuti data yang ada. Hijau hanya untuk data live; biru berarti tidak ada laporan kerusakan, bukan berarti "sehat"; abu berarti belum ada data.</p>
        <div className="v3d-list">{SYS.map(s => { const [k, t] = sysStatus(s.id); return <button type="button" key={s.id} className="v3d-row" onClick={() => goSys(s.id)}><span className="v3d-dot" style={{ background: COL[k] }} /><span className="v3d-grow"><b>{s.n}</b><small>{t}</small></span>{chev}</button>; })}</div>
        <div className="v3d-legend">{([["live", "Live"], ["info", "Tanpa laporan"], ["warn", "Perhatian / data lama"], ["bad", "Rusak / kritis"], ["none", "Belum ada data"]] as Array<[Tone, string]>).map(([k, l]) => <span key={k}><i className="v3d-dot" style={{ background: COL[k] }} />{l}</span>)}</div>
        <p className="v3d-note">Tangki: kuning di bawah 30%, merah di bawah 15%.</p>
      </>;
      case "telemetri": {
        const chip: [Tone, string] = sim ? ["demo", "DEMO"] : gps ? (gpsLive ? ["live", "Live"] : ["warn", "Data lama"]) : ["none", "Tidak ada data"];
        return <>
          {errLine("gps")}
          <div className="v3d-between"><span className="v3d-kicker">Sumber: {sim ? "Simulasi (tidak disimpan)" : gps ? SRC[gps.source] || gps.source : "—"}</span><span className="v3d-chip" style={{ color: COL[chip[0]] }}>{chip[1]}</span></div>
          <div className="v3d-grid2">
            <div className="v3d-cell" style={{ gridColumn: "1 / -1" }}><small>Posisi{gps && !sim ? " · " + fmtT(gps.position_at) : ""}</small><b style={{ fontSize: 15 }}>{gps && !sim ? dm(gps.latitude, "U", "S") + "  " + dm(gps.longitude, "T", "B") : "—"}</b>{gps && !sim && gps.accuracy_m !== null && <small>Akurasi ±{nf(gps.accuracy_m)} m</small>}</div>
            <div className="v3d-cell"><small>SOG</small><b>{sim ? sim.sog + " kn" : gps && gps.speed_knots !== null ? gps.speed_knots.toFixed(1) + " kn" : "—"}</b></div>
            <div className="v3d-cell"><small>COG</small><b>{sim ? deg3(sim.cog) : gps && gps.course_degrees !== null ? deg3(gps.course_degrees) : "—"}</b></div>
            <div className="v3d-cell" style={{ gridColumn: "1 / -1" }}><small>Heading</small><b>—</b><small>Butuh gyro/AHRS; belum ada di sistem</small></div>
          </div>
          <label className="v3d-sw"><input type="checkbox" checked={!!sim} onChange={e => setSim(e.target.checked ? { cog: gps?.course_degrees !== null && gps?.course_degrees !== undefined ? Math.round(gps.course_degrees) : 45, sog: 12 } : null)} />Simulasi telemetri (DEMO)</label>
          {sim && <>
            <label className="v3d-f">COG {deg3(sim.cog)}<input type="range" min={0} max={359} value={sim.cog} onChange={e => setSim({ ...sim, cog: Number(e.target.value) })} /></label>
            <label className="v3d-f">SOG {sim.sog} knot<input type="range" min={0} max={27} value={sim.sog} onChange={e => setSim({ ...sim, sog: Number(e.target.value) })} /></label>
          </>}
          <p className="v3d-note">Model diputar menurut COG (arah lintasan), bukan heading. Kapal hanya diputar dan diberi buih bila data live dan kecepatan minimal 0,5 knot; selain itu kapal tampil diam dan lingkar kompas disembunyikan.</p>
          <button type="button" className="v3d-btn s" onClick={() => loadCore()}>Muat ulang posisi</button>
        </>;
      }
      case "kerusakan": {
        const p = PART[part], here = openFaults.filter(f => f.part === part);
        return <>
          {errLine("faults")}
          <label className="v3d-f">Bagian kapal<select value={part} onChange={e => setPart(e.target.value)}>{PARTS.map(x => <option key={x.id} value={x.id}>{x.n}{openByPart[x.id] ? " ●" : ""}</option>)}</select></label>
          {p && <p className="v3d-note">{p.cat} · {p.loc}{here.length ? ` · ${here.length} laporan terbuka` : ""}</p>}
          {canOperate ? <>
            <label className="v3d-f">Uraian kerusakan<textarea maxLength={400} value={faultText} onChange={e => setFaultText(e.target.value)} placeholder="Contoh: getaran tidak normal pada putaran tinggi" /></label>
            <label className="v3d-f">Prioritas<select value={faultPrio} onChange={e => setFaultPrio(e.target.value)}><option>Rendah</option><option>Sedang</option><option>Tinggi</option></select></label>
            <button type="button" className="v3d-btn p" disabled={busy} onClick={reportFault}>Laporkan · {p?.n}</button>
          </> : <p className="v3d-note">Akun viewer hanya dapat melihat laporan.</p>}
          <h3 className="v3d-sub">Laporan terbuka ({openFaults.length})</h3>
          <div className="v3d-list">{openFaults.length ? openFaults.map(f => <div key={f.id} className={"v3d-row" + (f.part === part ? " sel" : "")} style={{ alignItems: "flex-start" }}>
            <span className="v3d-dot" style={{ background: COL.bad, marginTop: 6 }} />
            <span className="v3d-grow"><button type="button" onClick={() => f.part && setPart(f.part)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", fontWeight: 600, fontSize: 14 }}>{f.part ? PART[f.part]?.n : "—"}</button><small>{f.text}</small><small>{FS[f.status]} · {fmtT(f.created_at)}</small></span>
            {canManage && <span className="v3d-actions" style={{ flexDirection: "column" }}>
              {f.status !== "in_progress" && <button type="button" className="v3d-btn s" disabled={busy} onClick={() => setFaultStatus(f, "in_progress")}>Kerjakan</button>}
              <button type="button" className="v3d-btn s" disabled={busy} onClick={() => setFaultStatus(f, "completed")}>Selesai</button>
            </span>}
          </div>) : <p className="v3d-note">Tidak ada laporan kerusakan terbuka yang terhubung ke model.</p>}</div>
          {unlinkedOpen > 0 && <p className="v3d-note">{unlinkedOpen} laporan terbuka lain tidak terhubung ke bagian kapal di model. Lihat di menu Maintenance.</p>}
          <p className="v3d-note">Laporan masuk ke Maintenance dengan status Dilaporkan. Hanya Admin atau Komandan yang dapat mengubah status.</p>
        </>;
      }
      case "tangki": return <>
        {errLine("supply")}
        {TANKS.map(t => {
          const info = tankInfo[t.id], row = info?.row || null, f = info?.frac ?? null;
          return <div key={t.id} className="v3d-cell" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="v3d-between"><b style={{ fontSize: 15 }}>{t.n}</b><small>{row && row.capacity ? "kapasitas " + nf(row.capacity) + " L" : "kapasitas —"}</small></div>
            <div style={{ textAlign: "center" }}><Gauge p={f} col={rgb(t.col)} /><div style={{ marginTop: -30, fontSize: 22, fontWeight: 600 }}>{f === null ? "—" : Math.round(f * 100) + "%"}</div><small>{row && row.stock !== null ? nf(row.stock) + " L" + (row.updated_at ? " · " + fmtT(row.updated_at) : "") : "Belum ada data"}</small></div>
            {isAdmin && row && <div style={{ display: "flex", gap: 8 }}>
              <input id={"v3d-tank-" + t.id} type="number" min={0} max={row.capacity ?? undefined} step={100} inputMode="numeric" placeholder="Liter hasil sounding" aria-label={"Liter " + t.n} value={sounding[t.id] ?? ""} onChange={e => setSounding(s => ({ ...s, [t.id]: e.target.value }))} style={{ flex: 1 }} />
              <button type="button" className="v3d-btn" disabled={busy} onClick={() => saveSounding(t.id)}>Simpan</button>
            </div>}
          </div>;
        })}
        <p className="v3d-note">Isi tangki diambil dari persediaan Air Tawar dan BBM (HSD) yang sama dengan Dashboard. {isAdmin ? "Menyimpan hasil sounding mencatat penyesuaian saldo pada riwayat transaksi stok." : "Hanya Admin yang dapat memperbarui isi tangki."} Letak tangki di model skematik karena gambar rencana tidak menunjukkan tangki.</p>
      </>;
      case "geladak": {
        const rs = ROOMS.filter(r => deck === "semua" || r.deck === deck), types = [...new Set(rs.map(r => roomLocked(r.id) ? "terbatas" : r.type))];
        return <>
          <div className="v3d-seg" role="group" aria-label="Pilih geladak">{([["semua", "Semua"], ["atas", "Atas"], ["utama", "Utama"], ["bawah", "Bawah"]] as Array<["semua" | Deck, string]>).map(([v, l]) => <button type="button" key={v} aria-pressed={deck === v} onClick={() => { setDeck(v); setRoom(null); }}>{l}</button>)}</div>
          <div className="v3d-list">{rs.map(r => { const lock = roomLocked(r.id); return <button type="button" key={r.id} className={"v3d-row" + (room === r.id ? " sel" : "")} style={{ minHeight: 46 }} onClick={() => setRoom(x => x === r.id ? null : r.id)}><span className="v3d-sq" style={{ background: rgb(lock ? TYPEC.terbatas : r.type === "terbatas" ? TYPEC.senjata : TYPEC[r.type]) }} /><span className="v3d-grow"><b>{roomName(r.id)}</b><small>{DECKN[r.deck]}</small></span></button>; })}</div>
          <div className="v3d-legend">{types.map(t => <span key={t}><i className="v3d-sq" style={{ background: rgb(TYPEC[t]) }} />{TYPEN[t]}</span>)}</div>
          <p className="v3d-note">Ruangan dipetakan dari denah navigation, main dan lower deck. Ruang yang labelnya tidak terbaca di denah tidak dimasukkan.{canAccessClassV ? "" : " Nama ruang terbatas disembunyikan untuk akun tanpa hak Kelas V."}</p>
        </>;
      }
      case "jaga": return <>
        {errLine("watch")}
        <span className="v3d-kicker">{new Date().toLocaleDateString("id-ID", { timeZone: WIB, weekday: "long", day: "numeric", month: "long", year: "numeric" })}{watch?.watch_type ? " · " + watch.watch_type : ""}</span>
        <div className="v3d-list">{POSTS.map(p => { const name = p.id === "pj" ? pjName : null; return <div key={p.id} className="v3d-row"><span className="v3d-dot" style={{ background: name ? COL.live : COL.none }} /><span className="v3d-grow"><b>{p.n}</b><small>{p.id === "pj" ? name || "Belum ada penugasan hari ini" : "— · belum ada sumber data"}</small><small>{p.room ? roomName(p.room) : "Geladak buritan"}</small></span></div>; })}</div>
        <p className="v3d-note">Perwira jaga diambil dari penugasan jaga harian di Logbook dan diubah di sana. Pos lain belum tercatat di sistem, jadi ditampilkan "—".</p>
      </>;
      case "putar-ulang": {
        let map: React.ReactNode = null;
        if (track.length >= 2) {
          const xs = track.map(p => p.e), ys = track.map(p => p.n), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const s = Math.min(280 / Math.max(x1 - x0, 1e-3), 150 / Math.max(y1 - y0, 1e-3)), X = (e: number) => 20 + (e - x0) * s, Y = (n: number) => 170 - (n - y0) * s;
          const pts = track.length > 800 ? track.filter((_, i) => i % Math.ceil(track.length / 800) === 0 || i === track.length - 1) : track;
          map = <svg className="v3d-svgmap" viewBox="0 0 320 190" role="img" aria-label="Peta jejak pelayaran">
            <polyline points={pts.map(p => X(p.e).toFixed(1) + "," + Y(p.n).toFixed(1)).join(" ")} fill="none" stroke={replayDemo ? "rgba(185,163,255,.75)" : "rgba(127,178,229,.85)"} strokeWidth={2} />
            {logsOnTrack.map((l, i) => { if (l.t < track[0].t || l.t > track[track.length - 1].t) return null; const q = trackAt(track, (l.t - track[0].t) / Math.max(1, track[track.length - 1].t - track[0].t)); return <circle key={i} cx={X(q.e)} cy={Y(q.n)} r={4} fill="#0b1626" stroke="#E8EEF5" strokeWidth={2} />; })}
            {rp && <g transform={`translate(${X(rp.e).toFixed(1)} ${Y(rp.n).toFixed(1)}) rotate(${rp.cog ?? 0})`}><path d={rp.cog !== null ? "M0 -9L6 7L0 3L-6 7Z" : "M0 -5A5 5 0 1 0 0.01 -5Z"} fill="#E6121C" /></g>}
            <text x={300} y={22} fill="#A3B2C4" fontSize={12} textAnchor="middle">U</text><path d="M300 28v14" stroke="#A3B2C4" strokeWidth={2} />
          </svg>;
        }
        return <>
          <label className="v3d-f">Tanggal (WIB)<input type="date" value={replayDate} max={localDate()} onChange={e => { setReplayDemo(false); setReplayDate(e.target.value); }} /></label>
          {replayErr && <p className="v3d-msg err">Jejak belum dapat dimuat: {replayErr}</p>}
          {replayBusy && <p className="v3d-note">Memuat jejak…</p>}
          {!replayBusy && !replayDemo && replayRows.length < 2 && <div className="v3d-msg">Belum cukup posisi GPS pada tanggal ini ({replayRows.length} titik), jadi jejak tidak bisa diputar.<div style={{ marginTop: 8 }}><button type="button" className="v3d-btn s" onClick={() => { setReplayDemo(true); setRf(0); }}>Lihat contoh (DEMO)</button></div></div>}
          {replayDemo && <div className="v3d-between"><span className="v3d-chip" style={{ color: COL.demo }}>DEMO · jejak contoh</span><button type="button" className="v3d-btn s" onClick={() => { setReplayDemo(false); setRf(0); setPlaying(false); }}>Data asli</button></div>}
          {map}
          {track.length >= 2 && <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button type="button" className="v3d-btn" style={{ minWidth: 92 }} onClick={() => { if (rf >= 1) setRf(0); setPlaying(p => !p); }}>{playing ? "Jeda" : "Putar"}</button><input type="range" min={0} max={1000} value={Math.round(rf * 1000)} onChange={e => { setRf(Number(e.target.value) / 1000); setPlaying(false); }} aria-label="Waktu" /></div>
            <div className="v3d-grid2"><div className="v3d-cell"><small>Waktu</small><b>{rp ? fmtHM(rp.t) : "—"}</b></div><div className="v3d-cell"><small>SOG · COG</small><b style={{ fontSize: 15 }}>{rp && rp.sog !== null ? rp.sog.toFixed(1) + " kn" : "—"} · {rp && rp.cog !== null ? deg3(rp.cog) : "—"}</b></div></div>
            {logsOnTrack.length > 0 && <><h3 className="v3d-sub">Catatan {replayDemo ? "contoh" : "Logbook"}</h3><div className="v3d-list">{logsOnTrack.map((l, i) => <button type="button" key={i} className="v3d-row" style={{ minHeight: 46 }} onClick={() => jumpTo(l.t)}><span className="v3d-dot" style={{ background: replayDemo ? COL.demo : COL.info }} /><span className="v3d-grow"><b>{fmtHM(l.t)}</b><small>{l.title}</small></span></button>)}</div></>}
          </>}
          <p className="v3d-note">Jejak dari posisi GPS tersimpan pada tanggal itu. Kapal diputar menurut COG; bila COG tidak terekam, arah dihitung dari dua posisi berurutan.</p>
        </>;
      }
      case "latihan": {
        const marked = Object.entries(drill);
        return <>
          <div className="v3d-seg" role="group" aria-label="Pilih geladak">{([["atas", "Atas"], ["utama", "Utama"], ["bawah", "Bawah"]] as Array<[Deck, string]>).map(([v, l]) => <button type="button" key={v} aria-pressed={drillDeck === v} onClick={() => setDrillDeck(v)}>{l}</button>)}</div>
          <div className="v3d-cell v3d-between"><div><small>Waktu latihan</small><b>{mmss(drillMs)}</b></div><div className="v3d-actions">
            <button type="button" className="v3d-btn s" onClick={() => { if (drillT0 !== null) { setDrillAcc(a => a + Date.now() - drillT0); setDrillT0(null); } else { setDrillT0(Date.now()); setNow(Date.now()); } }}>{drillT0 !== null ? "Berhenti" : "Mulai"}</button>
            <button type="button" className="v3d-btn s" onClick={() => { setDrillT0(null); setDrillAcc(0); }}>Reset</button>
          </div></div>
          <p className="v3d-note">Ketuk titik kompartemen di kapal untuk mengganti status: kebakaran → kebocoran → asap → normal.</p>
          <div className="v3d-list">{marked.length ? marked.map(([id, s]) => <div key={id} className="v3d-row" style={{ minHeight: 46 }}><span className="v3d-sq" style={{ background: rgb(DRILLC[s]) }} /><span className="v3d-grow"><b>{roomLocked(id) ? "Kompartemen terbatas" : ROOM[id]?.n}</b><small>{DRILLN[s]} · {ROOM[id] ? DECKN[ROOM[id].deck] : ""}</small></span></div>) : <p className="v3d-note">Belum ada kompartemen ditandai.</p>}</div>
          {marked.length > 0 && <button type="button" className="v3d-btn" onClick={() => setDrill({})}>Hapus semua tanda</button>}
          <div className="v3d-legend">{(Object.keys(DRILLN) as Drill[]).map(k => <span key={k}><i className="v3d-sq" style={{ background: rgb(DRILLC[k]) }} />{DRILLN[k]}</span>)}</div>
          <p className="v3d-note">Latihan hanya ada di layar ini dan tidak disimpan ke database.</p>
        </>;
      }
      default: return null;
    }
  }

  return <div className="v3d-root" ref={rootRef} data-lenis-prevent>
    <canvas ref={canvasRef} className="v3d-cv" aria-label="Model 3D KRI ALAMANG-644. Seret untuk memutar, cubit atau scroll untuk zoom, Shift+seret untuk menggeser." />
    <div ref={marksRef} className="v3d-marks" />
    {glFail && <div className="v3d-fallback"><p>{glFail === "lost" ? "Tampilan 3D berhenti karena GPU perangkat direset. Buka ulang menu ini untuk memulai lagi." : "Perangkat atau browser ini tidak mendukung WebGL 2, jadi model 3D tidak bisa ditampilkan. Data tetap tersedia di menu lain."}</p></div>}
    {banner && <div className="v3d-banner" style={{ color: banner.col }} role="status">{banner.text}</div>}

    <div ref={modesRef} role="navigation" className="v3d-modes v3d-glass" aria-label="Tampilan modul 3D">
      {MODES.map(([id, label]) => <button type="button" key={id} aria-current={mode === id} title={label} onClick={() => setMode(id)}><Svg>{ICON[id]}</Svg><b>{label}</b></button>)}
      <span className="v3d-tools">
        <button type="button" title="Pusatkan tampilan" aria-label="Pusatkan tampilan" onClick={() => engineRef.current?.view(true)}><Svg><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Svg></button>
        {fsOk && <button type="button" title="Layar penuh" aria-label="Layar penuh" onClick={toggleFs}><Svg><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg></button>}
      </span>
    </div>

    {mode === "sambut" ? <div className="v3d-welcome">
      <div className="v3d-wcard v3d-glass">
        <img className="v3d-logo" src="/branding/alnav-dms-logo.jpg" alt="Logo resmi ALNAV DMS" />
        <div><p>Welcome aboard</p><h1 className="v3d-h">KRI ALAMANG-644</h1></div>
        <p>Status sistem, telemetri, kerusakan, tangki, geladak, jaga, putar ulang dan latihan peran dalam satu model kapal.</p>
        <button type="button" className="v3d-btn p" style={{ minWidth: 180 }} onClick={() => setMode("status")}>Masuk</button>
      </div>
    </div> : <div ref={panelRef} role="complementary" aria-label="Panel informasi model 3D" className={"v3d-panel v3d-glass" + (panelMin ? " min" : "")} aria-live="polite">
      <div className="v3d-ph">
        <div><div className="v3d-kicker">{modeInfo[2]}</div><h2 className="v3d-pt v3d-h">{modeInfo[1]}</h2></div>
        <button type="button" className="v3d-pc" aria-expanded={!panelMin} aria-label={panelMin ? "Buka panel" : "Ciutkan panel"} onClick={() => setPanelMin(v => !v)} style={{ transform: panelMin ? "rotate(180deg)" : undefined }}><Svg><path d="M6 9l6 6 6-6" /></Svg></button>
      </div>
      <div className="v3d-pb">
        {notice && <p className={"v3d-msg" + (notice.err ? " err" : "")} role={notice.err ? "alert" : "status"}>{notice.text}</p>}
        {!loaded && <p className="v3d-note">Memuat data kapal…</p>}
        {panelBody()}
      </div>
    </div>}
  </div>;
}
