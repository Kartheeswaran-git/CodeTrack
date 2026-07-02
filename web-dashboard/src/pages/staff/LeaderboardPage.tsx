import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Trophy, Award } from "lucide-react"
import { supabase } from "@/lib/supabase"

type LeaderboardRow = {
  rank_num: number
  name: string
  email: string
  student_id: string
  department_name: string
  points: number
}

const getStoredStaff = () => {
  const stored = localStorage.getItem('staff')
  return stored ? JSON.parse(stored) : null
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const staff = getStoredStaff()
      if (!staff) return

      const { data, error } = await supabase.rpc("get_leaderboard", {
        p_staff_id: staff.id,
        p_password: staff.password
      })

      if (error) setError(error.message)
      else setLeaderboard(data ?? [])
      setLoading(false)
    }

    void fetchLeaderboard()
  }, [])

  if (loading) return <div className="text-center p-12 text-sm text-zinc-500">Loading leaderboard rankings...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-1.5 rounded-full inline-block"><Trophy className="h-5 w-5" /></span>
      case 2: return <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 p-1.5 rounded-full inline-block"><Award className="h-5 w-5" /></span>
      case 3: return <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 p-1.5 rounded-full inline-block"><Award className="h-5 w-5" /></span>
      default: return <span className="w-8 text-center text-sm font-bold text-zinc-400">{rank}</span>
    }
  }

  const top3 = leaderboard.slice(0, 3)
  const remaining = leaderboard.slice(3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Leaderboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Global student points ranking based on approved coding assignments.</p>
      </div>

      {leaderboard.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500 border-zinc-200 dark:border-zinc-800">
          No students are currently ranked. Verify submissions to award points!
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Top 3 podium */}
          <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto pt-4">
            {top3.map((student, idx) => (
              <Card key={student.student_id} className={`shadow-sm text-center p-5 flex flex-col items-center justify-between border-zinc-200 dark:border-zinc-800 ${
                idx === 0 
                  ? 'ring-2 ring-amber-400 scale-105 order-first sm:order-none' 
                  : idx === 1 
                  ? 'scale-95' 
                  : 'scale-95'
              }`}>
                <div className="mb-2">
                  {getRankBadge(student.rank_num)}
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{student.name}</p>
                  <p className="text-[10px] text-zinc-400">ID: {student.student_id}</p>
                  <p className="text-[10px] text-zinc-500 font-semibold">{student.department_name}</p>
                </div>
                <div className="mt-4 bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 rounded-lg border border-violet-100 dark:border-violet-900/30">
                  <span className="text-base font-extrabold text-violet-600 dark:text-violet-400">{student.points} pts</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Remaining List */}
          {remaining.length > 0 && (
            <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 border-b dark:bg-zinc-950">
                    <tr>
                      <th className="px-5 py-3 w-20">Rank</th>
                      <th className="px-5 py-3">Student Name</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3 text-right">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {remaining.map((student) => (
                      <tr key={student.student_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="px-5 py-4 font-semibold text-zinc-500">
                          {student.rank_num}
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">{student.name}</p>
                            <p className="text-[10px] text-zinc-400">ID: {student.student_id} · {student.email}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-zinc-500 font-semibold">
                          {student.department_name}
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold text-violet-600 dark:text-violet-400">
                          {student.points} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
