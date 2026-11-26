import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/* Admin account removal / restore (owner, 26 Nov 2026).
   action "delete": an account with no linked records is deleted permanently. An account that
   already appears in operational records (logbook, stock, checklists, watch, maintenance, PHST,
   GPS) is NOT hard-deleted, so history stays intact: sign-in is blocked (ban) and the profile is
   deactivated. action "restore": lifts the block and reactivates the profile.
   Only the active Admin of the same unit; never the Admin's own account or another Admin. */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

// every column that points at a person; a hit means the account has history
const LINKS: Array<[string, string]> = [
  ["activity_logs", "created_by"], ["activity_logs", "verified_by"], ["checklist_runs", "performed_by"], ["checklists", "created_by"],
  ["daily_watch_assignments", "selected_by"], ["daily_watch_reports", "created_by"], ["daily_watch_reports", "approved_by"],
  ["maintenance_records", "reported_by"], ["maintenance_records", "assigned_to"], ["phst_execution_records", "executed_by"],
  ["phst_schedule_items", "created_by"], ["phst_templates", "created_by"], ["phst_verifications", "verified_by"],
  ["phst_checklist_items", "checked_by"], ["sea_watch_rotations", "set_by"], ["stock_movements", "recorded_by"],
  ["stock_movements", "approved_by"], ["vessel_gps_positions", "reporter_user_id"], ["audit_logs", "actor_id"],
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return response({ error: "Server auth is not configured" }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const actor = authData.user;
    if (authError || !actor) return response({ error: "Invalid session" }, 401);
    const { data: me } = await admin.from("profiles").select("id,unit_id,role,is_active").eq("id", actor.id).maybeSingle();
    if (!me || !me.is_active || me.role !== "admin" || !me.unit_id) return response({ error: "Only an active Admin can manage accounts" }, 403);

    const body = await req.json();
    const action = String(body.action || "");
    const targetId = String(body.profile_id || "");
    if (!["delete", "restore"].includes(action) || !/^[0-9a-f-]{36}$/i.test(targetId)) return response({ error: "Invalid request" }, 400);
    if (targetId === me.id) return response({ error: "You cannot remove your own Admin account" }, 403);
    const { data: target } = await admin.from("profiles").select("id,unit_id,role,full_name,is_active").eq("id", targetId).maybeSingle();
    if (!target || target.unit_id !== me.unit_id) return response({ error: "Account not found in this unit" }, 404);
    if (target.role === "admin") return response({ error: "An Admin account cannot be removed here" }, 403);

    const audit = (act: string, extra: Record<string, unknown>) => admin.from("audit_logs").insert({ unit_id: me.unit_id, actor_id: me.id, action: act, table_name: "profiles", record_id: targetId, old_data: { full_name: target.full_name, is_active: target.is_active }, new_data: extra });

    if (action === "restore") {
      const { error: banErr } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      if (banErr) return response({ error: "Could not restore sign-in: " + banErr.message }, 400);
      const { error: upErr } = await admin.from("profiles").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", targetId);
      if (upErr) return response({ error: "Could not reactivate the profile: " + upErr.message }, 400);
      await audit("admin_restore_account", { is_active: true, sign_in: "allowed" });
      return response({ success: true, result: "restored" });
    }

    let linked = 0;
    for (const [table, column] of LINKS) {
      const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, targetId);
      if (error) return response({ error: "Could not check account history (" + table + "): " + error.message }, 500);
      linked += count || 0;
      if (linked) break;
    }

    if (linked) {
      const { error: banErr } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      if (banErr) return response({ error: "Could not block sign-in: " + banErr.message }, 400);
      await admin.from("profiles").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", targetId);
      await audit("admin_remove_account_keep_history", { is_active: false, sign_in: "blocked", reason: "account has operational records" });
      return response({ success: true, result: "disabled", message: "This account has records, so its history is kept. Sign-in is blocked and the account is inactive." });
    }

    await audit("admin_delete_account", { deleted: true });
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return response({ error: "Could not delete the account: " + delErr.message }, 400);
    return response({ success: true, result: "deleted" });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
