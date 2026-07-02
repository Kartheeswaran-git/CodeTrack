import { type FormEvent, type ReactNode, useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { Building2, GraduationCap, Mail, Pencil, Plus, Search, Trash2, UserCog, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAdminData } from "@/lib/admin-data"
import { createManagedUser, removeManagedUser } from "@/lib/manage-users"
import { supabase } from "@/lib/supabase"

const selectClass = "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"

function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p></div>{action}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></div>{children}</div></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>
}

function Notice({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null
  return <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error ?? success}</div>
}

export function StaffManagementPage() {
  const { staff, departments, refresh } = useAdminData()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", departmentId: "" })
  const filtered = staff.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(query.toLowerCase()))

  const addStaff = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      await createManagedUser({ role: "staff", ...form })
      await refresh(); setOpen(false); setForm({ name: "", email: "", password: "", departmentId: "" }); setSuccess(`Login created for ${form.email}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add staff member") }
    finally { setSaving(false) }
  }

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? Their login and profile will be deleted.`)) return
    setError(null)
    try { await removeManagedUser(id); await refresh(); setSuccess(`${name} was removed`) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove staff member") }
  }

  return <div className="space-y-6"><Header eyebrow="Admin access" title="Staff management" description="Create and remove staff accounts. Email is used only as the login username." action={<Button onClick={() => setOpen(true)} className="gap-2 bg-violet-600 text-white"><Plus className="h-4 w-4" /> Add staff</Button>} /><Notice error={error} success={success} /><div className="grid gap-4 sm:grid-cols-2"><Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-zinc-500">Staff accounts</p><p className="mt-1 text-2xl font-bold">{staff.length}</p></div><UserCog className="h-6 w-6 text-violet-600" /></CardContent></Card><Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-zinc-500">Student assignments</p><p className="mt-1 text-2xl font-bold">{staff.reduce((sum, member) => sum + member.assignedStudents, 0)}</p></div><Users className="h-6 w-6 text-violet-600" /></CardContent></Card></div><div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff..." className="pl-9" /></div><div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950"><tr><th className="px-5 py-3">Staff member</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Assigned students</th><th className="px-5 py-3 text-right">Access</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{filtered.map((member) => <tr key={member.id}><td className="px-5 py-4 font-semibold">{member.name}</td><td className="px-5 py-4 text-zinc-500"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{member.email}</span></td><td className="px-5 py-4">{member.department ?? "—"}</td><td className="px-5 py-4">{member.assignedStudents}</td><td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => void remove(member.id, member.name)} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /> Remove</Button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-8 text-center text-sm text-zinc-500">No staff accounts found.</p>}</div>{open && <Modal title="Add staff member" onClose={() => setOpen(false)}><form onSubmit={(event) => void addStaff(event)} className="space-y-4"><Field label="Full name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Email address"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Field label="Temporary password"><Input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field><Field label="Department"><select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className={selectClass}><option value="">Not assigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field><p className="text-xs leading-5 text-zinc-500">No email is sent. Give this temporary password to the staff member securely.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? "Creating login..." : "Create staff"}</Button></div></form></Modal>}</div>
}

export function StudentManagementPage({ actorRole }: { actorRole: "admin" | "staff" }) {
  const navigate = useNavigate()
  const { students: adminStudents, departments, refresh } = useAdminData()
  const [staffStudents, setStaffStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", studentId: "", departmentId: "", year: "", section: "" })

  const fetchStaffStudents = async () => {
    if (actorRole !== "staff") return
    setLoading(true)
    const stored = localStorage.getItem('staff')
    const staff = stored ? JSON.parse(stored) : null
    if (!staff) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc("get_staff_students", {
      p_staff_id: staff.id,
      p_password: staff.password
    })
    if (error) {
      setError(error.message)
    } else if (data) {
      setStaffStudents(data.map((student: any) => ({
        id: student.id,
        profileId: student.id,
        studentId: student.student_id,
        name: student.name,
        email: student.email,
        departmentId: student.department_id,
        department: student.department_name,
        year: student.year,
        section: student.section,
        phone: student.phone
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (actorRole === "staff") {
      void fetchStaffStudents()
    }
  }, [actorRole])

  const students = actorRole === "admin" ? adminStudents : staffStudents
  const filtered = students.filter((student) => `${student.name} ${student.email} ${student.studentId}`.toLowerCase().includes(query.toLowerCase()))

  const addStudent = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      if (actorRole === "admin") {
        await createManagedUser({ role: "student", name: form.name, email: form.email, password: form.password, studentId: form.studentId, departmentId: form.departmentId || null, year: form.year ? Number(form.year) : null, section: form.section || null })
      } else {
        const stored = localStorage.getItem('staff')
        const staff = stored ? JSON.parse(stored) : null
        if (!staff) throw new Error("No staff session found.")

        const { error: rpcError } = await supabase.rpc("create_student_by_staff", {
          p_staff_id: staff.id,
          p_password: staff.password,
          p_name: form.name,
          p_email: form.email,
          p_student_password: form.password,
          p_student_id: form.studentId,
          p_department_id: staff.department_id || null,
          p_year: form.year ? Number(form.year) : null,
          p_section: form.section || null
        })
        if (rpcError) throw new Error(rpcError.message)
        await fetchStaffStudents()
      }
      await refresh(); setOpen(false); setForm({ name: "", email: "", password: "", studentId: "", departmentId: "", year: "", section: "" }); setSuccess(`Login created for ${form.email}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add student") }
    finally { setSaving(false) }
  }

  const remove = async (profileId: string, name: string) => {
    if (!window.confirm(`Remove ${name}? Their login and student data will be deleted.`)) return
    setError(null)
    try {
      if (actorRole === "admin") {
        await removeManagedUser(profileId)
      } else {
        const stored = localStorage.getItem('staff')
        const staff = stored ? JSON.parse(stored) : null
        if (!staff) throw new Error("No staff session found.")

        const { error: rpcError } = await supabase.rpc("delete_student_by_staff", {
          p_staff_id: staff.id,
          p_password: staff.password,
          p_student_id: profileId
        })
        if (rpcError) throw new Error(rpcError.message)
        await fetchStaffStudents()
      }
      await refresh(); setSuccess(`${name} was removed`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove student") }
  }

  return <div className="space-y-6"><Header eyebrow={`${actorRole} access`} title="Student management" description={actorRole === "admin" ? "Create and remove student accounts. Email is used only as the login username." : "Create, view, and manage student accounts in your department."} action={<Button onClick={() => setOpen(true)} className="gap-2 bg-violet-600 text-white"><Plus className="h-4 w-4" /> Add student</Button>} /><Notice error={error} success={success} />{loading && <div className="text-sm text-zinc-500">Loading department students...</div>}<Card className="max-w-xs border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-zinc-500">Student accounts</p><p className="mt-1 text-2xl font-bold">{students.length}</p></div><GraduationCap className="h-6 w-6 text-violet-600" /></CardContent></Card><div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students..." className="pl-9" /></div><div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Student ID</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Class</th><th className="px-5 py-3 text-right">Access</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{filtered.map((student) => <tr key={student.id} onClick={() => actorRole === "staff" && navigate(`/staff/students/${student.id}`)} onKeyDown={(event) => { if (actorRole === "staff" && (event.key === "Enter" || event.key === " ")) navigate(`/staff/students/${student.id}`) }} tabIndex={actorRole === "staff" ? 0 : undefined} className={actorRole === "staff" ? "cursor-pointer transition hover:bg-violet-50/70 focus:bg-violet-50 focus:outline-none dark:hover:bg-violet-950/20" : ""}><td className="px-5 py-4"><p className="font-semibold">{student.name}</p><p className="text-xs text-zinc-500">{student.email}</p></td><td className="px-5 py-4 font-medium">{student.studentId}</td><td className="px-5 py-4">{student.department ?? "—"}</td><td className="px-5 py-4">{student.year ? `Year ${student.year}${student.section ? ` · ${student.section}` : ""}` : "—"}</td><td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); void remove(student.profileId || student.id, student.name || student.studentId) }} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /> Remove</Button></td></tr>)}</tbody></table>{!filtered.length && !loading && <p className="p-8 text-center text-sm text-zinc-500">No student accounts found.</p>}</div>{open && <Modal title="Add student" onClose={() => setOpen(false)}><form onSubmit={(event) => void addStudent(event)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Email address"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Field label="Temporary password"><Input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field><Field label="Student ID"><Input required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} /></Field>{actorRole === "admin" && <Field label="Department"><select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className={selectClass}><option value="">Not assigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>}<Field label="Year"><select value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} className={selectClass}><option value="">Not assigned</option>{[1, 2, 3, 4, 5].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></Field><Field label="Section"><Input value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value.toUpperCase() })} maxLength={4} /></Field></div><p className="text-xs leading-5 text-zinc-500">No email is sent. Give this temporary password to the student securely.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? "Creating login..." : "Create student"}</Button></div></form></Modal>}</div>
}

export function DepartmentManagementPage() {
  const { departments, students, refresh } = useAdminData()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const filtered = departments.filter((department) => department.name.toLowerCase().includes(query.toLowerCase()))

  const showCreate = () => {
    setEditingId(null)
    setName("")
    setError(null)
    setOpen(true)
  }

  const showEdit = (id: string, departmentName: string) => {
    setEditingId(id)
    setName(departmentName)
    setError(null)
    setOpen(true)
  }

  const saveDepartment = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const normalizedName = name.trim()
    const result = editingId
      ? await supabase.from("departments").update({ name: normalizedName }).eq("id", editingId)
      : await supabase.from("departments").insert({ name: normalizedName })

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    await refresh()
    setOpen(false)
    setSuccess(editingId ? "Department updated" : "Department created")
    setSaving(false)
  }

  return <div className="space-y-6">
    <Header eyebrow="Admin access" title="Department management" description="Create departments and update their names. These actions are restricted to administrators." action={<Button onClick={showCreate} className="gap-2 bg-violet-600 text-white"><Plus className="h-4 w-4" /> Add department</Button>} />
    <Notice error={error} success={success} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-zinc-500">Departments</p><p className="mt-1 text-2xl font-bold">{departments.length}</p></div><Building2 className="h-6 w-6 text-violet-600" /></CardContent></Card>
      <Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-zinc-500">Assigned students</p><p className="mt-1 text-2xl font-bold">{students.filter((student) => student.departmentId).length}</p></div><GraduationCap className="h-6 w-6 text-violet-600" /></CardContent></Card>
    </div>
    <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search departments..." className="pl-9" /></div>
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950"><tr><th className="px-5 py-3">Department</th><th className="px-5 py-3">Students</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{filtered.map((department) => <tr key={department.id}><td className="px-5 py-4 font-semibold">{department.name}</td><td className="px-5 py-4">{students.filter((student) => student.departmentId === department.id).length}</td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" onClick={() => showEdit(department.id, department.name)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</Button></td></tr>)}</tbody></table>
      {!filtered.length && <p className="p-8 text-center text-sm text-zinc-500">No departments found.</p>}
    </div>
    {open && <Modal title={editingId ? "Edit department" : "Add department"} onClose={() => setOpen(false)}><form onSubmit={(event) => void saveDepartment(event)} className="space-y-4"><Field label="Department name"><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Computer Science" /></Field><p className="text-xs text-zinc-500">Department names must be unique.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? "Saving..." : editingId ? "Save changes" : "Create department"}</Button></div></form></Modal>}
  </div>
}
