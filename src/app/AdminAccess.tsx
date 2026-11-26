"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Portal from "./Portal";
import { depLabel } from "./displayEn";

/* Administration · accounts and access (Admin only).
   Per account: role, department, Head of Department, stock classes (I, III, IV, V, VIII, IX),
   active/inactive. Enforcement is in the database (RLS + private.can_access_stock_class);
   this screen only edits the profile. New accounts are invited by email (admin-invite-user). */

type Account = { id: string; full_name: string; rank_title: string | null; role: string; is_active: boolean; department_code: string | null; is_department_head: boolean; stock_classes: string[] | null };
type Draft = { role: string; department_code: string; is_department_head: boolean; stock_classes: string[]; is_active: boolean };
type NewDraft = { full_name: string; email: string; rank_title: string; role: string; department_code: string; stock_classes: string[] };

const CLASSES: Array<[string, string]> = [["I", "Subsistence"], ["III", "Fuel"], ["IV", "Damage control"], ["V", "Ammunition"], ["VIII", "Medical"], ["IX", "Spare parts"]];
const ALL = CLASSES.map(c => c[0]);
const DEFAULT_CLASSES = ALL.filter(c => c !== "V");
const DEPTS: Array<[string, string]> = [["", "None"], ["OPS", "DEPOPS"], ["SIN", "DEPSIN"], ["EKA", "DEPEKA"], ["LOG", "DEPLOG"]];
const ROLE_LABEL: Record<string, string> = { admin: "Admin", commander: "Commander", officer: "Officer", operator: "Operator", viewer: "Viewer" };
const seeAll = (role: string) => role === "admin" || role === "commander";
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

function Seg({ label, value, options, onChange, disabled }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void; disabled?: boolean }) {
  return <div className="adm-field"><span className="adm-label">{label}</span>
    <div role="group" aria-label={label} className="adm-seg">{options.map(([v, l]) => <button type="button" key={v || "none"} aria-pressed={value === v} disabled={disabled} onClick={() => onChange(v)}>{l}</button>)}</div></div>;
}

function ClassPicker({ value, onChange, note }: { value: string[]; onChange: (v: string[]) => void; note?: string }) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter(x => x !== c) : ALL.filter(x => x === c || value.includes(x)));
  return <div className="adm-field"><span className="adm-label">Stock access <button type="button" className="adm-mini" onClick={() => onChange([...ALL])}>All</button><button type="button" className="adm-mini" onClick={() => onChange([])}>None</button></span>
    <div className="adm-classes">{CLASSES.map(([c, n]) => <button type="button" key={c} aria-pressed={value.includes(c)} onClick={() => toggle(c)} className={c === "V" ? "is-v" : ""}><b>{c}</b><span>{n}</span></button>)}</div>
    {note && <small className="adm-hint">{note}</small>}</div>;
}

function Switch({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return <button type="button" role="switch" aria-checked={checked} className="adm-switch" disabled={disabled} onClick={() => onChange(!checked)}>
    <span><b>{label}</b>{hint && <small>{hint}</small>}</span><i aria-hidden="true" /></button>;
}

export default function AdminAccess({ sb, meId, unitId }: { sb: any; meId: string; unitId: string }) {
  const [rows, setRows] = useState<Account[]>([]), [busy, setBusy] = useState(true), [err, setErr] = useState(""), [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Account | null>(null), [draft, setDraft] = useState<Draft | null>(null), [saving, setSaving] = useState(false), [formErr, setFormErr] = useState("");
  const [invite, setInvite] = useState<NewDraft | null>(null);
  useEffect(() => { setFormErr(""); }, [invite?.full_name, invite?.email]);

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    const { data, error } = await sb.from("profiles").select("id,full_name,rank_title,role,is_active,department_code,is_department_head,stock_classes").eq("unit_id", unitId).order("full_name");
    if (error) setErr("Accounts could not be loaded: " + error.message); else setRows((data || []) as Account[]);
    setBusy(false);
  }, [sb, unitId]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => { const k = q.trim().toLowerCase(); return k ? rows.filter(r => (r.full_name + " " + (r.rank_title || "") + " " + r.role + " " + depLabel(r.department_code)).toLowerCase().includes(k)) : rows; }, [rows, q]);

  const openEdit = (a: Account) => { setEdit(a); setFormErr(""); setDraft({ role: a.role, department_code: a.department_code || "", is_department_head: a.is_department_head, stock_classes: a.stock_classes || DEFAULT_CLASSES, is_active: a.is_active }); };
  const saveEdit = async () => {
    if (!edit || !draft) return;
    if (draft.is_department_head && !draft.department_code) { setFormErr("A Head of Department needs a department."); return; }
    setSaving(true); setFormErr("");
    if (draft.role !== edit.role) {
      const r = await sb.rpc("admin_set_profile_role", { p_profile_id: edit.id, p_role: draft.role });
      if (r.error) { setFormErr("Role not changed: " + r.error.message); setSaving(false); return; }
    }
    const { data, error } = await sb.from("profiles").update({ department_code: draft.department_code || null, is_department_head: !!draft.department_code && draft.is_department_head, stock_classes: draft.stock_classes, is_active: draft.is_active, updated_at: new Date().toISOString() })
      .eq("id", edit.id).eq("unit_id", unitId).neq("role", "admin").select("id").maybeSingle();
    setSaving(false);
    if (error) { setFormErr("Not saved: " + error.message); return; }
    if (!data) { setFormErr("Not saved. Only the main Admin can change other accounts."); return; }
    setEdit(null); setDraft(null); setMsg("Saved: " + edit.full_name); await load();
  };

  const sendInvite = async () => {
    if (!invite) return;
    if (invite.full_name.trim().length < 3) { setFormErr("Enter the full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) { setFormErr("Enter a valid email."); return; }
    setSaving(true); setFormErr("");
    const { data, error } = await sb.functions.invoke("admin-invite-user", { body: { email: invite.email.trim(), full_name: invite.full_name.trim(), rank_title: invite.rank_title.trim(), role: invite.role, department_code: invite.department_code, is_department_head: false, stock_classes: invite.stock_classes, can_access_class_v: invite.stock_classes.includes("V") } });
    setSaving(false);
    if (error || !data?.success) { setFormErr("Invitation failed: " + (data?.error || error?.message || "unknown error")); return; }
    setInvite(null); setMsg("Invitation sent to " + invite.email.trim()); await load();
  };

  const active = rows.filter(r => r.is_active).length;
  return <section className="adm">
    <div className="dg-glass dg-card adm-head">
      <div><div className="dg-eyebrow">Administration</div><h2 className="dg-h dg-card-title">Accounts &amp; access</h2><div className="dg-sub">{rows.length} accounts · {active} active</div></div>
      <div className="adm-head-actions">
        <input className="adm-search" type="search" placeholder="Search name, rank, role…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search accounts" />
        <button type="button" className="dg-btn dg-btn-accent" onClick={() => { setFormErr(""); setInvite({ full_name: "", email: "", rank_title: "", role: "viewer", department_code: "", stock_classes: [...DEFAULT_CLASSES] }); }}>+ New account</button>
      </div>
    </div>
    {err && <p className="dg-note dg-err">{err}</p>}
    {msg && <p className="dg-note" role="status">{msg}</p>}
    {busy ? <p className="dg-note">Loading accounts…</p> : <div className="adm-grid">{shown.map(a => {
      const me = a.id === meId, cls = a.stock_classes || DEFAULT_CLASSES;
      return <article key={a.id} className={"dg-glass dg-card adm-card" + (a.is_active ? "" : " is-off")}>
        <div className="adm-who"><i aria-hidden="true">{initials(a.full_name)}</i><div><b>{a.full_name || "—"}</b><small>{a.rank_title || "—"}</small></div></div>
        <div className="adm-chips">
          <span className={"adm-chip role-" + a.role}>{ROLE_LABEL[a.role] || a.role}</span>
          <span className="adm-chip">{a.department_code ? depLabel(a.department_code) : "No dept"}</span>
          {a.is_department_head && <span className="adm-chip">Head</span>}
          {!a.is_active && <span className="adm-chip is-bad">Inactive</span>}
        </div>
        <div className="adm-cls" aria-label="Stock access">{seeAll(a.role) ? <span className="adm-all">All stock classes</span> : CLASSES.map(([c]) => <span key={c} className={cls.includes(c) ? "on" : ""} title={cls.includes(c) ? "Class " + c + " allowed" : "Class " + c + " not allowed"}>{c}</span>)}</div>
        <button type="button" className="dg-btn adm-manage" disabled={me || a.role === "admin"} onClick={() => openEdit(a)}>{me ? "This is you" : a.role === "admin" ? "Main admin" : "Manage access"}</button>
      </article>;
    })}{!shown.length && <p className="dg-note">No accounts found.</p>}</div>}

    {edit && draft && <Portal><div className="dg-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-label={"Manage access for " + edit.full_name} onMouseDown={e => { if (e.target === e.currentTarget && !saving) setEdit(null); }}>
      <div className="dg-modal-card dg-editor adm-editor">
        <div className="adm-editor-head"><div className="adm-who"><i aria-hidden="true">{initials(edit.full_name)}</i><div><b>{edit.full_name}</b><small>{edit.rank_title || "—"}</small></div></div></div>
        <Seg label="Role" value={draft.role} onChange={v => setDraft(d => d && ({ ...d, role: v }))} options={[["viewer", "Viewer"], ["operator", "Operator"], ["officer", "Officer"], ["commander", "Commander"]]} />
        <Seg label="Department" value={draft.department_code} onChange={v => setDraft(d => d && ({ ...d, department_code: v, is_department_head: v ? d.is_department_head : false }))} options={DEPTS} />
        <Switch label="Head of Department" checked={draft.is_department_head} disabled={!draft.department_code} hint={draft.department_code ? undefined : "Choose a department first"} onChange={v => setDraft(d => d && ({ ...d, is_department_head: v }))} />
        <ClassPicker value={draft.stock_classes} onChange={v => setDraft(d => d && ({ ...d, stock_classes: v }))} note={seeAll(draft.role) ? "Commanders always see all classes." : undefined} />
        <Switch label="Account active" checked={draft.is_active} hint={draft.is_active ? undefined : "Inactive accounts cannot open any data"} onChange={v => setDraft(d => d && ({ ...d, is_active: v }))} />
        {formErr && <p className="dg-note dg-err" role="alert">{formErr}</p>}
        <div className="adm-actions"><button type="button" className="dg-btn" onClick={() => setEdit(null)} disabled={saving}>Cancel</button><button type="button" className="dg-btn dg-btn-accent" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
      </div></div></Portal>}

    {invite && <Portal><div className="dg-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-label="New account" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setInvite(null); }}>
      <div className="dg-modal-card dg-editor adm-editor">
        <div><div className="dg-eyebrow">New account</div><h3>Invite by email</h3></div>
        <div className="adm-inputs">
          <label><span className="adm-label">Full name</span><input value={invite.full_name} onChange={e => setInvite(v => v && ({ ...v, full_name: e.target.value }))} autoComplete="off" /></label>
          <label><span className="adm-label">Email</span><input type="email" value={invite.email} onChange={e => setInvite(v => v && ({ ...v, email: e.target.value }))} autoComplete="off" /></label>
          <label><span className="adm-label">Rank</span><input value={invite.rank_title} onChange={e => setInvite(v => v && ({ ...v, rank_title: e.target.value }))} placeholder="e.g. Letda" /></label>
        </div>
        <Seg label="Role" value={invite.role} onChange={v => setInvite(d => d && ({ ...d, role: v }))} options={[["viewer", "Viewer"], ["operator", "Operator"], ["officer", "Officer"]]} />
        <Seg label="Department" value={invite.department_code} onChange={v => setInvite(d => d && ({ ...d, department_code: v }))} options={DEPTS} />
        <ClassPicker value={invite.stock_classes} onChange={v => setInvite(d => d && ({ ...d, stock_classes: v }))} />
        {formErr && <p className="dg-note dg-err" role="alert">{formErr}</p>}
        <div className="adm-actions"><button type="button" className="dg-btn" onClick={() => setInvite(null)} disabled={saving}>Cancel</button><button type="button" className="dg-btn dg-btn-accent" onClick={sendInvite} disabled={saving}>{saving ? "Sending…" : "Send invitation"}</button></div>
      </div></div></Portal>}
  </section>;
}
