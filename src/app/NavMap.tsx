"use client";
import Portal from "./Portal";
import { useEffect, useState } from "react";
import { fixState, useNav } from "./NavRuntime";

/* Map button + modal (OpenStreetMap embed). Shows the simulated position
   only when the simulation is running, always labelled as DEMO. */
export default function NavMapButton({ label = "Open map", className = "dg-btn", lang = "en" }: { label?: string; className?: string; lang?: "en" | "id" }) {
  const id = lang === "id";
  const { gps, sim, reload } = useNav();
  const [open, setOpen] = useState(false);
  const shown = sim || gps;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const src = "https://www.openstreetmap.org/export/embed.html?bbox=94.5%2C-11.5%2C141.5%2C6.5&layer=mapnik" + (shown ? "&marker=" + encodeURIComponent(shown.latitude + "," + shown.longitude) : "");
  const st = fixState(gps);
  const when = (iso: string) => new Intl.DateTimeFormat(id ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) + " WIB";
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open && <Portal><div className="dg-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-label={id ? "Peta posisi KRI ALAMANG-644" : "KRI ALAMANG-644 position map"} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="dg-modal-card">
        <div className="dg-card-head">
          <div><div className="dg-eyebrow">{id ? "Peta maritim Indonesia" : "Indonesian maritime map"}</div><h2 className="dg-h dg-card-title">{id ? "Posisi KRI ALAMANG-644" : "KRI ALAMANG-644 position"}</h2></div>
          <button type="button" className="dg-icon-btn" aria-label={id ? "Tutup peta" : "Close map"} onClick={() => setOpen(false)}>✕</button>
        </div>
        <iframe className="dg-map" title={id ? "Peta OpenStreetMap dengan posisi kapal" : "OpenStreetMap with ship position"} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="dg-map-foot">
          <span>{sim ? (id ? "Posisi SIMULASI (DEMO) · bukan GPS kapal" : "SIMULATED position (DEMO) · not ship GPS") : gps ? `${st === "live" ? (id ? "GPS kapal · live" : "Ship GPS · live") : st === "proxy" ? (id ? "Perangkat Admin (proksi) · live" : "Admin device (proxy) · live") : (id ? "Posisi terakhir · tidak live" : "Last position · not live")} · ${when(gps.position_at)}` : (id ? "Belum ada data posisi kapal" : "No ship position data yet")}</span>
          <span className="dg-map-actions">
            <button type="button" className="dg-btn" onClick={reload}>{id ? "Muat ulang" : "Reload"}</button>
            <a className="dg-btn" href={shown ? `https://www.openstreetmap.org/?mlat=${shown.latitude}&mlon=${shown.longitude}#map=9/${shown.latitude}/${shown.longitude}` : "https://www.openstreetmap.org/#map=5/-2.5/118"} target="_blank" rel="noreferrer">{id ? "Buka di OpenStreetMap ↗" : "Open in OpenStreetMap ↗"}</a>
          </span>
        </div>
      </div>
    </div></Portal>}
  </>;
}
