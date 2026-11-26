"use client";
import { useEffect, useState } from "react";
import { useNav } from "./NavRuntime";
import NavMapButton from "./NavMap";

/* Logbook · Jaga Laut. Tiga divisi jaga bergantian, masing-masing dua kali sehari (WIB):
   PH-MH 08–12 & 20–24, SH-LM 12–16 & 00–04, SH-DH 04–08 & 16–20.
   Divisi A/B/C dipasangkan sesuai urutan yang diberikan pemilik: A = PH-MH, B = SH-LM, C = SH-DH.
   Posisi dari GPS kapal (atau proksi perangkat Admin); haluan tetap "—" tanpa gyro. */

type Watch = { code: string; name: string; div: "A" | "B" | "C"; ranges: Array<[number, number]> };
const WATCHES: Watch[] = [
  { code: "PH-MH", name: "Pagi–Malam", div: "A", ranges: [[8, 12], [20, 24]] },
  { code: "SH-LM", name: "Siang–Larut Malam", div: "B", ranges: [[12, 16], [0, 4]] },
  { code: "SH-DH", name: "Sore–Dini Hari", div: "C", ranges: [[16, 20], [4, 8]] },
];
const BLOCKS = [0, 4, 8, 12, 16, 20].map(h => ({ start: h, end: h + 4, watch: WATCHES.find(w => w.ranges.some(([s]) => s === h))! }));
const hh = (h: number) => String(h % 24).padStart(2, "0") + ".00";
const wibNow = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()); const h = Number(p.find(x => x.type === "hour")?.value) % 24, m = Number(p.find(x => x.type === "minute")?.value); return h * 60 + m; };
const dm = (v: number, pos: string, neg: string) => { const a = Math.abs(v), d = Math.floor(a); return `${d}°${((a - d) * 60).toFixed(2)}′ ${v < 0 ? neg : pos}`; };
const srcLabel = (s?: string | null) => s === "onboard_gps" ? "GPS kapal" : s === "admin_device_gps" ? "Perangkat Admin (proksi)" : s ? s : "—";

export default function JagaLaut({ replay }: { replay?: React.ReactNode }) {
  const { gps } = useNav();
  const [now, setNow] = useState(wibNow());
  useEffect(() => { const t = window.setInterval(() => setNow(wibNow()), 30_000); return () => window.clearInterval(t); }, []);
  const idx = Math.floor(now / 240), cur = BLOCKS[idx], next = BLOCKS[(idx + 1) % 6];
  const left = cur.end * 60 - now, pct = Math.round((now - cur.start * 60) / 240 * 100);
  const age = gps ? Math.round((Date.now() - new Date(gps.position_at).getTime()) / 60000) : null;

  return <div className="dg-laut">
    <section className="dg-glass dg-card dg-laut-now">
      <div className="dg-eyebrow">Jaga Laut · sekarang</div>
      <div className="dg-laut-current">
        <div className="dg-laut-div"><span>Divisi</span><b className="dg-h">{cur.watch.div}</b></div>
        <div>
          <h2 className="dg-h dg-card-title">{cur.watch.code} <small>{cur.watch.name}</small></h2>
          <div className="dg-sub">{hh(cur.start)}–{hh(cur.end)} WIB · sisa {Math.floor(left / 60)} j {left % 60} m</div>
          <i className="dg-laut-bar"><em style={{ width: pct + "%" }} /></i>
          <small className="dg-note">Berikutnya: Divisi {next.watch.div} · {next.watch.code} · {hh(next.start)}–{hh(next.end)} WIB</small>
        </div>
      </div>
    </section>

    <section className="dg-glass dg-card dg-laut-board">
      <div className="dg-eyebrow">Pembagian jaga 24 jam</div>
      <ol className="dg-laut-blocks">{BLOCKS.map((b, i) => <li key={b.start} className={"dg-laut-block is-" + b.watch.div.toLowerCase() + (i === idx ? " is-now" : "")} aria-current={i === idx ? "true" : undefined}>
        <time>{hh(b.start)}–{hh(b.end)}</time><b>Divisi {b.watch.div}</b><span>{b.watch.code}</span>
      </li>)}</ol>
      <ul className="dg-laut-legend">{WATCHES.map(w => <li key={w.code}><b>Divisi {w.div} · {w.code}</b><span>{w.ranges.map(([s, e]) => hh(s) + "–" + hh(e)).join(" dan ")} WIB</span></li>)}</ul>
    </section>

    <section className="dg-glass dg-card dg-laut-pos">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Posisi kapal</div><h2 className="dg-h dg-card-title">{gps ? dm(gps.latitude, "U", "S") + "  " + dm(gps.longitude, "T", "B") : "—"}</h2>
        <div className="dg-sub">{gps ? `${srcLabel(gps.source)} · ${age != null && age >= 0 ? (age < 1 ? "baru saja" : age + " menit lalu") : "—"}` : "Belum ada posisi GPS tercatat."}</div></div>
        <NavMapButton lang="id" label="Buka peta" /></div>
      <div className="dg-laut-tele">
        <div className="dg-well"><span>Kecepatan (SOG)</span><b>{gps?.speed_knots != null ? gps.speed_knots.toFixed(1) + " kn" : "—"}</b></div>
        <div className="dg-well"><span>Arah gerak (COG)</span><b>{gps?.course_degrees != null ? Math.round(gps.course_degrees) + "°" : "—"}</b></div>
        <div className="dg-well"><span>Haluan</span><b>—</b><small>Butuh gyro; COG bukan haluan</small></div>
      </div>
    </section>

    {replay && <details className="dg-glass dg-card dg-laut-replay">
      <summary><div><div className="dg-eyebrow">Model 3D</div><b className="dg-h">Putar ulang pelayaran &amp; latihan peran</b></div><span className="dg-note">Jejak GPS per tanggal. Latihan tidak disimpan.</span></summary>
      {replay}
    </details>}
  </div>;
}
