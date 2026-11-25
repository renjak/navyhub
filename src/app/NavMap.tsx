"use client";
import { useEffect, useState } from "react";
import { fixState, useNav } from "./NavRuntime";

/* Map button + modal (OpenStreetMap embed). Shows the simulated position
   only when the simulation is running, always labelled as DEMO. */
export default function NavMapButton({ label = "Buka peta", className = "dg-btn" }: { label?: string; className?: string }) {
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
  const when = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) + " WIB";
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open && <div className="dg-modal" role="dialog" aria-modal="true" aria-label="Peta posisi KRI ALAMANG-644" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="dg-modal-card">
        <div className="dg-card-head">
          <div><div className="dg-eyebrow">Peta maritim Indonesia</div><h2 className="dg-h dg-card-title">Posisi KRI ALAMANG-644</h2></div>
          <button type="button" className="dg-icon-btn" aria-label="Tutup peta" onClick={() => setOpen(false)}>✕</button>
        </div>
        <iframe className="dg-map" title="Peta OpenStreetMap dengan posisi kapal" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="dg-map-foot">
          <span>{sim ? "Posisi SIMULASI (DEMO) · bukan GPS kapal" : gps ? `${st === "live" ? "GPS kapal · live" : st === "proxy" ? "Perangkat Admin (proksi) · live" : "Posisi terakhir · tidak live"} · ${when(gps.position_at)}` : "Belum ada data posisi kapal"}</span>
          <span className="dg-map-actions">
            <button type="button" className="dg-btn" onClick={reload}>Muat ulang</button>
            <a className="dg-btn" href={shown ? `https://www.openstreetmap.org/?mlat=${shown.latitude}&mlon=${shown.longitude}#map=9/${shown.latitude}/${shown.longitude}` : "https://www.openstreetmap.org/#map=5/-2.5/118"} target="_blank" rel="noreferrer">Buka di OpenStreetMap ↗</a>
          </span>
        </div>
      </div>
    </div>}
  </>;
}
