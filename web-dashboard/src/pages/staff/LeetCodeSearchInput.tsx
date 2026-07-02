import { useState, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

// Simple debounce hook implementation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

type LeetCodeProblem = {
  questionFrontendId: string
  title: string
  titleSlug: string
  difficulty: string
}

type PiedProblem = {
  frontend_id: string
  title: string
  title_slug: string
  difficulty: string
}

let cachedProblems: LeetCodeProblem[] | null = null
let fetchPromise: Promise<LeetCodeProblem[]> | null = null

async function getProblemsList(): Promise<LeetCodeProblem[]> {
  if (cachedProblems) return cachedProblems
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch("https://leetcode-api-pied.vercel.app/problems")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch problems list")
      return res.json()
    })
    .then((data: PiedProblem[]) => {
      const mapped = data.map((p) => ({
        questionFrontendId: p.frontend_id,
        title: p.title,
        titleSlug: p.title_slug,
        difficulty: p.difficulty,
      }))
      cachedProblems = mapped
      return mapped
    })

  return fetchPromise
}

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export function LeetCodeSearchInput({ value, onChange, placeholder, required }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [problems, setProblems] = useState<LeetCodeProblem[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 200)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setQuery(value || "")
  }, [value])

  useEffect(() => {
    async function searchProblems() {
      if (!debouncedQuery || debouncedQuery.trim().length < 1 || debouncedQuery.includes("leetcode.com")) {
        setProblems([])
        return
      }
      
      setLoading(true)
      try {
        const all = await getProblemsList()
        const term = debouncedQuery.toLowerCase().trim()
        const filtered = all
          .filter((p) => 
            p.title.toLowerCase().includes(term) || 
            p.questionFrontendId === term || 
            p.titleSlug.includes(term)
          )
          .slice(0, 15)
        setProblems(filtered)
      } catch (err) {
        console.error("Error searching LeetCode problems:", err)
      } finally {
        setLoading(false)
      }
    }

    void searchProblems()
  }, [debouncedQuery])

  const difficultyColor = (diff: string) => {
    if (diff === "Easy") return "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
    if (diff === "Medium") return "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
    if (diff === "Hard") return "text-red-500 bg-red-50 dark:bg-red-500/10"
    return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input 
        value={value} 
        onChange={(e) => {
          onChange(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
        }}
        placeholder={placeholder}
        required={required}
      />
      
      {open && query.trim().length >= 1 && !query.includes("leetcode.com") && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-800 dark:bg-zinc-950 text-sm">
          {loading ? (
            <div className="flex items-center justify-center p-4 text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching LeetCode...
            </div>
          ) : problems.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">No problems found for "{query}".</div>
          ) : (
            problems.map((p) => (
              <div
                key={p.questionFrontendId}
                className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => {
                  onChange(`https://leetcode.com/problems/${p.titleSlug}/`)
                  setOpen(false)
                }}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {p.questionFrontendId}. {p.title}
                  </span>
                  <span className="text-xs text-zinc-400 truncate max-w-[200px] sm:max-w-[300px]">/{p.titleSlug}/</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${difficultyColor(p.difficulty)}`}>
                  {p.difficulty}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
