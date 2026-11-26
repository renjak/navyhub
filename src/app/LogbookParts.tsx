"use client";
import { useCallback, useEffect, useState } from "react";

/* Logbook — summary strip and tab bar. Reads today's (WIB) records only;
   anything missing shows "—". No data is written here. */

export type LogTab = "jaga" | "phst" | "agenda" | "jejak" | "arsip";
export const LOG_TABS: Array<[LogTab, string, string]> = [
  ["jaga", "Today's watch", "Handover, duty officer & daily checklist"],
  ["phst", "Daily PHST", "Personnel, situation & Section C checklist"],
  ["agenda", "Agenda", "Tomorrow's agenda, departments & PHST import"],
  ["jejak", "Track & drills", "Voyage replay, drills & map"],
  ["arsip", "Archive", "Handover reports & history"]
];

const WIB = "Asia/Jakarta";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: WIB }).format(new Date());
const longDate = (d: string) => new Date(d + "T00:00:00+07:00").toLocaleDateString("en-GB", { timeZone: WIB, weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Summary = {
  watch: { name: string; type: string | null } | null | undefined;
  phst: { officer: string; total: number; done: number; issues: number } | null | undefined;
  runs: { total: number; done: number } | null | undefined;
  report: { approved: boolean } | null | undefined;
};

export function LogbookSummary({ supabase, unitId, onTab, refreshKey }: { supabase: any; unitId: string; onTab: (t: LogTab) => void; refreshKey?: number }) {
  const [s, setS] = useState<Summary>({ watch: undefined, phst: undefined, runs: undefined, report: undefined });
  const date = today();
  const load = useCallback(async () => {
    const [a, o, r, rep] = await Promise.all([
      supabase.from("daily_watch_assignments").select("new_watch_rank,new_watch_name,watch_type").eq("unit_id", unitId).eq("duty_date", date).maybeSingle(),
      supabase.from("phst_daily_orders").select("id,duty_officer").eq("unit_id", unitId).eq("activity_date", date).maybeSingle(),
      supabase.from("checklist_runs").select("id,completed_at").eq("unit_id", unitId).eq("duty_date", date),
      supabase.from("daily_watch_reports").select("approved_at,approval_text").eq("unit_id", unitId).eq("duty_date", date).maybeSingle()
    ]);
    let phst: Summary["phst"] = o.error ? undefined : null;
    if (!o.error && o.data) {
      const it = await supabase.from("phst_checklist_items").select("result").eq("unit_id", unitId).eq("daily_order_id", o.data.id);
      const rows: any[] = it.error ? [] : it.data || [];
      phst = { officer: o.data.duty_officer || "", total: rows.length, done: rows.filter(x => x.result === "completed").length, issues: rows.filter(x => x.result === "issue").length };
    }
    setS({
      watch: a.error ? undefined : a.data ? { name: [a.data.new_watch_rank, a.data.new_watch_name].filter(Boolean).join(" "), type: a.data.watch_type } : null,
      phst,
      runs: r.error ? undefined : { total: (r.data || []).length, done: (r.data || []).filter((x: any) => x.completed_at).length },
      report: rep.error ? undefined : rep.data ? { approved: !!(rep.data.approved_at || rep.data.approval_text === "APPROVED") } : null
    });
  }, [supabase, unitId, date]);
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 60000); return () => window.clearInterval(t); }, [load, refreshKey]);

  const dash = "—";
  return <section className="dg-log-summary">
    <div className="dg-log-title">
      <div className="dg-eyebrow">Logbook · KRI ALAMANG-644</div>
      <h1 className="dg-h">{longDate(date)}</h1>
    </div>
    <div className="dg-log-kpis">
      <button type="button" className="dg-glass dg-log-kpi" onClick={() => onTab("jaga")}>
        <span>Officer of the watch</span>
        <b>{s.watch === undefined ? dash : s.watch ? s.watch.name || dash : "Not assigned"}</b>
        <small>{s.watch?.type || "Assigned at 07:45 WIB"}</small>
      </button>
      <button type="button" className="dg-glass dg-log-kpi" onClick={() => onTab("jaga")}>
        <span>Daily checklist</span>
        <b>{s.runs ? `${s.runs.done}/${s.runs.total}` : dash}</b>
        <small>sessions completed today</small>
      </button>
      <button type="button" className="dg-glass dg-log-kpi" onClick={() => onTab("phst")}>
        <span>Today's PHST</span>
        <b>{s.phst === undefined ? dash : s.phst ? `${s.phst.done}/${s.phst.total}` : "None yet"}</b>
        <small>{s.phst ? `Section C done${s.phst.issues ? ` · ${s.phst.issues} finding${s.phst.issues === 1 ? "" : "s"}` : ""}` : "upload the document in the Agenda tab"}</small>
      </button>
      <button type="button" className={"dg-glass dg-log-kpi" + (s.report?.approved ? " is-ok" : "")} onClick={() => onTab("arsip")}>
        <span>Commander approval</span>
        <b>{s.report === undefined ? dash : s.report ? (s.report.approved ? "Approved" : "Pending") : "No report yet"}</b>
        <small>today's logbook report</small>
      </button>
    </div>
  </section>;
}

export function LogTabs({ tab, onTab }: { tab: LogTab; onTab: (t: LogTab) => void }) {
  return <div className="dg-glass dg-tabs" role="tablist" aria-label="Logbook sections">
    {LOG_TABS.map(([id, label, desc]) => <button type="button" role="tab" key={id} aria-selected={tab === id} title={desc} onClick={() => onTab(id)}><b>{label}</b><small>{desc}</small></button>)}
  </div>;
}
