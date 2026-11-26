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

const nf = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("en-GB"));
const isLow = (r: Row) => Number(r.minimum_stock || 0) > 0 && Number(r.stock_ready || 0) <= Number(r.minimum_stock || 0);
const isWater = (r: Row) => r.category === "Air Tawar" || /air tawar/i.test(String(r.item_name || ""));
const isHsd = (r: Row) => r.category === "BBM" || /^hsd|bbm utama/i.test(String(r.item_name || ""));
const isSkiff = (r: Row) => /skoci|penyelamat/i.test(String(r.item_name || "") + " " + String(r.category || ""));
const fmtDate = (d: string) => (d ? new Date(d + "T00:00:00+07:00").toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }) : "—");
const SHORT: Record<string, string> = { I: "Provisions & water", III: "Fuel", IV: "Damage control", V: "Ammunition", VIII: "Medical", IX: "Spare parts" };
const COND: Record<string, string> = { ready: "Ready", unready: "Not ready", not_applicable: "N/A" };

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
      <div className="dg-supply-qty"><strong className="dg-h">{r ? nf(qty) : "—"}</strong><small>litres available</small></div>
      {kind === "tank" && <><div className="dg-bar"><i style={{ width: (pct ?? 0) + "%", background: tone }} /></div><small>{pct === null ? "—" : pct + "%"} · capacity {r && cap ? nf(cap) + " L" : "—"}</small></>}
      {kind === "skiff" && <small>Recorded in actual litres, without a capacity percentage.</small>}
      {canManage && r && <button type="button" className="dg-btn" onClick={() => (kind === "skiff" ? p.onEditSkiff(r) : p.onEditSupply(r))}>{kind === "skiff" ? "Enter litres" : "Update balance"}</button>}
      {canManage && !r && kind === "skiff" && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "BBM-SKOCI", item_name: "Bahan Bakar Skoci", category: "Bahan Bakar Skoci", supply_class: "III", department_code: "LOG", unit_of_measure: "liter", minimum_stock: 0, is_active: true })}>Add rescue boat fuel record</button>}
    </div>;
  };

  return <div className="dg-stock">
    <section className="dg-titlebar">
      <div><div className="dg-eyebrow">Logistics · KRI ALAMANG-644</div><h1 className="dg-h">Stock &amp; logistics</h1><p>Balances are calculated by the database from inbound/outbound transactions. Data follows this account's access rights.</p></div>
      <div className="dg-btn-row dg-stock-actions">
        {canOperate && <button type="button" className="dg-btn dg-btn-accent" onClick={() => p.onNewMovement()}>+ Record transaction</button>}
        {canManage && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "", item_name: "", category: cls.defaultCategory, supply_class: cls.id, department_code: cls.id === "V" ? "SIN" : "LOG", unit_of_measure: cls.id === "I" || cls.id === "III" ? "liter" : "unit", minimum_stock: 0, is_active: true })}>+ Add item</button>}
        <button type="button" className="dg-btn" onClick={p.onReload} disabled={p.busy}>{p.busy ? "Loading…" : "Reload"}</button>
      </div>
    </section>

    {p.notice && <p className="dg-note dg-notice" role="status">{p.notice}</p>}
    {p.editors}

    <section className="dg-row dg-kpis">
      <div className="dg-glass dg-card dg-kpi"><span>Active items</span><b className="dg-h">{nf(visibleRows.length)}</b><small>{filled} of {canAccessClassV ? 6 : 5} classes filled</small></div>
      <div className={"dg-glass dg-card dg-kpi" + (lowCount ? " is-warn" : "")}><span>Low stock</span><b className="dg-h">{nf(lowCount)}</b><small>ready balance ≤ minimum</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Transactions this month</span><b className="dg-h">{nf(movesMonth)}</b><small>of the last {nf(movements.length)} transactions</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Class V</span><b className="dg-h">{canAccessClassV ? nf(byClass.V.length) : "🔒"}</b><small>{canAccessClassV ? "ammunition items" : "restricted access"}</small></div>
    </section>

    {p.tank3d}

    <section className="dg-glass dg-card">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Supply classification</div><h2 className="dg-h dg-card-title">Inventory by class</h2></div></div>
      <div className="dg-class-picker" role="tablist" aria-label="Supply classes">
        {stockClasses.map(c => {
          const lock = c.id === "V" && !canAccessClassV, list = byClass[c.id] || [], low = list.some(isLow);
          return <button type="button" role="tab" key={c.id} aria-selected={cls.id === c.id} onClick={() => p.setSelectedClass(c.id)} className={low && !lock ? "is-warn" : ""}>
            <span className="dg-class-id dg-h">{c.id}</span>
            <span className="dg-class-text"><b>{SHORT[c.id] || c.name}</b><small>{lock ? "Restricted" : list.length ? `${list.length} item${list.length === 1 ? "" : "s"}${low ? " · low stock" : ""}` : "Empty"}</small></span>
          </button>;
        })}
      </div>

      <div className="dg-class-detail">
        <div className="dg-card-head">
          <div><div className="dg-eyebrow">{cls.title} · {cls.name}</div><h3 className="dg-h dg-card-title">{cls.description}</h3><div className="dg-chips">{cls.subgroups.map(s => <span key={s}>{s}</span>)}</div></div>
          {canManage && !restricted && <button type="button" className="dg-btn" onClick={() => p.onNewItem({ item_code: "", item_name: "", category: cls.defaultCategory, supply_class: cls.id, department_code: cls.id === "V" ? "SIN" : "LOG", unit_of_measure: cls.id === "I" || cls.id === "III" ? "liter" : "unit", minimum_stock: 0, is_active: true })}>+ Add class {cls.id} item</button>}
        </div>

        {restricted ? <div className="dg-empty"><b>Class V inventory is restricted.</b><span>Details are only for Admin, Commander, or entitled accounts. Contact the Admin to request access.</span></div> : <>
          {(cls.id === "I" || cls.id === "III") && <div className="dg-supply-grid">
            {cls.id === "I" && supplyCard(items.find(isWater), "Fresh water", "Subsistence · fresh water", "tank")}
            {cls.id === "III" && supplyCard(items.find(isHsd), "HSD · main fuel", "Fuel · main propulsion", "tank")}
            {cls.id === "III" && supplyCard(items.find(isSkiff), "Rescue boat fuel", "Rescue boat", "skiff")}
          </div>}
          <label className="dg-search dg-stock-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input value={p.search} onChange={e => p.setSearch(e.target.value)} placeholder={`Search class ${cls.id} items (code, name, brand, lot)…`} aria-label="Search items" /></label>
          {regular.length ? <div className="table-wrap dg-table"><table><thead><tr><th>Code</th><th>Item name</th><th className="num">Ready</th><th className="num">Not ready</th><th className="num">Minimum</th><th>Status</th>{(canManage || canOperate) && <th><span className="dg-sr">Actions</span></th>}</tr></thead>
            <tbody>{regular.map(r => <tr key={r.id} className={isLow(r) ? "is-low" : ""}>
              <td className="mono">{r.item_code || "—"}</td>
              <td><b>{r.item_name}</b><small>{[r.category, r.brand, r.lot_no && "Lot " + r.lot_no].filter(Boolean).join(" · ")}</small></td>
              <td className="num">{nf(r.stock_ready)} <small>{r.unit_of_measure}</small></td>
              <td className="num">{nf(r.stock_unready)} <small>{r.unit_of_measure}</small></td>
              <td className="num">{nf(r.minimum_stock)} <small>{r.unit_of_measure}</small></td>
              <td><span className={"dg-pill " + (isLow(r) ? "dg-pill-stale" : "dg-pill-none")}><i />{isLow(r) ? "Low stock" : "Recorded"}</span></td>
              {(canManage || canOperate) && <td className="dg-row-actions">{canOperate && <button type="button" className="dg-btn" onClick={() => p.onNewMovement(r.id)}>Transaction</button>}{canManage && <button type="button" className="dg-btn" onClick={() => p.onEditItem(r)}>Edit</button>}</td>}
            </tr>)}</tbody></table></div>
            : <div className="dg-empty"><b>{q ? "No items match your search." : special.length ? "No additional items in this class yet." : "No items in this class yet."}</b><span>{q ? "Try different search terms." : "No sample data is shown."}</span></div>}
        </>}
      </div>
    </section>

    <section className="dg-glass dg-card">
      <div className="dg-card-head">
        <div><div className="dg-eyebrow">History</div><h2 className="dg-h dg-card-title">Stock transactions</h2><div className="dg-sub">Last 100 transactions. Balances are updated automatically by the database.</div></div>
        <div role="group" aria-label="Transaction type" className="dg-seg dg-seg-sm">{([["all", "All"], ["inbound", "In"], ["outbound", "Out"]] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={moveFilter === k} onClick={() => setMoveFilter(k)}>{l}</button>)}</div>
      </div>
      {moves.length ? <div className="table-wrap dg-table"><table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th className="num">Quantity</th><th>Condition</th><th>Reference</th><th>Purpose / notes</th></tr></thead>
        <tbody>{moves.map(m => { const it = itemName[m.item_id]; return <tr key={m.id}>
          <td>{fmtDate(m.movement_date)}</td>
          <td><b>{it?.item_name || "—"}</b><small>{it?.item_code || ""}</small></td>
          <td><span className={"dg-pill " + (m.movement_type === "inbound" ? "dg-pill-live" : "dg-pill-proxy")}><i />{m.movement_type === "inbound" ? "In" : m.movement_type === "outbound" ? "Out" : m.movement_type || "—"}</span></td>
          <td className="num">{m.movement_type === "outbound" ? "−" : "+"}{nf(m.quantity)} <small>{it?.unit_of_measure || ""}</small></td>
          <td>{COND[m.condition_status] || m.condition_status || "—"}</td>
          <td>{m.reference_no || "—"}</td>
          <td>{[m.movement_purpose, m.notes].filter(Boolean).join(" · ") || "—"}</td>
        </tr>; })}</tbody></table></div>
        : <div className="dg-empty"><b>No transactions{moveFilter !== "all" ? " for this filter" : ""} yet.</b></div>}
    </section>
  </div>;
}
