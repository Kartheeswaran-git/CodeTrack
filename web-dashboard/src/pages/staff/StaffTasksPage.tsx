import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, UserPlus, Trash2, BarChart3, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { LeetCodeSearchInput } from "./LeetCodeSearchInput"

type Task = {
  id: string
  title: string
  description: string | null
  difficulty: string
  points: number
  due_date: string | null
  created_at: string
}

type Student = {
  student_uuid: string
  student_id: string
  name: string
}

const getStoredStaff = () => {
  const stored = localStorage.getItem('staff')
  return stored ? JSON.parse(stored) : null
}

export default function StaffTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals state
  const [createOpen, setCreateOpen] = useState(false)
  const [assignTask, setAssignTask] = useState<Task | null>(null)
  
  // Report state
  const [reportTask, setReportTask] = useState<Task | null>(null)
  const [reportData, setReportData] = useState<any[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  
  // Forms state
  const [form, setForm] = useState({ titles: [""], description: "", difficulty: "Easy", points: "10", dueDate: "" })
  const [saving, setSaving] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  const fetchData = async () => {
    const staff = getStoredStaff()
    if (!staff) return

    // 1. Fetch all tasks
    const { data: tasksData, error: tasksErr } = await supabase.rpc("get_all_tasks", {
      p_staff_id: staff.id,
      p_password: staff.password
    })

    // 2. Fetch assigned students list
    const { data: studentsData, error: studentsErr } = await supabase.rpc(
      "get_staff_assigned_students_progress",
      { p_staff_id: staff.id, p_password: staff.password }
    )

    if (tasksErr || studentsErr) {
      setError(tasksErr?.message || studentsErr?.message || "Error loading tasks data.")
    } else {
      setTasks(tasksData ?? [])
      setStudents(studentsData ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const staff = getStoredStaff()
    if (!staff) return

    let successCount = 0
    let lastError = null

    for (const title of form.titles) {
      if (!title.trim()) continue
      const { error } = await supabase.rpc("create_staff_task", {
        p_staff_id: staff.id,
        p_password: staff.password,
        p_title: title.trim(),
        p_description: form.description.trim() || null,
        p_difficulty: form.difficulty,
        p_points: Number(form.points),
        p_due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null
      })

      if (error) {
        lastError = error.message
      } else {
        successCount++
      }
    }

    if (lastError && successCount === 0) {
      alert(`Error creating task(s): ${lastError}`)
    } else if (lastError) {
      alert(`Created ${successCount} task(s), but encountered an error: ${lastError}`)
      setCreateOpen(false)
      setForm({ titles: [""], description: "", difficulty: "Easy", points: "10", dueDate: "" })
      await fetchData()
    } else {
      setCreateOpen(false)
      setForm({ titles: [""], description: "", difficulty: "Easy", points: "10", dueDate: "" })
      await fetchData()
      alert(`Successfully created ${successCount} task(s)!`)
    }
    setSaving(false)
  }

  const handleAssignTask = async () => {
    if (!assignTask || selectedStudents.length === 0) return
    setAssigning(true)

    const staff = getStoredStaff()
    if (!staff) return

    let successCount = 0
    let lastError = null

    for (const studentId of selectedStudents) {
      const { error } = await supabase.rpc("assign_staff_task", {
        p_staff_id: staff.id,
        p_password: staff.password,
        p_task_id: assignTask.id,
        p_student_id: studentId
      })
      if (error) {
        lastError = error.message
      } else {
        successCount++
      }
    }

    setAssigning(false)
    setAssignTask(null)
    setSelectedStudents([])

    if (lastError) {
      alert(`Assignment completed with error: ${lastError} (Successfully assigned: ${successCount})`)
    } else {
      alert(`Assigned task to ${successCount} students!`)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task? This will remove all student assignments and submissions for this task.")) {
      return
    }
    
    const staff = getStoredStaff()
    if (!staff) return

    const { error } = await supabase.rpc("delete_staff_task", {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_task_id: taskId
    })

    if (error) {
      alert(`Error deleting task: ${error.message}`)
    } else {
      await fetchData()
      alert("Task deleted successfully!")
    }
  }

  const fetchReport = async (task: Task) => {
    setReportTask(task)
    setReportLoading(true)
    const staff = getStoredStaff()
    if (!staff) return

    const { data, error } = await supabase.rpc("get_task_completion_report", {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_task_id: task.id
    })

    if (error) {
      alert(`Error generating report: ${error.message}`)
      setReportTask(null)
    } else {
      setReportData(data ?? [])
    }
    setReportLoading(false)
  }

  const downloadReportCSV = (taskTitle: string, data: any[]) => {
    const headers = ["Student Name", "Registration ID", "Email", "Status", "Submitted At", "Score (Pts)", "Remarks"];
    const rows = data.map(item => [
      item.student_name,
      item.student_id,
      item.email,
      item.assignment_status.toUpperCase(),
      item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "—",
      item.marks !== null ? item.marks : "—",
      item.remarks || "—"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Task_Report_${taskTitle.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <div className="text-center p-12 text-sm text-zinc-500">Loading tasks...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  const diffColor = (diff: string) => {
    switch (diff) {
      case 'Hard': return 'text-red-600 bg-red-50'
      case 'Medium': return 'text-amber-600 bg-amber-50'
      default: return 'text-emerald-600 bg-emerald-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
          <p className="text-sm text-zinc-500 mt-1">Create coding tasks and assign them to your students.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-violet-600 text-white gap-2">
          <Plus size={16} /> Create Task
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="shadow-sm border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${diffColor(task.difficulty)}`}>
                  {task.difficulty}
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  {task.points} pts
                </span>
              </div>
              <CardTitle className="text-sm font-bold mt-2 truncate">
                {task.title.startsWith('http') ? (() => {
                  try {
                    const urlObj = new URL(task.title);
                    const parts = urlObj.pathname.split('/').filter(Boolean);
                    const slug = parts[parts.indexOf('problems') + 1] || 'Task';
                    return `Solve: ${slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
                  } catch (e) {
                    return "LeetCode Assignment";
                  }
                })() : `LeetCode: #${task.title}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs text-zinc-500 leading-normal line-clamp-3">{task.description || "No description provided."}</p>
              
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                {task.due_date && (
                  <p className="text-[10px] text-zinc-400">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setAssignTask(task)} 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs gap-1"
                  >
                    <UserPlus size={12} /> Assign
                  </Button>
                  <Button 
                    onClick={() => fetchReport(task)} 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs gap-1"
                  >
                    <BarChart3 size={12} /> Report
                  </Button>
                  <Button 
                    onClick={() => handleDeleteTask(task.id)} 
                    variant="destructive" 
                    size="sm" 
                    className="px-2 bg-red-50 text-red-600 hover:bg-red-100 border-none"
                    aria-label="Delete Task"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Task Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <h3 className="font-bold text-base mb-4 text-zinc-800 dark:text-zinc-100">Create Coding Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-500">LeetCode Question Link(s) / Number(s)</label>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setForm({ ...form, titles: [...form.titles, ""] })}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {form.titles.map((title, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <LeetCodeSearchInput required placeholder="Search by name, number, or paste URL..." value={title} onChange={(val: string) => {
                        const newTitles = [...form.titles]
                        newTitles[index] = val
                        setForm({ ...form, titles: newTitles })
                      }} />
                    </div>
                    {form.titles.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => {
                        const newTitles = form.titles.filter((_, i) => i !== index)
                        setForm({ ...form, titles: newTitles })
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-zinc-500">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-500">Difficulty</label>
                  <select 
                    value={form.difficulty} 
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-zinc-700 shadow-sm outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-500">Points Awarded</label>
                  <Input type="number" required value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-zinc-500">Due Date</label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-violet-600 text-white">
                  {saving ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Assign Task Modal */}
      {assignTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <h3 className="font-bold text-base mb-2 text-zinc-800 dark:text-zinc-100">Assign: LeetCode #{assignTask.title}</h3>
            <div className="flex justify-between items-center mb-3">
              <p className="text-zinc-400">Select students to receive this task.</p>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStudents.length === students.length) {
                      setSelectedStudents([])
                    } else {
                      setSelectedStudents(students.map(s => s.student_uuid))
                    }
                  }}
                  className="text-violet-600 hover:text-violet-700 font-semibold hover:underline text-[11px]"
                >
                  {selectedStudents.length === students.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>
            
            <div className="max-h-[250px] overflow-auto border border-zinc-100 dark:border-zinc-800 rounded-lg p-2 space-y-2">
              {students.map((student) => {
                const isSelected = selectedStudents.includes(student.student_uuid)
                return (
                  <label key={student.student_uuid} className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents([...selectedStudents, student.student_uuid])
                        } else {
                          setSelectedStudents(selectedStudents.filter(id => id !== student.student_uuid))
                        }
                      }}
                      className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">{student.name}</p>
                      <p className="text-[10px] text-zinc-400">ID: {student.student_id}</p>
                    </div>
                  </label>
                )
              })}
              {students.length === 0 && (
                <p className="text-center text-zinc-400 py-6">You have no assigned students to assign tasks to.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" type="button" onClick={() => setAssignTask(null)}>Cancel</Button>
              <Button 
                onClick={handleAssignTask} 
                disabled={assigning || selectedStudents.length === 0} 
                className="bg-violet-600 text-white"
              >
                {assigning ? "Assigning..." : `Assign to ${selectedStudents.length} Students`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Task Completion Report Modal */}
      {reportTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <h3 className="font-bold text-base mb-1 text-zinc-800 dark:text-zinc-100">Completion Report: LeetCode #{reportTask.title}</h3>
            <p className="text-zinc-400 mb-4">Detailed completion progress of students in your department.</p>

            {reportLoading ? (
              <div className="text-center py-12 text-zinc-400">Generating report...</div>
            ) : (
              <div className="space-y-4">
                {/* Stats Summary */}
                {(() => {
                  const total = reportData.length
                  const assigned = reportData.filter(s => s.assignment_status !== 'not_assigned').length
                  const completed = reportData.filter(s => s.assignment_status === 'approved').length
                  const notCompleted = assigned - completed
                  const assignPct = total > 0 ? Math.round((assigned / total) * 100) : 0
                  const completePct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
                  const notCompletePct = assigned > 0 ? Math.round((notCompleted / assigned) * 100) : 0

                  return (
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <span className="block text-[10px] uppercase font-bold text-zinc-400">Total Department</span>
                        <span className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{total} Students</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <span className="block text-[10px] uppercase font-bold text-zinc-400">Assigned Rate</span>
                        <span className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{assigned} ({assignPct}%)</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <span className="block text-[10px] uppercase font-bold text-zinc-400">Completion Rate</span>
                        <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{completed} ({completePct}%)</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <span className="block text-[10px] uppercase font-bold text-zinc-400">Incomplete Rate</span>
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{notCompleted} ({notCompletePct}%)</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Students Table */}
                <div className="max-h-[300px] overflow-auto border border-zinc-100 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 uppercase font-semibold">
                        <th className="p-2.5">Student</th>
                        <th className="p-2.5">Reg ID</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Submitted At</th>
                        <th className="p-2.5 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {reportData.map((item) => (
                        <tr key={item.student_uuid} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="p-2.5 font-medium text-zinc-800 dark:text-zinc-200">{item.student_name}</td>
                          <td className="p-2.5 text-zinc-500">{item.student_id}</td>
                          <td className="p-2.5">
                            {(() => {
                              switch (item.assignment_status) {
                                case 'not_assigned':
                                  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-100 text-zinc-500">Unassigned</span>
                                case 'pending':
                                  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-600">Assigned</span>
                                case 'submitted':
                                  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600">Submitted</span>
                                case 'approved':
                                  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600">Completed</span>
                                default:
                                  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">Rejected</span>
                              }
                            })()}
                          </td>
                          <td className="p-2.5 text-zinc-400">
                            {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-zinc-700 dark:text-zinc-200">
                            {item.marks !== null ? `${item.marks} pts` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                onClick={() => downloadReportCSV(reportTask.title, reportData)} 
                variant="outline" 
                className="gap-2"
                disabled={reportData.length === 0}
              >
                Export CSV
              </Button>
              <Button onClick={() => setReportTask(null)} className="bg-violet-600 text-white">Close Report</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
