import { useMemo, useRef, useState, useEffect } from "react"
import { CalendarDays, RefreshCw } from "lucide-react"
import type { DailyActivity } from "./types"

type Props = {
  title: string
  platform: "github" | "leetcode"
  activity: DailyActivity[]
  lastSyncedAt: string | null
}

const DAY_MS = 86_400_000

const dateKey = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]

export default function ActivityHeatmap({ title, platform, activity, lastSyncedAt }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { weeks, total, activeDays, currentStreak, longestStreak, max, monthLabels } = useMemo(() => {
    const values = new Map(
      activity
        .filter((item) => item.platform === platform)
        .map((item) => [item.activity_date, item.activity_count]),
    )

    const today = new Date()
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const start = new Date(utcToday.getTime() - 364 * DAY_MS)
    // align start to Sunday
    const paddedStart = new Date(start.getTime() - start.getUTCDay() * DAY_MS)

    const days: { date: string; count: number; inRange: boolean }[] = []
    for (let cursor = paddedStart.getTime(); cursor <= utcToday.getTime(); cursor += DAY_MS) {
      const date = new Date(cursor)
      const key = dateKey(date)
      days.push({ date: key, count: values.get(key) ?? 0, inRange: cursor >= start.getTime() })
    }

    // Group into weeks (columns of 7)
    const grouped: (typeof days)[] = []
    for (let i = 0; i < days.length; i += 7) grouped.push(days.slice(i, i + 7))

    // Build month labels: for each week, check if the first in-range day of that week starts a new month
    const monthLabels: { weekIndex: number; label: string }[] = []
    let lastMonth = -1
    grouped.forEach((week, wi) => {
      const firstInRange = week.find((d) => d.inRange)
      if (!firstInRange) return
      const m = parseInt(firstInRange.date.split("-")[1]) - 1
      if (m !== lastMonth) {
        monthLabels.push({ weekIndex: wi, label: MONTH_NAMES[m] })
        lastMonth = m
      }
    })

    // Streak calculations
    let running = 0
    let longest = 0
    for (let cursor = start.getTime(); cursor <= utcToday.getTime(); cursor += DAY_MS) {
      if ((values.get(dateKey(new Date(cursor))) ?? 0) > 0) {
        running++
        longest = Math.max(longest, running)
      } else {
        running = 0
      }
    }

    let current = 0
    for (let cursor = utcToday.getTime(); cursor >= start.getTime(); cursor -= DAY_MS) {
      if ((values.get(dateKey(new Date(cursor))) ?? 0) === 0) break
      current++
    }

    const counts = days.filter((d) => d.inRange).map((d) => d.count)
    return {
      weeks: grouped,
      total: counts.reduce((s, c) => s + c, 0),
      activeDays: counts.filter(Boolean).length,
      currentStreak: current,
      longestStreak: longest,
      max: Math.max(...counts, 1),
      monthLabels,
    }
  }, [activity, platform])

  // Scroll to the end on mount or when data changes so the latest activity is always visible
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth
    }
  }, [weeks])

  const level = (count: number) => {
    if (!count) return 0
    const r = count / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }

  const isGitHub = platform === "github"

  // Tailwind color levels
  const cellColors = isGitHub
    ? ["bg-zinc-100 dark:bg-zinc-800", "bg-emerald-200 dark:bg-emerald-900", "bg-emerald-400 dark:bg-emerald-700", "bg-emerald-500 dark:bg-emerald-500", "bg-emerald-700 dark:bg-emerald-300"]
    : ["bg-zinc-100 dark:bg-zinc-800", "bg-violet-200 dark:bg-violet-900", "bg-violet-400 dark:bg-violet-700", "bg-violet-500 dark:bg-violet-500", "bg-violet-700 dark:bg-violet-300"]

  const accentText = isGitHub ? "text-emerald-600 dark:text-emerald-400" : "text-violet-600 dark:text-violet-400"
  const badgeBg = isGitHub
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"

  const formatTooltipDate = (value: string) =>
    new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${value}T00:00:00Z`),
    )

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, day: { date: string; count: number; inRange: boolean }) => {
    if (!day.inRange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const label = day.count === 0 ? "No activity" : `${day.count} ${day.count === 1 ? "contribution" : "contributions"}`
    setTooltip({
      text: `${formatTooltipDate(day.date)}: ${label}`,
      // Subtract scrollLeft to correctly position relative to the scrollable container's visible area
      x: rect.left - containerRect.left + containerRef.current!.scrollLeft + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    })
  }

  const CELL = 11  // cell size px
  const GAP = 2    // gap px
  const STEP = CELL + GAP
  const LABEL_WIDTH = 32 // fixed width for day labels

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 px-5 pt-5 pb-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-sm">
            <CalendarDays className={`h-4 w-4 ${accentText}`} />
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            <span className={`font-semibold ${accentText}`}>{total}</span> activities across{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{activeDays}</span> active days
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          {lastSyncedAt ? (
            <>
              <RefreshCw className="h-3 w-3" />
              <span>Synced {new Date(lastSyncedAt).toLocaleString()}</span>
            </>
          ) : (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
              Waiting for first sync
            </span>
          )}
        </div>
      </div>

      {/* Heatmap grid scrollable area */}
      <div 
        className="px-5 pb-2 overflow-x-auto relative" 
        ref={containerRef} 
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="inline-block min-w-max relative pb-6">
          {/* Month labels row */}
          <div className="flex mb-1" style={{ paddingLeft: LABEL_WIDTH }}>
            {(() => {
              const labels: React.ReactNode[] = []
              let lastEnd = 0
              monthLabels.forEach(({ weekIndex, label }, idx) => {
                const nextIdx = monthLabels[idx + 1]?.weekIndex ?? weeks.length
                const spanWeeks = nextIdx - weekIndex
                const gap = weekIndex - lastEnd
                if (gap > 0) labels.push(<div key={`gap-${idx}`} style={{ width: gap * STEP }} />)
                labels.push(
                  <div
                    key={label + idx}
                    className="text-[10px] text-zinc-400 select-none shrink-0"
                    style={{ width: spanWeeks * STEP }}
                  >
                    {label}
                  </div>,
                )
                lastEnd = nextIdx
              })
              return labels
            })()}
          </div>

          {/* Main grid with sticky day-of-week labels */}
          <div className="flex gap-0 relative">
            {/* Day labels column - Sticky */}
            <div 
              className="sticky left-0 z-10 flex flex-col justify-between pr-2 bg-white dark:bg-zinc-900" 
              style={{ width: LABEL_WIDTH, height: 7 * STEP - GAP }}
            >
              {DAY_LABELS.map((label, i) => (
                <span key={i} className="text-[9px] text-zinc-400 leading-none select-none" style={{ height: CELL, lineHeight: `${CELL}px` }}>
                  {label}
                </span>
              ))}
              {/* Fade out effect to the right of the sticky labels to blend cleanly with scrolling grid */}
              <div className="absolute right-0 top-0 w-2 h-full bg-gradient-to-r from-white to-transparent dark:from-zinc-900 translate-x-full pointer-events-none" />
            </div>

            {/* Weeks */}
            <div
              className="flex relative"
              style={{ gap: GAP }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Tooltip */}
              {tooltip && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[10px] text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 whitespace-nowrap"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  {tooltip.text}
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
                </div>
              )}

              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((day) => (
                    <div
                      key={day.date}
                      style={{ width: CELL, height: CELL, borderRadius: 2, flexShrink: 0 }}
                      className={
                        day.inRange
                          ? `${cellColors[level(day.count)]} cursor-pointer transition-opacity hover:opacity-75`
                          : "bg-transparent"
                      }
                      onMouseEnter={(e) => handleMouseEnter(e, day)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 text-xs dark:border-zinc-800">
        <div className="flex gap-4 text-zinc-500">
          <span>
            <strong className={accentText}>{currentStreak}</strong>
            <span className="ml-1">current streak</span>
          </span>
          <span>
            <strong className={accentText}>{longestStreak}</strong>
            <span className="ml-1">longest streak</span>
          </span>
          {total > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeBg}`}>
              {activeDays} active days
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span>Less</span>
          {cellColors.map((color, i) => (
            <span key={i} className={`rounded-[2px] ${color}`} style={{ width: CELL, height: CELL, flexShrink: 0 }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
