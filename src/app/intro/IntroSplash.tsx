"use client";
import { useEffect, useRef, useState } from "react";
import { useNav } from "../NavRuntime";

/* Opening sequence, once per browser session after sign-in:
   a transparent globe turns to the ship's last known GPS position over the
   Indonesian archipelago while the KRI ALAMANG-644 silhouette is revealed in the
   centre, then the overlay opens onto the dashboard (3D ship). Real GPS only:
   with no fix the globe centres on Indonesia and says so. The simulation is
   never used here. Skippable; static under prefers-reduced-motion. */

const KEY = "alnav-intro-seen";
const DURATION = 4300; // ms before the exit transition starts
const EXIT = 750;

type Geo = typeof import("./geo");
const D2R = Math.PI / 180;
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));

export default function IntroSplash() {
  const { gps } = useNav();
  const [show, setShow] = useState(false), [exiting, setExiting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoRef = useRef<Geo | null>(null);
  const targetRef = useRef<{ lon: number; lat: number; real: boolean }>({ lon: 118, lat: -2.5, real: false });
  const doneRef = useRef(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); } catch { /* storage unavailable: show once per load */ }
    if (seen) return;
    setShow(true);
    document.body.classList.add("dg-intro");
    import("./geo").then(m => { geoRef.current = m; });
  }, []);

  useEffect(() => {
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) targetRef.current = { lon: gps.longitude, lat: gps.latitude, real: true };
  }, [gps]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    document.body.classList.remove("dg-intro");
    window.setTimeout(() => setShow(false), EXIT);
  };

  useEffect(() => {
    if (!show) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", key);
    const timer = window.setTimeout(finish, reduced ? 1400 : DURATION);
    const cv = canvasRef.current, ctx = cv?.getContext("2d");
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      if (!cv || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = window.innerHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * (w < 640 ? 0.44 : 0.38), cx = w / 2, cy = h * 0.46;
      const tgt = targetRef.current, k = reduced ? 1 : ease((now - t0) / 2700);
      // end with the ship position in the upper part of the globe so the silhouette does not cover it
      const lon0 = tgt.lon - 150 * (1 - k), lat0 = tgt.lat - 26 + 44 * (1 - k);
      const sl0 = Math.sin(lat0 * D2R), cl0 = Math.cos(lat0 * D2R);
      const proj = (lon: number, lat: number): [number, number, boolean] => {
        const l = (lon - lon0) * D2R, p = lat * D2R, cp = Math.cos(p), sp = Math.sin(p), cl = Math.cos(l);
        const cosc = sl0 * sp + cl0 * cp * cl;
        return [cx + R * cp * Math.sin(l), cy - R * (cl0 * sp - sl0 * cp * cl), cosc > 0];
      };
      const fadeIn = reduced ? 1 : Math.min(1, (now - t0) / 700);
      ctx.globalAlpha = fadeIn;
      // sphere
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "rgba(60,110,170,0.22)"); g.addColorStop(1, "rgba(10,25,45,0.10)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(160,200,240,0.35)"; ctx.lineWidth = 1.2; ctx.stroke();
      // graticule
      ctx.strokeStyle = "rgba(160,200,240,0.10)"; ctx.lineWidth = 0.8;
      const line = (pts: Array<[number, number]>) => { let pen = false; ctx.beginPath(); for (const [lo, la] of pts) { const [x, y, v] = proj(lo, la); if (v) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); };
      for (let lo = -180; lo < 180; lo += 15) line(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5] as [number, number]));
      for (let la = -75; la <= 75; la += 15) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la] as [number, number]));
      // land
      const geo = geoRef.current;
      const rings = (list: number[][], fill: string, stroke: string, lw: number) => {
        for (const r of list) {
          ctx.beginPath(); let pen = false, all = true;
          for (let i = 0; i < r.length; i += 2) { const [x, y, v] = proj(r[i], r[i + 1]); if (!v) { all = false; pen = false; continue; } pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
          if (all) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
          ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
        }
      };
      if (geo) {
        rings(geo.WORLD, "rgba(150,180,215,0.08)", "rgba(150,180,215,0.22)", 0.7);
        rings(geo.NEAR, "rgba(150,180,215,0.10)", "rgba(150,180,215,0.28)", 0.7);
        rings(geo.INDONESIA, "rgba(127,178,229,0.30)", "rgba(190,220,250,0.75)", 0.9);
      }
      // ship position
      const [mx, my, mv] = proj(tgt.lon, tgt.lat);
      if (mv && k > 0.6) {
        const a = Math.min(1, (k - 0.6) / 0.3), pulse = ((now - t0) % 1600) / 1600;
        ctx.globalAlpha = fadeIn * a;
        ctx.strokeStyle = `rgba(231,19,28,${0.7 * (1 - pulse)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mx, my, 6 + pulse * 22, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#E7131C"; ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!doneRef.current || now - t0 < DURATION + EXIT) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); window.removeEventListener("keydown", key); document.body.classList.remove("dg-intro"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;
  const real = !!gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude);
  const dm = (v: number, p: string, n: string) => { const a = Math.abs(v), d = Math.floor(a); return `${d}°${((a - d) * 60).toFixed(1)}′ ${v < 0 ? n : p}`; };
  return <div className={"dg-intro-overlay" + (exiting ? " is-exiting" : "")} role="dialog" aria-modal="true" aria-label="ALNAV DMS opening" data-lenis-prevent>
    <canvas ref={canvasRef} className="dg-intro-globe" aria-hidden="true" />
    <div className="dg-intro-center">
      <img className="dg-intro-ship" src="/images/kri-alamang-644-side.png" alt="KRI ALAMANG-644 silhouette" />
      <div className="dg-intro-text">
        <b className="dg-h">KRI ALAMANG-644</b>
        <span>{real ? `Last ship position · ${dm(gps!.latitude, "N", "S")} ${dm(gps!.longitude, "E", "W")}` : "Indonesian archipelago · no ship position yet"}</span>
      </div>
    </div>
    <img className="dg-intro-logo" src="/branding/alnav-dms-logo.jpg" alt="ALNAV DMS" />
    <button type="button" className="dg-intro-skip" onClick={finish}>Skip</button>
  </div>;
}
