import { supabase } from "@/lib/supabase"

export type CreateUserInput = {
  role: "staff" | "student"
  name: string
  email: string
  password: string
  studentId?: string
  departmentId?: string | null
  year?: number | null
  section?: string | null
}

export async function createManagedUser(input: CreateUserInput) {
  if (input.role === "staff") {
    const { error } = await supabase.from("staff").insert({
      name: input.name,
      email: input.email,
      password: input.password,
      department_id: input.departmentId || null
    })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("students").insert({
      name: input.name,
      email: input.email,
      password: input.password,
      student_id: input.studentId!,
      department_id: input.departmentId || null,
      year: input.year || null,
      section: input.section || null
    })
    if (error) throw new Error(error.message)
  }
}

export async function removeManagedUser(targetId: string) {
  // Attempt to delete from staff first, then from students.
  const { error: staffError } = await supabase.from("staff").delete().eq("id", targetId)
  if (staffError) throw new Error(staffError.message)
  
  const { error: studentError } = await supabase.from("students").delete().eq("id", targetId)
  if (studentError) throw new Error(studentError.message)
}
