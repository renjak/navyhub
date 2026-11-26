"use client";
import { useCallback, useEffect, useState } from "react";
import { useNav } from "./NavRuntime";
import NavMapButton from "./NavMap";

/* Logbook · Jaga Laut. Tiga jaga, masing-masing dua kali sehari (WIB):
   PH-MH 08–12 & 20–24, PT-DH 12–16 & 00–04, SH-LM 04–08 & 16–20.
   Divisi A/B/C bergilir (pemilik, 26 Nov 2026): Perwira Jaga mengisi pembagian divisi tiap hari
   (tabel sea_watch_rotations, per tanggal WIB); tanpa isian divisi tampil "—". Posisi dari GPS kapal (atau proksi perangkat Admin);
   haluan tetap "—" tanpa gyro. */

type Watch = { code: string; key: "a" | "b" | "c"; ranges: Array<[number, number]> };
const WATCHES: Watch[] = [
  { code: "PH-MH", key: "a", ranges: [[8, 12], [20, 24]] },
  { code: "PT-DH", key: "b", ranges: [[12, 16], [0, 4]] },
  { code: "SH-LM", key: "c", ranges: [[16, 20], [4, 8]] },
];
const BLOCKS = [0, 4, 8, 12, 16, 20].map(h => ({ start: h, end: h + 4, watch: WATCHES.find(w => w.ranges.some(([s]) => s === h))! }));
const hh = (h: number) => String(h % 24).padStart(2, "0") + ".00";
const wibNow = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()); const h = Number(p.find(x => x.type === "hour")?.value) % 24, m = Number(p.find(x => x.type === "minute")?.value); return h * 60 + m; };
const dm = (v: number, pos: string, neg: string) => { const a = Math.abs(v), d = Math.floor(a); return `${d}°${((a - d) * 60).toFixed(2)}′ ${v < 0 ? neg : pos}`; };
const srcLabel = (s?: string | null) => s === "onboard_gps" ? "GPS kapal" : s === "admin_device_gps" ? "Perangkat Admin (proksi)" : s ? s : "—";

type Code = "PH-MH" | "PT-DH" | "SH-LM";
type Rot = { watch_code: Code; division: string; set_by: string; updated_at: string };
const todayWib = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export default function JagaLaut({ replay, supabase, unitId, userId, role, viewer }: { replay?: React.ReactNode; supabase: any; unitId: string; userId: string; role: string; viewer: boolean }) {
  const { gps } = useNav();
  const [day, setDay] = useState(todayWib());
  const [rot, setRot] = useState<Record<string, Rot>>({}), [setter, setSetter] = useState("");
  const [draft, setDraft] = useState<Record<Code, string>>({ "PH-MH": "", "PT-DH": "", "SH-LM": "" });
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false), [msg, setMsg] = useState("");
  const canSet = !viewer && ["admin", "commander", "officer"].includes(role);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("sea_watch_rotations").select("watch_code,division,set_by,updated_at").eq("unit_id", unitId).eq("duty_date", day);
    if (error) { setMsg("Pembagian divisi gagal dimuat: " + error.message); return; }
    const m: Record<string, Rot> = {}; for (const r of (data || []) as Rot[]) m[r.watch_code] = r;
    setRot(m); setDraft({ "PH-MH": m["PH-MH"]?.division || "", "PT-DH": m["PT-DH"]?.division || "", "SH-LM": m["SH-LM"]?.division || "" });
    const last = (data || []).slice().sort((a: Rot, b: Rot) => b.updated_at.localeCompare(a.updated_at))[0] as Rot | undefined;
    if (last) { const p = await supabase.from("profiles").select("full_name,rank_title").eq("id", last.set_by).maybeSingle(); setSetter(((p.data?.rank_title ? p.data.rank_title + " " : "") + (p.data?.full_name || "")).trim() + " · " + new Date(last.updated_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) + " WIB"); } else setSetter("");
  }, [supabase, unitId, day]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    const vals = Object.values(draft);
    if (vals.some(v => !v)) { setMsg("Pilih divisi untuk ketiga jaga."); return; }
    if (new Set(vals).size !== 3) { setMsg("Satu divisi hanya boleh memegang satu jaga per hari."); return; }
    setSaving(true); setMsg("");
    const rows = (Object.keys(draft) as Code[]).map(c => ({ unit_id: unitId, duty_date: day, watch_code: c, division: draft[c], set_by: userId, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("sea_watch_rotations").upsert(rows, { onConflict: "unit_id,duty_date,watch_code" });
    setSaving(false);
    if (error) { setMsg("Gagal menyimpan: " + error.message); return; }
    setEditing(false); setMsg("Pembagian divisi tersimpan."); await load();
  };
  const divOf = (code: string) => rot[code]?.division || "—";
  const [now, setNow] = useState(wibNow());
  useEffect(() => { const t = window.setInterval(() => { setNow(wibNow()); setDay(todayWib()); }, 30_000); return () => window.clearInterval(t); }, []);
  const idx = Math.floor(now / 240), cur = BLOCKS[idx], next = BLOCKS[(idx + 1) % 6];
  const left = cur.end * 60 - now, pct = Math.round((now - cur.start * 60) / 240 * 100);
  const age = gps ? Math.round((Date.now() - new Date(gps.position_at).getTime()) / 60000) : null;

  return <div className="dg-laut">
    <section className="dg-glass dg-card dg-laut-now">
      <div className="dg-eyebrow">Jaga Laut · sekarang</div>
      <div className="dg-laut-current">
        <div className="dg-laut-div" title={rot[cur.watch.code] ? "Diisi Perwira Jaga" : "Belum diisi Perwira Jaga"}><span>Divisi</span><b className="dg-h">{divOf(cur.watch.code)}</b></div>
        <div>
          <h2 className="dg-h dg-card-title">{cur.watch.code}</h2>
          <div className="dg-sub">{hh(cur.start)}–{hh(cur.end)} WIB · sisa {Math.floor(left / 60)} j {left % 60} m</div>
          <i className="dg-laut-bar"><em style={{ width: pct + "%" }} /></i>
          <small className="dg-note">Berikutnya: {next.watch.code} · {hh(next.start)}–{hh(next.end)} WIB · Divisi {divOf(next.watch.code)}</small>
        </div>
      </div>
    </section>

    <section className="dg-glass dg-card dg-laut-rot">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Pembagian divisi hari ini · diisi Perwira Jaga</div>
        <h2 className="dg-h dg-card-title">{Object.keys(rot).length === 3 ? WATCHES.map(w => w.code + " " + rot[w.code].division).join(" · ") : "Belum diisi"}</h2>
        <div className="dg-sub">{setter ? "Terakhir diisi: " + setter : canSet ? "Pilih divisi untuk tiap jaga hari ini." : "Diisi oleh Perwira Jaga."}</div></div>
        {canSet && !editing && <button type="button" className="dg-btn dg-btn-accent" onClick={() => { setEditing(true); setMsg(""); }}>{Object.keys(rot).length ? "Ubah" : "Isi pembagian"}</button>}</div>
      {editing && <div className="dg-laut-rot-form">
        {WATCHES.map(w => <div className="dg-laut-rot-row" key={w.code}><span>{w.code}<small>{w.ranges.map(([s, e]) => hh(s) + "–" + hh(e)).join(", ")}</small></span>
          <div role="group" aria-label={"Divisi untuk " + w.code} className="dg-seg dg-seg-sm">{["A", "B", "C"].map(d => <button type="button" key={d} aria-pressed={draft[w.code as Code] === d} onClick={() => setDraft(v => ({ ...v, [w.code]: d }))}>Divisi {d}</button>)}</div></div>)}
        <div className="dg-head-actions"><button type="button" className="dg-btn dg-btn-accent" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button><button type="button" className="dg-btn" onClick={() => { setEditing(false); void load(); }} disabled={saving}>Batal</button></div>
      </div>}
      {msg && <p className="dg-note" role="status">{msg}</p>}
    </section>

    <section className="dg-glass dg-card dg-laut-board">
      <div className="dg-eyebrow">Pembagian jaga 24 jam</div>
      <ol className="dg-laut-blocks">{BLOCKS.map((b, i) => <li key={b.start} className={"dg-laut-block is-" + b.watch.key + (i === idx ? " is-now" : "")} aria-current={i === idx ? "true" : undefined}>
        <time>{hh(b.start)}–{hh(b.end)}</time><b>{b.watch.code}</b><span>Divisi {divOf(b.watch.code)}</span>
      </li>)}</ol>
      <ul className="dg-laut-legend">{WATCHES.map(w => <li key={w.code}><b>{w.code} · Divisi {divOf(w.code)}</b><span>{w.ranges.map(([s, e]) => hh(s) + "–" + hh(e)).join(" dan ")} WIB</span></li>)}</ul>
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
