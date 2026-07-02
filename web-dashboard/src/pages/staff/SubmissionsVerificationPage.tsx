import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, X, ExternalLink } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Submission = {
  submission_id: string
  student_name: string
  task_title: string
  proof_url: string
  submitted_at: string
  status: string
  remarks: string | null
  difficulty: string
  points: number
}

const getStoredStaff = () => {
  const stored = localStorage.getItem('staff')
  return stored ? JSON.parse(stored) : null
}

export default function SubmissionsVerificationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Verification action modal/form state
  const [activeSubmission, setActiveSubmission] = useState<{ id: string; title: string; defaultPoints: number; mode: 'approve' | 'reject' } | null>(null)
  const [remarks, setRemarks] = useState("")
  const [marks, setMarks] = useState("")
  const [verifying, setVerifying] = useState(false)

  const fetchSubmissions = async () => {
    const staff = getStoredStaff()
    if (!staff) return

    const { data, error } = await supabase.rpc('get_staff_recent_submissions', {
      p_staff_id: staff.id,
      p_password: staff.password
    })

    if (error) setError(error.message)
    else setSubmissions(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void fetchSubmissions()
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSubmission) return
    setVerifying(true)

    const staff = getStoredStaff()
    if (!staff) return

    const finalMarks = activeSubmission.mode === 'approve' ? (marks ? Number(marks) : activeSubmission.defaultPoints) : 0
    const finalStatus = activeSubmission.mode === 'approve' ? 'approved' : 'rejected'

    const { error } = await supabase.rpc('verify_task_submission', {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_submission_id: activeSubmission.id,
      p_status: finalStatus,
      p_remarks: remarks.trim(),
      p_marks: finalMarks
    })

    if (error) {
      alert(`Error verifying: ${error.message}`)
    } else {
      setActiveSubmission(null)
      setRemarks("")
      setMarks("")
      await fetchSubmissions()
      alert("Submission verified successfully!")
    }
    setVerifying(false)
  }

  if (loading) return <div className="text-center p-12 text-sm text-zinc-500">Loading submissions...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  const pendingList = submissions.filter(sub => sub.status === 'pending')
  const completedList = submissions.filter(sub => sub.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submissions Verification</h1>
          <p className="text-sm text-zinc-500 mt-1">Review and verify coding task submissions from your assigned students.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Submissions */}
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              Pending Action <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">{pendingList.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingList.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-12">No pending submissions to verify.</p>
            ) : (
              <div className="space-y-4">
                {pendingList.map((sub) => (
                  <div key={sub.submission_id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{sub.task_title}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Submitted by <span className="font-semibold">{sub.student_name}</span></p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {sub.points} pts
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p><span className="font-semibold text-zinc-400">Proof:</span> <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 inline-flex items-center gap-1 hover:underline">{sub.proof_url} <ExternalLink size={10} /></a></p>
                      {sub.remarks && <p><span className="font-semibold text-zinc-400">Remarks:</span> "{sub.remarks}"</p>}
                      <p className="text-[10px] text-zinc-400">Submitted: {new Date(sub.submitted_at).toLocaleString()}</p>
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button 
                        onClick={() => {
                          setRemarks("")
                          setMarks(String(sub.points))
                          setActiveSubmission({ id: sub.submission_id, title: sub.task_title, defaultPoints: sub.points, mode: 'approve' })
                        }}
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                      >
                        <Check size={14} /> Approve
                      </Button>
                      <Button 
                        onClick={() => {
                          setRemarks("")
                          setMarks("0")
                          setActiveSubmission({ id: sub.submission_id, title: sub.task_title, defaultPoints: sub.points, mode: 'reject' })
                        }}
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:bg-red-50 gap-1 text-xs border-red-200"
                      >
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Verification History</CardTitle>
          </CardHeader>
          <CardContent>
            {completedList.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-12">No recently verified submissions.</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-auto">
                {completedList.map((sub) => (
                  <div key={sub.submission_id} className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="overflow-hidden pr-2">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{sub.task_title}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Student: {sub.student_name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Remarks: {sub.remarks || "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] ${
                        sub.status === 'approved' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {sub.status.toUpperCase()}
                      </span>
                      {sub.status === 'approved' && (
                        <p className="font-bold text-violet-600 mt-1">+{sub.points} pts</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verification modal */}
      {activeSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-base mb-3 text-zinc-800 dark:text-zinc-100">
              {activeSubmission.mode === 'approve' ? 'Approve' : 'Reject'} Submission
            </h3>
            <p className="text-xs text-zinc-500 mb-4">Task: <span className="font-semibold">{activeSubmission.title}</span></p>
            <form onSubmit={handleVerify} className="space-y-4">
              {activeSubmission.mode === 'approve' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Points Awarded</label>
                  <Input 
                    required
                    type="number"
                    min={0}
                    max={activeSubmission.defaultPoints}
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-400">Max points allowed: {activeSubmission.defaultPoints}</p>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">Feedback / Remarks</label>
                <Input 
                  placeholder={activeSubmission.mode === 'approve' ? "Optional approval feedback..." : "Enter reason for rejection..."}
                  required={activeSubmission.mode === 'reject'}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setActiveSubmission(null)}>Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={verifying}
                  className={activeSubmission.mode === 'approve' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}
                >
                  {verifying ? "Saving..." : activeSubmission.mode === 'approve' ? "Approve Submission" : "Reject Submission"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
