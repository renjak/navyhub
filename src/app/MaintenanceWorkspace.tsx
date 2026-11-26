"use client";
import { useMemo, useState } from "react";
import { PARTS, assetCode } from "./vessel3d/data";

/* Maintenance module — dark glass layout. Presentation only: reports, asset
   edits and status changes go through the existing handlers in page.tsx
   (status changes stay Admin/Commander only). Missing values render "—". */

type Row = Record<string, any>;
type Section = "ALL" | "SEWACO" | "PLATFORM";
type Props = {
  assets: Row[]; faults: Row[]; busy: boolean;
  section: Section; setSection: (s: Section) => void;
  search: string; setSearch: (v: string) => void;
  canOperate: boolean; canManage: boolean;
  onReload: () => void;
  onReportFault: () => void;
  onAddAsset: () => void;
  onEditAsset: (r: Row) => void;
  onStatus: (r: Row, status: string) => void;
  onShowOnShip: (partId: string) => void;
  ship3d: React.ReactNode;
  editors: React.ReactNode;
  notice: string;
};

const STATUS: Record<string, string> = { reported: "Reported", in_progress: "In progress", completed: "Completed", deferred: "Deferred" };
const PILL: Record<string, string> = { reported: "dg-pill-stale", in_progress: "dg-pill-proxy", completed: "dg-pill-live", deferred: "dg-pill-none" };
const OPEN = ["reported", "in_progress"];
const COND: Record<string, [string, string]> = { "Baik": ["Good", "dg-pill-live"], "Perlu Perhatian": ["Needs attention", "dg-pill-stale"], "Rusak Ringan": ["Minor damage", "dg-pill-stale"], "Rusak Berat": ["Major damage", "dg-pill-bad"] };
const TAG = /^\[(3D-[A-Z0-9]+)\]\s*/i;
const CODE2PART: Record<string, (typeof PARTS)[number]> = Object.fromEntries(PARTS.map(p => [assetCode(p).toUpperCase(), p]));
const subOf = (category: any): "SEWACO" | "PLATFORM" => (String(category || "").toUpperCase().includes("PLATFORM") ? "PLATFORM" : "SEWACO");
const fmtDate = (d: string) => (d ? new Date(String(d).slice(0, 10) + "T00:00:00+07:00").toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }) : "—");

export default function MaintenanceWorkspace(p: Props) {
  const { assets, faults, canManage, canOperate, section } = p;
  const [faultView, setFaultView] = useState<"open" | "all">("open");
  const assetById = useMemo(() => Object.fromEntries(assets.map(a => [a.id, a])), [assets]);

  const enriched = useMemo(() => faults.map((f): Row => {
    const desc = String(f.issue_description || ""), m = TAG.exec(desc);
    const part = m ? CODE2PART[m[1].toUpperCase()] : undefined;
    const asset = f.asset_id ? assetById[f.asset_id] : undefined;
    const sub: "SEWACO" | "PLATFORM" | null = asset ? subOf(asset.category) : part ? part.cat : null;
    const body = m ? desc.slice(m[0].length) : desc;
    return { ...f, _text: m && body.includes(" — ") ? body.slice(body.indexOf(" — ") + 3) : body, _part: part, _asset: asset, _sub: sub };
  }), [faults, assetById]);

  const q = p.search.trim().toLowerCase();
  const inSection = (s: string | null) => section === "ALL" || s === section || s === null;
  const faultList = enriched
    .filter(f => inSection(f._sub))
    .filter(f => faultView === "all" || OPEN.includes(f.status))
    .filter(f => !q || [f._text, f._asset?.asset_name, f._asset?.asset_code, f._part?.n, f.action_taken].some(v => String(v || "").toLowerCase().includes(q)));
  const assetList = assets
    .filter(a => section === "ALL" || subOf(a.category) === section)
    .filter(a => !q || [a.asset_code, a.asset_name, a.location_label, a.condition_label].some(v => String(v || "").toLowerCase().includes(q)));

  const open = enriched.filter(f => OPEN.includes(f.status));
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 7);
  const doneMonth = enriched.filter(f => f.status === "completed" && String(f.completed_at || f.updated_at || "").slice(0, 7) === month).length;
  const attention = assets.filter(a => a.condition_label && a.condition_label !== "Baik").length;
  const countSub = (s: "SEWACO" | "PLATFORM") => ({ assets: assets.filter(a => subOf(a.category) === s).length, open: open.filter(f => f._sub === s).length });
  const sew = countSub("SEWACO"), plat = countSub("PLATFORM");

  return <div className="dg-maint">
    <section className="dg-titlebar">
      <div><div className="dg-eyebrow">Engineering · KRI ALAMANG-644</div><h1 className="dg-h">Maintenance</h1><p>Fault reports, asset register and technical readiness. Data follows this account&apos;s access rights.</p></div>
      <div className="dg-btn-row dg-stock-actions">
        {canOperate && <button type="button" className="dg-btn dg-btn-accent" onClick={p.onReportFault}>+ Report fault</button>}
        {canManage && <button type="button" className="dg-btn" onClick={p.onAddAsset}>+ Add asset</button>}
        <button type="button" className="dg-btn" onClick={p.onReload} disabled={p.busy}>{p.busy ? "Loading…" : "Reload"}</button>
      </div>
    </section>

    {p.notice && <p className="dg-note dg-notice" role="status">{p.notice}</p>}
    {p.editors}

    <section className="dg-row dg-kpis">
      <div className={"dg-glass dg-card dg-kpi" + (open.length ? " is-warn" : "")}><span>Open faults</span><b className="dg-h">{open.length}</b><small>{open.filter(f => f.status === "in_progress").length} in progress</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Completed this month</span><b className="dg-h">{doneMonth}</b><small>of the last {faults.length} reports</small></div>
      <div className="dg-glass dg-card dg-kpi"><span>Registered assets</span><b className="dg-h">{assets.length}</b><small>SEWACO {sew.assets} · PLATFORM {plat.assets}</small></div>
      <div className={"dg-glass dg-card dg-kpi" + (attention ? " is-warn" : "")}><span>Assets needing attention</span><b className="dg-h">{attention}</b><small>condition other than Good</small></div>
    </section>

    {p.ship3d}

    <div role="tablist" aria-label="Subsystem" className="dg-class-picker dg-sub-picker">
      {([["ALL", "All subsystems", `${assets.length} assets · ${open.length} open`], ["SEWACO", "SEWACO", `Sensors, weapons & command · ${sew.assets} assets · ${sew.open} open`], ["PLATFORM", "PLATFORM", `Hull, propulsion & auxiliary · ${plat.assets} assets · ${plat.open} open`]] as Array<[Section, string, string]>).map(([id, label, sub]) =>
        <button type="button" role="tab" key={id} aria-selected={section === id} onClick={() => p.setSection(id)} className={id !== "ALL" && (id === "SEWACO" ? sew.open : plat.open) ? "is-warn" : ""}>
          <span className="dg-class-id dg-h">{id === "ALL" ? "∑" : id[0]}</span>
          <span className="dg-class-text"><b>{label}</b><small>{sub}</small></span>
        </button>)}
    </div>

    <label className="dg-search dg-stock-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input value={p.search} onChange={e => p.setSearch(e.target.value)} placeholder="Search faults and assets (description, code, name, location)…" aria-label="Search faults and assets" /></label>

    <section className="dg-glass dg-card">
      <div className="dg-card-head">
        <div><div className="dg-eyebrow">Fault reports</div><h2 className="dg-h dg-card-title">{faultView === "open" ? "Open faults" : "All fault reports"}</h2><div className="dg-sub">Latest 200 reports. {canManage ? "Change the status from each report." : "Only the Admin or Commander can change status."}</div></div>
        <div role="group" aria-label="Report filter" className="dg-seg dg-seg-sm">{([["open", "Open"], ["all", "All"]] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={faultView === k} onClick={() => setFaultView(k)}>{l}</button>)}</div>
      </div>
      {faultList.length ? <ul className="dg-faults">{faultList.map(f => <li key={f.id} className={"dg-fault is-" + (f.status || "reported")}>
        <div className="dg-fault-main">
          <div className="dg-fault-top">
            <span className={"dg-pill " + (PILL[f.status] || "dg-pill-none")}><i />{STATUS[f.status] || f.status || "—"}</span>
            <small>{fmtDate(f.report_date)}{f._sub ? " · " + f._sub : ""}</small>
          </div>
          <b>{f._part ? f._part.n : f._asset ? f._asset.asset_name : "Not linked to a ship part"}</b>
          <p>{f._text || "—"}</p>
          {(f._asset || f.action_taken || f.completed_at) && <small>{[f._asset && `Asset ${f._asset.asset_code || ""} ${f._asset.asset_name || ""}`.trim(), f.action_taken && "Action: " + f.action_taken, f.completed_at && "Completed " + fmtDate(f.completed_at)].filter(Boolean).join(" · ")}</small>}
        </div>
        <div className="dg-fault-actions">
          {f._part && <button type="button" className="dg-btn" onClick={() => p.onShowOnShip(f._part!.id)}>Show on ship</button>}
          {canManage && <label className="dg-sr-wrap"><span className="dg-sr">Update status</span><select value={f.status} onChange={e => p.onStatus(f, e.target.value)}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        </div>
      </li>)}</ul> : <div className="dg-empty"><b>{faultView === "open" ? "No open faults" : "No fault reports"}{section !== "ALL" ? " in " + section : ""}{q ? " matching your search" : ""}.</b><span>{canOperate ? "Use “+ Report fault” or select a part on the 3D model." : "Nothing to show yet."}</span></div>}
    </section>

    <section className="dg-glass dg-card">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Asset register</div><h2 className="dg-h dg-card-title">{section === "ALL" ? "All assets" : section + " assets"}</h2><div className="dg-sub">{canManage ? "In the 3D Decks view you can pick a room to set an asset location." : "Read only for this account."}</div></div></div>
      {assetList.length ? <div className="table-wrap dg-table"><table><thead><tr><th>Code</th><th>Asset</th><th>Subsystem</th><th>Location</th><th>Condition</th><th className="num">Open faults</th>{canManage && <th><span className="dg-sr">Actions</span></th>}</tr></thead>
        <tbody>{assetList.map(a => { const c = COND[a.condition_label] || [a.condition_label || "—", "dg-pill-none"]; const n = open.filter(f => f.asset_id === a.id).length; return <tr key={a.id} className={a.condition_label && a.condition_label !== "Baik" ? "is-low" : ""}>
          <td className="mono">{a.asset_code || "—"}</td>
          <td><b>{a.asset_name || "—"}</b>{a.is_active === false && <small>Inactive</small>}</td>
          <td>{subOf(a.category)}</td>
          <td>{a.location_label || "—"}</td>
          <td><span className={"dg-pill " + c[1]}><i />{c[0]}</span></td>
          <td className="num">{n || "—"}</td>
          {canManage && <td className="dg-row-actions"><button type="button" className="dg-btn" onClick={() => p.onEditAsset(a)}>Edit</button></td>}
        </tr>; })}</tbody></table></div>
        : <div className="dg-empty"><b>{q ? "No assets match your search." : "No assets registered" + (section !== "ALL" ? " in " + section : "") + " yet."}</b><span>{canManage ? "Use “+ Add asset” to register equipment." : "No sample data is shown."}</span></div>}
    </section>
  </div>;
}
