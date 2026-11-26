"use client";
import { useMemo, useState } from "react";
import { stockClasses, itemBelongsToStockClass } from "./stockClasses";

/* Stock module — dark glass layout. Presentation only: every write still goes
   through the existing handlers in page.tsx (transactions update balances in
   the database; balances are never edited directly). Class V stays hidden
   for accounts without entitlement. Missing values render "—". */

type Row = Record<string, any>;
type Props = {
  rows: Row[]; movements: Row[]; busy: boolean;
  search: string; setSearch: (v: string) => void;
  canOperate: boolean; canManage: boolean; canAccessClassV: boolean;
  selectedClass: string | null; setSelectedClass: (id: string) => void;
  onReload: () => void;
  onNewMovement: (itemId?: string) => void;
  onNewItem: (draft: Row) => void;
  onEditItem: (item: Row) => void;
  onEditSupply: (item: Row) => void;
  onEditSkiff: (item: Row) => void;
  tank3d: React.ReactNode;
  editors: React.ReactNode;
  notice: string;
};

const nf = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("id-ID"));
const isLow = (r: Row) => Number(r.minimum_stock || 0) > 0 && Number(r.stock_ready || 0) <= Number(r.minimum_stock || 0);
const isWater = (r: Row) => r.category === "Air Tawar" || /air tawar/i.test(String(r.item_name || ""));
const isHsd = (r: Row) => r.category === "BBM" || /^hsd|bbm utama/i.test(String(r.item_name || ""));
const isSkiff = (r: Row) => /skoci|penyelamat/i.test(String(r.item_name || "") + " " + String(r.category || ""));
const fmtDate = (d: string) => (d ? new Date(d + "T00:00:00+07:00").toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }) : "—");
const SHORT: Record<string, string> = { I: "Konsumsi & air", III: "BBM", IV: "Damage control", V: "Amunisi", VIII: "Kesehatan", IX: "Suku cadang" };
const COND: Record<string, string> = { ready: "Siap", unready: "Tidak siap", not_applicable: "Tidak berlaku" };

export default function StockWorkspace(p: Props) {
  const { rows, movements, canManage, canOperate, canAccessClassV } = p;
  const [moveFilter, setMoveFilter] = useState<"all" | "inbound" | "outbound">("all");
  const byClass = useMemo(() => Object.fromEntries(stockClasses.map(c => [c.id, rows.filter(r => itemBelongsToStockClass(r, c.id))])), [rows]);
  const visibleRows = rows.filter(r => canAccessClassV || !itemBelongsToStockClass(r, "V"));
  const lowCount = visibleRows.filter(isLow).length;
  const filled = stockClasses.filter(c => (c.id !== "V" || canAccessClassV) && byClass[c.id].length).length;
  const itemName = useMemo(() => Object.fromEntries(rows.map(r => [r.id, r])), [rows]);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 7);
  const movesMonth = movements.filter(m => String(m.movement_date || "").startsWith(month)).length;

  const cls = stockClasses.find(c => c.id === p.selectedClass) || stockClasses[0];
  const restricted = cls.id === "V" && !canAccessClassV;
  const items = byClass[cls.id] || [];
  const special = items.filter(r => (cls.id === "I" && isWater(r)) || (cls.id === "III" && (isHsd(r) || isSkiff(r))));
  const q = p.search.trim().toLowerCase();
  const regular = items.filter(r => !special.includes(r)).filter(r => !q || [r.item_code, r.item_name, r.category, r.brand, r.lot_no].some(v => String(v || "").toLowerCase().includes(q)));
  const moves = movements.filter(m => moveFilter === "all" || m.movement_type === moveFilter);

  const supplyCard = (r: Row | undefined, title: string, kicker: string, kind: "tank" | "skiff") => {
    const qty = Number(r?.stock_ready || 0), cap = Number(r?.capacity_liters || 0);
    const pct = r && cap > 0 && kind === "tank" ? Math.max(0, Math.min(100, Math.round((qty / cap) * 100))) : null;
    const tone = pct === null ? "var(--dg-info)" : pct < 15 ? "var(--dg-bad)" : pct < 30 ? "var(--dg-warn)" : "var(--dg-ok)";
    return <div className="dg-well dg-supply" key={title}>
      <span>{kicker}</span>
      <b className="dg-h">{title}</b>
      <div className="dg-supply-qty"><strong className="dg-h">{r ? nf(qty) : "—"}</strong><small>liter tersedia</small></div>
      {kind === "tank" && <><div className="dg-bar"><i style={{ width: (pct ?? 0) + "%", background: tone }} /></div><small>{pct === null ? "—" : pct + "%"} · kapasitas {r && cap ? nf(cap) + " L" : "—"}</small></>}
      {kind === "skiff" && <small>Dicatat dalam liter aktual, tanpa persentase kapasitas.</small>}
      {canManage && r && <button type="button" className="dg-btn" onClick={() => (kind === "skiff" ? p.onEditSkiff(r) : p.onEditSupply(r))}>{kind === "skiff" ? "Input jumlah liter" : "Perbarui saldo"}</button>}
      {canManage && !r && kind === "skiff" && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "BBM-SKOCI", item_name: "Bahan Bakar Skoci", category: "Bahan Bakar Skoci", supply_class: "III", department_code: "LOG", unit_of_measure: "liter", minimum_stock: 0, is_active: true })}>Tambah data bahan bakar skoci</button>}
    </div>;
  };

  return <div className="dg-stock">
    <section className="dg-titlebar">
      <div><div className="dg-eyebrow">Logistik · KRI ALAMANG-644</div><h1 className="dg-h">Persediaan &amp; logistik</h1><p>Saldo dihitung database dari transaksi masuk/keluar. Data sesuai hak akses akun ini.</p></div>
      <div className="dg-btn-row dg-stock-actions">
        {canOperate && <button type="button" className="dg-btn dg-btn-accent" onClick={() => p.onNewMovement()}>+ Catat transaksi</button>}
        {canManage && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "", item_name: "", category: cls.defaultCategory, supply_class: cls.id, department_code: cls.id === "V" ? "SIN" : "LOG", unit_of_measure: cls.id === "I" || cls.id === "III" ? "liter" : "unit", minimum_stock: 0, is_active: true })}>+ Tambah barang</button>}
        <button type="button" className="dg-btn" onClick={p.onReload} disabled={p.busy}>{p.busy ? "Memuat…" : "Muat ulang"}</button>
      </div>
    </section>

    {p.notice && <p className="dg-note dg-notice" role="status">{p.notice}</p>}
    {p.editors}

    <section className="dg-row dg-kpis">
      <div className="dg-glass dg-card dg-kpi"><span>Item aktif</span><b className="dg-h">{nf(visibleRows.length)}</b><small>{filled} dari {canAccessClassV ? 6 : 5} kelas terisi</small></div>
      <div className={"dg-glass dg-card dg-kpi" + (lowCount ? " is-warn" : "")}><span>Stok rendah</span><b className="dg-h">{nf(lowCount)}</b><small>saldo siap ≤ minimum</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Transaksi bulan ini</span><b className="dg-h">{nf(movesMonth)}</b><small>dari {nf(movements.length)} transaksi terakhir</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Kelas V</span><b className="dg-h">{canAccessClassV ? nf(byClass.V.length) : "🔒"}</b><small>{canAccessClassV ? "item amunisi" : "akses terbatas"}</small></div>
    </section>

    {p.tank3d}

    <section className="dg-glass dg-card">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Klasifikasi suplai</div><h2 className="dg-h dg-card-title">Inventaris per kelas</h2></div></div>
      <div className="dg-class-picker" role="tablist" aria-label="Kelas suplai">
        {stockClasses.map(c => {
          const lock = c.id === "V" && !canAccessClassV, list = byClass[c.id] || [], low = list.some(isLow);
          return <button type="button" role="tab" key={c.id} aria-selected={cls.id === c.id} onClick={() => p.setSelectedClass(c.id)} className={low && !lock ? "is-warn" : ""}>
            <span className="dg-class-id dg-h">{c.id}</span>
            <span className="dg-class-text"><b>{SHORT[c.id] || c.name}</b><small>{lock ? "Akses terbatas" : list.length ? `${list.length} item${low ? " · stok rendah" : ""}` : "Belum terisi"}</small></span>
          </button>;
        })}
      </div>

      <div className="dg-class-detail">
        <div className="dg-card-head">
          <div><div className="dg-eyebrow">{cls.title} · {cls.name}</div><h3 className="dg-h dg-card-title">{cls.description}</h3><div className="dg-chips">{cls.subgroups.map(s => <span key={s}>{s}</span>)}</div></div>
          {canManage && !restricted && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "", item_name: "", category: cls.defaultCategory, supply_class: cls.id, department_code: cls.id === "V" ? "SIN" : "LOG", unit_of_measure: cls.id === "I" || cls.id === "III" ? "liter" : "unit", minimum_stock: 0, is_active: true })}>+ Tambah item kelas {cls.id}</button>}
        </div>

        {restricted ? <div className="dg-empty"><b>Inventaris Kelas V dibatasi.</b><span>Rincian hanya untuk Admin, Komandan, atau akun yang diberi hak. Hubungi Admin untuk penetapan akses.</span></div> : <>
          {(cls.id === "I" || cls.id === "III") && <div className="dg-supply-grid">
            {cls.id === "I" && supplyCard(items.find(isWater), "Air Tawar", "Subsistence · air tawar", "tank")}
            {cls.id === "III" && supplyCard(items.find(isHsd), "HSD · bahan bakar utama", "Fuel · propulsi utama", "tank")}
            {cls.id === "III" && supplyCard(items.find(isSkiff), "Bahan bakar skoci", "Rescue boat fuel", "skiff")}
          </div>}
          <label className="dg-search dg-stock-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input value={p.search} onChange={e => p.setSearch(e.target.value)} placeholder={`Cari item kelas ${cls.id} (kode, nama, merek, lot)…`} aria-label="Cari item" /></label>
          {regular.length ? <div className="table-wrap dg-table"><table><thead><tr><th>Kode</th><th>Nama item</th><th className="num">Siap</th><th className="num">Tidak siap</th><th className="num">Minimum</th><th>Status</th>{(canManage || canOperate) && <th><span className="dg-sr">Aksi</span></th>}</tr></thead>
            <tbody>{regular.map(r => <tr key={r.id} className={isLow(r) ? "is-low" : ""}>
              <td className="mono">{r.item_code || "—"}</td>
              <td><b>{r.item_name}</b><small>{[r.category, r.brand, r.lot_no && "Lot " + r.lot_no].filter(Boolean).join(" · ")}</small></td>
              <td className="num">{nf(r.stock_ready)} <small>{r.unit_of_measure}</small></td>
              <td className="num">{nf(r.stock_unready)} <small>{r.unit_of_measure}</small></td>
              <td className="num">{nf(r.minimum_stock)} <small>{r.unit_of_measure}</small></td>
              <td><span className={"dg-pill " + (isLow(r) ? "dg-pill-stale" : "dg-pill-none")}><i />{isLow(r) ? "Stok rendah" : "Tercatat"}</span></td>
              {(canManage || canOperate) && <td className="dg-row-actions">{canOperate && <button type="button" className="dg-btn" onClick={() => p.onNewMovement(r.id)}>Transaksi</button>}{canManage && <button type="button" className="dg-btn" onClick={() => p.onEditItem(r)}>Edit</button>}</td>}
            </tr>)}</tbody></table></div>
            : <div className="dg-empty"><b>{q ? "Tidak ada item yang cocok dengan pencarian." : special.length ? "Belum ada item tambahan di kelas ini." : "Belum ada item di kelas ini."}</b><span>{q ? "Ubah kata kunci pencarian." : "Tidak ada data contoh yang ditampilkan."}</span></div>}
        </>}
      </div>
    </section>

    <section className="dg-glass dg-card">
      <div className="dg-card-head">
        <div><div className="dg-eyebrow">Riwayat</div><h2 className="dg-h dg-card-title">Transaksi persediaan</h2><div className="dg-sub">100 transaksi terakhir. Saldo diperbarui otomatis oleh database.</div></div>
        <div role="group" aria-label="Jenis transaksi" className="dg-seg dg-seg-sm">{([["all", "Semua"], ["inbound", "Masuk"], ["outbound", "Keluar"]] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={moveFilter === k} onClick={() => setMoveFilter(k)}>{l}</button>)}</div>
      </div>
      {moves.length ? <div className="table-wrap dg-table"><table><thead><tr><th>Tanggal</th><th>Barang</th><th>Jenis</th><th className="num">Jumlah</th><th>Kondisi</th><th>Referensi</th><th>Tujuan / catatan</th></tr></thead>
        <tbody>{moves.map(m => { const it = itemName[m.item_id]; return <tr key={m.id}>
          <td>{fmtDate(m.movement_date)}</td>
          <td><b>{it?.item_name || "—"}</b><small>{it?.item_code || ""}</small></td>
          <td><span className={"dg-pill " + (m.movement_type === "inbound" ? "dg-pill-live" : "dg-pill-proxy")}><i />{m.movement_type === "inbound" ? "Masuk" : m.movement_type === "outbound" ? "Keluar" : m.movement_type || "—"}</span></td>
          <td className="num">{m.movement_type === "outbound" ? "−" : "+"}{nf(m.quantity)} <small>{it?.unit_of_measure || ""}</small></td>
          <td>{COND[m.condition_status] || m.condition_status || "—"}</td>
          <td>{m.reference_no || "—"}</td>
          <td>{[m.movement_purpose, m.notes].filter(Boolean).join(" · ") || "—"}</td>
        </tr>; })}</tbody></table></div>
        : <div className="dg-empty"><b>Belum ada transaksi{moveFilter !== "all" ? " untuk filter ini" : ""}.</b></div>}
    </section>
  </div>;
}
