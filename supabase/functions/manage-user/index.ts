import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ManageUserRequest = {
  action: "create" | "remove"
  role?: "staff" | "student"
  targetId?: string
  name?: string
  email?: string
  password?: string
  studentId?: string
  departmentId?: string | null
  year?: number | null
  section?: string | null
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405)

  const authorization = request.headers.get("Authorization")
  if (!authorization) return response({ error: "Authentication required" }, 401)

  const url = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) return response({ error: "Invalid session" }, 401)

  const { data: callerProfile, error: callerError } = await adminClient.from("profiles").select("role").eq("id", userData.user.id).single()
  if (callerError || !callerProfile || !["admin", "staff"].includes(callerProfile.role)) return response({ error: "You do not have management access" }, 403)

  let body: ManageUserRequest
  try { body = await request.json() } catch { return response({ error: "Invalid request body" }, 400) }

  if (body.action === "create") {
    if (!body.role || !body.name?.trim() || !body.email?.trim() || !body.password) return response({ error: "Name, email, password, and role are required" }, 400)
    if (body.password.length < 8) return response({ error: "Temporary password must be at least 8 characters" }, 400)
    if (callerProfile.role === "staff" && body.role !== "student") return response({ error: "Staff can only add students" }, 403)
    if (body.role === "student" && !body.studentId?.trim()) return response({ error: "Student ID is required" }, 400)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name.trim() },
    })
    if (createError || !created.user) return response({ error: createError?.message ?? "Unable to create user" }, 400)

    const { error: profileError } = await adminClient.from("profiles").update({ name: body.name.trim(), role: body.role }).eq("id", created.user.id)
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return response({ error: profileError.message }, 400)
    }

    if (body.role === "student") {
      const { error: studentError } = await adminClient.from("students").insert({
        profile_id: created.user.id,
        student_id: body.studentId!.trim(),
        department_id: body.departmentId || null,
        year: body.year || null,
        section: body.section?.trim() || null,
      })
      if (studentError) {
        await adminClient.auth.admin.deleteUser(created.user.id)
        return response({ error: studentError.message }, 400)
      }
    }

    return response({ success: true, id: created.user.id })
  }

  if (body.action === "remove") {
    if (!body.targetId) return response({ error: "Target user is required" }, 400)
    if (body.targetId === userData.user.id) return response({ error: "You cannot remove your own account" }, 400)

    const { data: target, error: targetError } = await adminClient.from("profiles").select("role").eq("id", body.targetId).single()
    if (targetError || !target) return response({ error: "User not found" }, 404)
    if (target.role === "admin" || (callerProfile.role === "staff" && target.role !== "student")) return response({ error: "You cannot remove this user" }, 403)

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.targetId)
    if (deleteError) return response({ error: deleteError.message }, 400)
    return response({ success: true })
  }

  return response({ error: "Unsupported action" }, 400)
})
