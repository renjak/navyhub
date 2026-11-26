"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import Portal from "./Portal";
import { useNav } from "./NavRuntime";

/* Account security (audit 2026-11-26, F3).
   - Two-step verification (TOTP authenticator app). Once an account has a verified factor the
     database only answers AAL2 sessions (migration require_mfa_when_enrolled), so the UI here is
     convenience; enforcement is server-side.
   - Admin and Commander must enrol before using the app; other roles may enrol.
   - Idle sign-out after 15 minutes. While this device is the Master GPS the screen is locked
     instead, so position reporting continues; unlocking needs the password (and code). */

const MANDATORY_ROLES = ["admin", "commander"];
export const mfaRequiredFor = (role?: string | null) => !!role && MANDATORY_ROLES.includes(role);

type MfaStatus = "checking" | "challenge" | "ok";
export type MfaState = { status: MfaStatus; factorId: string | null; recheck: () => Promise<void> };

export function useMfa(sb: SupabaseClient, user: User | null): MfaState {
  const uid = user?.id ?? null;
  const [state, setState] = useState<{ uid: string | null; status: MfaStatus; factorId: string | null }>({ uid: null, status: "ok", factorId: null });
  const check = useCallback(async () => {
    if (!uid) { setState({ uid: null, status: "ok", factorId: null }); return; }
    const [aal, factors] = await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()]);
    const verified = (factors.data?.totp || []).find(f => f.status === "verified");
    const needs = aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2";
    // If the check itself fails the app continues; the database still refuses AAL1 sessions of enrolled accounts.
    setState({ uid, status: needs ? "challenge" : "ok", factorId: verified?.id ?? null });
  }, [sb, uid]);
  useEffect(() => { void check(); }, [check]);
  // Until the check for this user has finished, report "checking" so nothing renders early.
  const status: MfaStatus = uid && state.uid !== uid ? "checking" : state.status;
  return { status, factorId: uid && state.uid === uid ? state.factorId : null, recheck: check };
}

const codeOk = (c: string) => /^\d{6}$/.test(c);

function CodeInput({ value, onChange, autoFocus = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return <input className="dg-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
    placeholder="000000" aria-label="6-digit code" autoFocus={autoFocus} value={value}
    onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} required />;
}

function SecurityScreen({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="login"><section className="loginbox dg-sec-box">
    <img className="alnav-brand-logo alnav-login-logo" src="/branding/alnav-dms-logo.jpg" alt="Official ALNAV DMS logo" />
    <small>{eyebrow}</small><h1 className="dg-sec-title">{title}</h1>
    {children}
  </section></main>;
}

/* Sign-in step 2: account already has an authenticator. */
export function MfaChallenge({ sb, factorId, onDone, onSignOut }: { sb: SupabaseClient; factorId: string | null; onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) { setErr("No authenticator found for this account. Contact the administrator."); return; }
    if (!codeOk(code)) { setErr("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { setErr("Code not accepted. Check the time on your phone and try the newest code."); setCode(""); return; }
    onDone();
  };
  return <SecurityScreen eyebrow="TWO-STEP VERIFICATION" title="Enter code">
    <p>Open your authenticator app and enter the 6-digit code for ALNAV DMS.</p>
    <form onSubmit={submit}>
      <label>Authentication code</label>
      <CodeInput value={code} onChange={setCode} />
      {err && <div className="error" role="alert">{err}</div>}
      <button disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
    </form>
    <button type="button" className="dg-sec-link" onClick={onSignOut}>Sign out</button>
  </SecurityScreen>;
}

/* Enrolment: shows QR + secret, verifies the first code. */
function EnrollForm({ sb, onDone, onCancel, cancelLabel, onUnavailable }: { sb: SupabaseClient; onDone: () => void; onCancel?: () => void; cancelLabel?: string; onUnavailable?: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [setupErr, setSetupErr] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    (async () => {
      const list = await sb.auth.mfa.listFactors();
      for (const f of (list.data?.all || [])) if (f.factor_type === "totp" && f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "ALNAV DMS " + new Date().toISOString().slice(0, 16).replace("T", " ") });
      if (error || !data) { setSetupErr(error?.message || "Two-step verification could not be started."); return; }
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [sb]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    if (!codeOk(code)) { setErr("Enter the 6-digit code shown in the app."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) { setErr("Code not accepted. Wait for a new code and try again."); setCode(""); return; }
    onDone();
  };
  if (setupErr) return <div className="dg-sec-enroll">
    <div className="error" role="alert">Two-step verification is not available on the server yet: {setupErr}</div>
    {onUnavailable && <button type="button" onClick={onUnavailable}>Continue without two-step verification for now</button>}
    {onCancel && <button type="button" className="dg-sec-link" onClick={onCancel}>{cancelLabel || "Cancel"}</button>}
  </div>;
  return <form className="dg-sec-enroll" onSubmit={submit}>
    <ol className="dg-sec-steps">
      <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis or similar).</li>
      <li>Scan this QR code, or type the key manually.</li>
      <li>Enter the 6-digit code the app shows.</li>
    </ol>
    <div className="dg-sec-qr">{factor ? <img src={factor.qr} alt="QR code for the authenticator app" width={180} height={180} /> : <span>Preparing…</span>}</div>
    {factor && <details className="dg-sec-secret"><summary>Can&apos;t scan? Show setup key</summary><code>{factor.secret}</code></details>}
    <label>Authentication code</label>
    <CodeInput value={code} onChange={setCode} autoFocus={false} />
    {err && <div className="error" role="alert">{err}</div>}
    <button disabled={busy || !factor}>{busy ? "Verifying…" : "Turn on two-step verification"}</button>
    {onCancel && <button type="button" className="dg-sec-link" onClick={onCancel}>{cancelLabel || "Cancel"}</button>}
  </form>;
}

/* Required for Admin/Commander before the app opens. */
export function MfaEnrollRequired({ sb, roleLabel, onDone, onSignOut, onUnavailable }: { sb: SupabaseClient; roleLabel: string; onDone: () => void; onSignOut: () => void; onUnavailable: () => void }) {
  return <SecurityScreen eyebrow="ACCOUNT SECURITY" title="Set up two-step verification">
    <p>{roleLabel} accounts must use two-step verification. After this, signing in needs your password and a code from your phone.</p>
    <EnrollForm sb={sb} onDone={onDone} onCancel={onSignOut} cancelLabel="Sign out" onUnavailable={onUnavailable} />
  </SecurityScreen>;
}

/* Sidebar dialog: status, optional enrolment, removal for non-mandatory roles. */
export function SecurityDialog({ sb, role, factorId, onClose, onChanged }: { sb: SupabaseClient; role: string; factorId: string | null; onClose: () => void; onChanged: () => void }) {
  const [enrolling, setEnrolling] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const mandatory = mfaRequiredFor(role);
  const remove = async () => {
    if (!factorId || mandatory) return;
    if (!window.confirm("Turn off two-step verification for this account?")) return;
    setBusy(true);
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) setMsg("Could not turn it off: " + error.message); else { setMsg("Two-step verification is off."); onChanged(); }
  };
  return <Portal><div className="dg-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Account security" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dg-modal-card dg-editor dg-sec-dialog">
      <div className="dg-card-head"><div><div className="dg-eyebrow">Account security</div><h2 className="dg-h dg-card-title">Two-step verification</h2>
        <span className={"dg-pill " + (factorId ? "dg-pill-live" : "dg-pill-stale")}><i />{factorId ? "On · authenticator app" : "Off"}</span></div>
        <div className="dg-head-actions"><button type="button" className="dg-btn" onClick={onClose}>Close</button></div></div>
      {factorId ? <p>Signing in needs your password and a 6-digit code from your authenticator app. Without the code, the database returns no data for this account.</p>
        : <p>Add a code from your phone to the sign-in. Recommended for every account; required for Admin and Commander.</p>}
      {!factorId && !enrolling && <div><button type="button" className="dg-btn dg-btn-accent" onClick={() => setEnrolling(true)}>Set up two-step verification</button></div>}
      {!factorId && enrolling && <EnrollForm sb={sb} onDone={() => { setEnrolling(false); setMsg("Two-step verification is on."); onChanged(); }} onCancel={() => setEnrolling(false)} />}
      {factorId && !mandatory && <div><button type="button" className="dg-btn" disabled={busy} onClick={remove}>Turn off</button></div>}
      {factorId && mandatory && <small>Required for {role === "admin" ? "Admin" : "Commander"} accounts. Lost phone: ask the main administrator to reset it in Supabase Auth.</small>}
      <small>Automatic sign-out after {IDLE_MIN} minutes without activity. While this device is the Master GPS, the screen locks instead.</small>
      {msg && <p className="dg-note" role="status">{msg}</p>}
    </div></div></Portal>;
}

/* ---------- Idle sign-out / lock ---------- */
const IDLE_MIN = 15;
const IDLE_MS = IDLE_MIN * 60_000, WARN_MS = 60_000, KEY = "alnav-last-activity";
const readLast = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };

export function IdleGuard({ sb, email, factorId }: { sb: SupabaseClient; email: string; factorId: string | null }) {
  const { tracking } = useNav();
  const last = useRef(Date.now());
  const [phase, setPhase] = useState<"active" | "warn" | "locked">("active");
  const [left, setLeft] = useState(60);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const trackingRef = useRef(tracking); trackingRef.current = tracking;

  const touch = useCallback(() => {
    const now = Date.now();
    if (now - last.current < 5000 && phaseRef.current === "active") return;
    last.current = now;
    try { localStorage.setItem(KEY, String(now)); } catch { /* per-tab only */ }
    if (phaseRef.current === "warn") setPhase("active");
  }, []);

  useEffect(() => {
    last.current = Math.max(Date.now(), readLast());
    try { localStorage.setItem(KEY, String(last.current)); } catch { /* ignore */ }
    const onAct = () => { if (phaseRef.current !== "locked") touch(); };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    evs.forEach(e => window.addEventListener(e, onAct, { passive: true, capture: true }));
    const tick = () => {
      if (phaseRef.current === "locked") return;
      const lastAny = Math.max(last.current, readLast());
      const idle = Date.now() - lastAny;
      if (idle >= IDLE_MS) {
        if (trackingRef.current) setPhase("locked");
        else void sb.auth.signOut();
      } else if (idle >= IDLE_MS - WARN_MS) { setPhase("warn"); setLeft(Math.ceil((IDLE_MS - idle) / 1000)); }
      else if (phaseRef.current === "warn") setPhase("active");
    };
    const iv = window.setInterval(tick, 1000);
    const vis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { evs.forEach(e => window.removeEventListener(e, onAct, { capture: true } as any)); window.clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [sb, touch]);

  if (phase === "warn") return <Portal><div className="dg-modal dg-sec-idle" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
    <div className="dg-modal-card dg-editor dg-sec-dialog">
      <h3 id="idle-title">Still there?</h3>
      <p>For security you will be {tracking ? "locked out" : "signed out"} in <b>{left}</b> seconds because there was no activity.</p>
      <div className="dg-head-actions"><button type="button" className="dg-btn dg-btn-accent" onClick={() => { last.current = 0; touch(); }} autoFocus>Stay signed in</button>
        <button type="button" className="dg-btn" onClick={() => void sb.auth.signOut()}>Sign out now</button></div>
    </div></div></Portal>;
  if (phase === "locked") return <LockScreen sb={sb} email={email} factorId={factorId} onUnlock={() => { last.current = 0; setPhase("active"); touch(); }} />;
  return null;
}

function LockScreen({ sb, email, factorId, onUnlock }: { sb: SupabaseClient; email: string; factorId: string | null; onUnlock: () => void }) {
  const [password, setPassword] = useState(""), [code, setCode] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setBusy(false); setErr("Password not accepted."); return; }
    if (factorId) {
      if (!codeOk(code)) { setBusy(false); setErr("Enter the 6-digit code."); return; }
      const v = await sb.auth.mfa.challengeAndVerify({ factorId, code });
      if (v.error) { setBusy(false); setErr("Code not accepted."); setCode(""); return; }
    }
    setBusy(false); setPassword(""); setCode(""); onUnlock();
  };
  return <Portal><div className="dg-sec-lock" role="dialog" aria-modal="true" aria-label="Screen locked" data-lenis-prevent>
    <form className="loginbox dg-sec-box" onSubmit={submit}>
      <img className="alnav-brand-logo alnav-login-logo" src="/branding/alnav-dms-logo.jpg" alt="Official ALNAV DMS logo" />
      <small>SCREEN LOCKED</small><h1 className="dg-sec-title">Locked</h1>
      <p>No activity for {IDLE_MIN} minutes. Master GPS keeps sending the ship position while locked.</p>
      <label>Password for {email}</label>
      <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
      {factorId && <><label>Authentication code</label><CodeInput value={code} onChange={setCode} autoFocus={false} /></>}
      {err && <div className="error" role="alert">{err}</div>}
      <button disabled={busy}>{busy ? "Checking…" : "Unlock"}</button>
      <button type="button" className="dg-sec-link" onClick={() => void sb.auth.signOut()}>Sign out (stops Master GPS)</button>
    </form>
  </div></Portal>;
}
