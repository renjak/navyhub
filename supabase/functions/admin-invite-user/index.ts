import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return response({ error: "Server auth is not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const actor = authData.user;
    if (authError || !actor) return response({ error: "Invalid session" }, 401);

    const { data: actorProfile, error: profileError } = await admin
      .from("profiles")
      .select("id,unit_id,role,is_active")
      .eq("id", actor.id)
      .maybeSingle();

    if (profileError || !actorProfile || !actorProfile.is_active || actorProfile.role !== "admin" || !actorProfile.unit_id) {
      return response({ error: "Only an active unit Admin can invite personnel" }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const rankTitle = String(body.rank_title || "").trim();
    const departmentCode = String(body.department_code || "").trim().toUpperCase();
    const role = String(body.role || "viewer").trim().toLowerCase();
    const isDepartmentHead = body.is_department_head === true;
    const canAccessClassV = body.can_access_class_v === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ error: "Email tidak valid" }, 400);
    if (fullName.length < 3 || fullName.length > 120) return response({ error: "Nama lengkap wajib diisi (3–120 karakter)" }, 400);
    if (!["OPS", "SIN", "EKA", "LOG"].includes(departmentCode)) return response({ error: "Departemen tidak valid" }, 400);
    if (!["officer", "operator", "viewer"].includes(role)) return response({ error: "Role akun tidak diizinkan" }, 400);
    if (isDepartmentHead && !departmentCode) return response({ error: "Kepala departemen harus memiliki departemen" }, 400);
    if (canAccessClassV && departmentCode !== "SIN") return response({ error: "Akses Class V hanya dapat diberikan pada akun Departemen Senjata" }, 403);

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, rank_title: rankTitle, unit_id: actorProfile.unit_id },
    });
    if (inviteError || !invited.user) return response({ error: inviteError?.message || "Undangan gagal dibuat" }, 400);

    const { data: savedProfile, error: saveError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        rank_title: rankTitle || null,
        unit_id: actorProfile.unit_id,
        role,
        department_code: departmentCode,
        is_department_head: isDepartmentHead,
        can_access_class_v: canAccessClassV,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invited.user.id)
      .select("id,full_name,rank_title,unit_id,role,is_active,department_code,is_department_head,can_access_class_v")
      .single();

    if (saveError || !savedProfile) {
      await admin.auth.admin.deleteUser(invited.user.id);
      return response({ error: "Profil akun gagal disiapkan; undangan dibatalkan. " + (saveError?.message || "") }, 500);
    }

    await admin.from("audit_logs").insert({
      unit_id: actorProfile.unit_id,
      actor_id: actor.id,
      action: "invite_department_user",
      table_name: "profiles",
      record_id: invited.user.id,
      new_data: {
        email,
        full_name: fullName,
        role,
        department_code: departmentCode,
        is_department_head: isDepartmentHead,
        can_access_class_v: canAccessClassV,
      },
    });

    return response({ success: true, profile: savedProfile, message: "Undangan email berhasil dikirim." });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
