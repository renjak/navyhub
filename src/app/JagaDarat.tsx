"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { depLabel } from "./displayEn";

/* Logbook · Jaga Darat (default). Flow: unggah PHST (PDF/Word) → sistem membaca petugas jaga,
   posisi sandar dan Bagian C → ceklis harian Perwira Jaga. Bagian A, B dan D diringkas di atas,
   F (Lain-lain) di bawah. Semua isi berasal dari dokumen PHST; yang tidak tertulis tampil "—". */

type DailyOrder = { id: string; activity_date: string; duty_officer: string; duty_officer_nrp: string | null; duty_division: string | null; duty_nco: string | null; duty_messenger: string | null; duty_attire: string | null; situation: string | null; readiness_level: string | null; main_task: string | null; source_file: string | null };
type CheckItem = { id: string; sequence_no: number; scheduled_time: string | null; activity_text: string; result: string; execution_notes: string | null; checked_at: string | null };
type LogRow = { category: string; title: string; description: string | null; created_at: string };
export type PhstPreview = { file: string; busy: boolean; saving: boolean; plans: Array<{ activity_date: string; activity_time: string | null; title: string; description: string; category: string }>; days: Array<{ activity_date: string; meta: Record<string, string> }> };

const WIB = "Asia/Jakarta";
const todayWib = () => new Date().toLocaleDateString("en-CA", { timeZone: WIB });
const fmtDate = (v: string) => new Date(v + "T00:00:00+07:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: WIB });
const dash = (v?: string | null) => (v && v.trim() ? v.trim() : "—");

export default function JagaDarat({ supabase, unitId, userId, canManage, canOperate, viewer, refreshKey, preview, onFile, onImport, onCancelPreview }: {
  supabase: any; unitId: string; userId: string; canManage: boolean; canOperate: boolean; viewer: boolean; refreshKey: number;
  preview: PhstPreview; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onImport: () => void; onCancelPreview: () => void;
}) {
  const [date, setDate] = useState(todayWib());
  const [order, setOrder] = useState<DailyOrder | null>(null), [items, setItems] = useState<CheckItem[]>([]), [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true); setNotice("");
    const [o, r] = await Promise.all([
      supabase.from("phst_daily_orders").select("*").eq("unit_id", unitId).eq("activity_date", date).maybeSingle(),
      supabase.from("activity_logs").select("category,title,description,created_at").eq("unit_id", unitId).eq("activity_date", date).in("category", ["A. SITUASI", "B. TUGAS POKOK", "D. KHUSUS", "F. LAIN-LAIN"]).order("created_at", { ascending: false }),
    ]);
    if (o.error) setNotice("PHST gagal dimuat: " + o.error.message);
    setOrder((o.data || null) as DailyOrder | null);
    setRows((r.data || []) as LogRow[]);
    if (o.data) {
      const c = await supabase.from("phst_checklist_items").select("*").eq("unit_id", unitId).eq("daily_order_id", o.data.id).order("sequence_no");
      if (c.error) setNotice("Ceklis gagal dimuat: " + c.error.message);
      setItems((c.data || []) as CheckItem[]);
    } else setItems([]);
    setLoading(false);
  }, [supabase, unitId, date]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  // a freshly read PHST opens on its own date, so the saved checklist is shown right after "Simpan"
  const firstDay = preview.days[0]?.activity_date;
  useEffect(() => { if (firstDay) setDate(firstDay); }, [firstDay]);

  // newest row per (category, title): a later import of the same day wins, older history stays in the database
  const latest = useMemo(() => { const m = new Map<string, LogRow>(); for (const r of rows) { const k = r.category + "|" + r.title.trim(); if (!m.has(k)) m.set(k, r); } return [...m.values()]; }, [rows]);
  const sec = (c: string) => latest.filter(r => r.category === c);
  const fromA = (title: RegExp) => sec("A. SITUASI").find(r => title.test(r.title))?.description || null;
  const posisi = order?.situation || fromA(/posisi/i);
  const siaga = order?.readiness_level || fromA(/siaga/i);
  const tugas = order?.main_task || sec("B. TUGAS POKOK")[0]?.description || null;
  const khusus = sec("D. KHUSUS").map(r => ({ dep: r.title, acts: (r.description || "").split("\n").map(s => s.replace(/^•\s*/, "").trim()).filter(s => s && !/^Kegiatan:?$/i.test(s)) })).filter(x => x.acts.length);
  const lain = sec("F. LAIN-LAIN").slice().reverse();

  const canEdit = canOperate && !viewer;
  const mark = async (item: CheckItem, result: "completed" | "issue" | "not_done") => {
    if (!canEdit) return;
    setNotice("");
    const { error } = await supabase.from("phst_checklist_items").update({ result, checked_by: userId, checked_at: new Date().toISOString(), execution_notes: (notes[item.id] ?? item.execution_notes ?? "").trim() }).eq("id", item.id).eq("unit_id", unitId);
    if (error) setNotice("Ceklis gagal disimpan: " + error.message); else await load();
  };
  const done = items.filter(x => x.result === "completed").length, issues = items.filter(x => x.result === "issue").length, notDone = items.filter(x => x.result === "not_done").length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const tone = (r: string) => r === "completed" ? "ok" : r === "issue" ? "warn" : r === "not_done" ? "bad" : "none";
  const label = (r: string) => r === "completed" ? "Terlaksana" : r === "issue" ? "Ada temuan" : r === "not_done" ? "Tidak terlaksana" : "Belum diperiksa";
  const nowHm = new Date().toLocaleTimeString("en-GB", { timeZone: WIB, hour: "2-digit", minute: "2-digit" });
  const isToday = date === todayWib();

  const uploadBtn = canManage && !viewer ? <label className={"dg-btn dg-btn-accent dg-upload" + (preview.busy ? " is-busy" : "")}>
    {preview.busy ? "Membaca dokumen…" : "Unggah PHST (PDF / Word)"}
    <input type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={onFile} disabled={preview.busy} />
  </label> : null;

  return <div className="dg-darat">
    <section className="dg-glass dg-card dg-darat-head">
      <div className="dg-card-head">
        <div><div className="dg-eyebrow">Jaga Darat · PHST</div><h2 className="dg-h dg-card-title">{fmtDate(date)}</h2>
          <div className="dg-sub">{order ? "Sumber: " + dash(order.source_file) : "Mulai dengan mengunggah PHST hari ini."}</div></div>
        <div className="dg-head-actions">
          <label className="dg-field-inline"><span>Tanggal</span><input type="date" value={date} onChange={e => setDate(e.target.value || todayWib())} /></label>
          {order && uploadBtn}
        </div>
      </div>
      {notice && <p className="dg-note dg-notice" role="status">{notice}</p>}

      {preview.plans.length > 0 && <PreviewPanel preview={preview} onImport={onImport} onCancel={onCancelPreview} />}

      {loading ? <p className="dg-note">Memuat PHST…</p> : !order ? (preview.plans.length ? null : <div className="dg-empty dg-darat-empty">
        <b>Belum ada PHST untuk tanggal ini.</b>
        <span>{canManage && !viewer ? "Unggah dokumen PHST (PDF atau Word). Sistem membaca petugas jaga, posisi sandar dan Bagian C sebagai ceklis harian." : "PHST diunggah oleh Komandan atau Admin. Ceklis muncul setelah PHST tersimpan."}</span>
        {uploadBtn}
      </div>) : <>
        <div className="dg-darat-crew">
          <div className="dg-well dg-span2-md"><span>Perwira Jaga</span><b>{dash(order.duty_officer)}</b><small>{order.duty_officer_nrp ? "NRP " + order.duty_officer_nrp : "NRP —"}</small></div>
          <div className="dg-well"><span>Bintara Jaga</span><b>{dash(order.duty_nco)}</b></div>
          <div className="dg-well"><span>Caraka</span><b>{dash(order.duty_messenger)}</b></div>
          <div className="dg-well"><span>Tenue</span><b>{dash(order.duty_attire)}</b><small>{dash(order.duty_division)}</small></div>
        </div>
        <div className="dg-darat-brief">
          <div className="dg-well dg-darat-pos"><span>A · Posisi kapal</span><b>{dash(posisi)}</b><small>Kesiagaan: {dash(siaga)}</small></div>
          <div className="dg-well"><span>B · Tugas pokok</span><b>{dash(tugas)}</b></div>
          <details className="dg-well dg-darat-d">
            <summary><span>D · Khusus</span><b>{khusus.length ? khusus.length + " departemen" : "—"}</b></summary>
            {khusus.length ? <ul>{khusus.map(k => <li key={k.dep}><em>{depLabel(k.dep)}</em>{k.acts.join(" · ")}</li>)}</ul> : <small>Tidak ada kegiatan khusus tertulis.</small>}
          </details>
        </div>
      </>}
    </section>

    {order && !loading && <section className="dg-glass dg-card dg-darat-check">
      <div className="dg-phst-checkhead">
        <div><div className="dg-eyebrow">Bagian C · Umum</div><h3 className="dg-h">Ceklis harian Perwira Jaga</h3></div>
        <div className="dg-phst-progress"><b className="dg-h">{done}/{items.length}</b><span>terlaksana · {issues} temuan · {notDone} tidak</span><i><em style={{ width: pct + "%" }} /></i></div>
      </div>
      {items.length ? <ol className="dg-checklist">{items.map(item => {
        const t = item.scheduled_time?.slice(0, 5) || "";
        const due = isToday && t && t <= nowHm && item.result === "pending";
        return <li key={item.id} className={"dg-check is-" + tone(item.result) + (due ? " is-due" : "")}>
          <time>{t || "—"}</time>
          <div className="dg-check-body">
            <b>{item.activity_text}</b>
            <small><i className={"dg-dot dg-dot-" + tone(item.result)} />{due ? "Sudah waktunya · belum diperiksa" : label(item.result)}{item.checked_at ? " · " + new Date(item.checked_at).toLocaleString("id-ID", { timeZone: WIB, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB" : ""}</small>
            {(canEdit || item.execution_notes) && <textarea rows={1} disabled={!canEdit} aria-label={"Catatan untuk " + item.activity_text} value={notes[item.id] ?? item.execution_notes ?? ""} onChange={e => setNotes(v => ({ ...v, [item.id]: e.target.value }))} placeholder="Catatan / hasil pemeriksaan" />}
          </div>
          {canEdit && <div className="dg-check-actions" role="group" aria-label="Status pelaksanaan">
            <button type="button" aria-pressed={item.result === "completed"} className="is-ok" onClick={() => mark(item, "completed")}>Terlaksana</button>
            <button type="button" aria-pressed={item.result === "issue"} className="is-warn" onClick={() => mark(item, "issue")}>Temuan</button>
            <button type="button" aria-pressed={item.result === "not_done"} className="is-bad" onClick={() => mark(item, "not_done")}>Tidak</button>
          </div>}
        </li>;
      })}</ol> : <p className="dg-note">PHST tanggal ini tidak memiliki jadwal Bagian C.</p>}
    </section>}

    {order && !loading && <section className="dg-glass dg-card dg-darat-f">
      <div className="dg-eyebrow">Bagian F · Lain-lain</div>
      {lain.length ? <ol>{lain.map(r => <li key={r.title}>{r.title}</li>)}</ol> : <p className="dg-note">—</p>}
    </section>}
  </div>;
}

function PreviewPanel({ preview, onImport, onCancel }: { preview: PhstPreview; onImport: () => void; onCancel: () => void }) {
  return <div className="dg-darat-preview">
    <div className="dg-eyebrow">Hasil baca · {preview.file}</div>
    {preview.days.map(d => {
      const p = preview.plans.filter(x => x.activity_date === d.activity_date);
      const pos = p.find(x => x.category === "A. SITUASI" && /posisi/i.test(x.title))?.description;
      const c = p.filter(x => x.category === "C. UMUM" && x.activity_time).length;
      return <div className="dg-darat-preview-day" key={d.activity_date}>
        <b>{fmtDate(d.activity_date)}</b>
        <span>Perwira Jaga: {dash(d.meta["Perwira Jaga"])}</span>
        <span>Divisi: {dash(d.meta["Divisi Jaga"])} · Bintara: {dash(d.meta["Bintara Jaga"])} · Caraka: {dash(d.meta["Caraka"])}</span>
        <span>Posisi: {dash(pos)}</span>
        <span>{c} butir ceklis Bagian C</span>
      </div>;
    })}
    <div className="dg-head-actions">
      <button type="button" className="dg-btn dg-btn-accent" onClick={onImport} disabled={preview.saving}>{preview.saving ? "Menyimpan…" : "Simpan PHST"}</button>
      <button type="button" className="dg-btn" onClick={onCancel} disabled={preview.saving}>Batal</button>
    </div>
    <small className="dg-note">Data lama tidak dihapus; isi yang sama tidak disimpan dua kali.</small>
  </div>;
}
