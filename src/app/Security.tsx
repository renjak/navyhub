"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Portal from "./Portal";
import { useNav } from "./NavRuntime";

/* Idle sign-out (audit 2026-11-26, F3). Two-step verification was removed on owner request
   (2026-11-26); sign-in is email + password.
   - Sign-out after 15 minutes without activity, with a 60-second warning, synced across tabs.
   - While this device is the Master GPS the screen is locked instead, so position reporting
     continues; unlocking needs the account password. */

const IDLE_MIN = 15;
const IDLE_MS = IDLE_MIN * 60_000, WARN_MS = 60_000, KEY = "alnav-last-activity";
const readLast = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };

export function IdleGuard({ sb, email }: { sb: SupabaseClient; email: string }) {
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
      const idle = Date.now() - Math.max(last.current, readLast());
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
  if (phase === "locked") return <LockScreen sb={sb} email={email} onUnlock={() => { last.current = 0; setPhase("active"); touch(); }} />;
  return null;
}

function LockScreen({ sb, email, onUnlock }: { sb: SupabaseClient; email: string; onUnlock: () => void }) {
  const [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr("Password not accepted."); return; }
    setPassword(""); onUnlock();
  };
  return <Portal><div className="dg-sec-lock" role="dialog" aria-modal="true" aria-label="Screen locked" data-lenis-prevent>
    <form className="loginbox dg-sec-box" onSubmit={submit}>
      <img className="alnav-brand-logo alnav-login-logo" src="/branding/alnav-dms-logo.jpg" alt="Official ALNAV DMS logo" />
      <small>SCREEN LOCKED</small><h1 className="dg-sec-title">Locked</h1>
      <p>No activity for {IDLE_MIN} minutes. Master GPS keeps sending the ship position while locked.</p>
      <label>Password for {email}</label>
      <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
      {err && <div className="error" role="alert">{err}</div>}
      <button disabled={busy}>{busy ? "Checking…" : "Unlock"}</button>
      <button type="button" className="dg-sec-link" onClick={() => void sb.auth.signOut()}>Sign out (stops Master GPS)</button>
    </form>
  </div></Portal>;
}
