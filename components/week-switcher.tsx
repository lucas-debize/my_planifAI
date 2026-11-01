"use client"

import type { WeekStartDay } from "@/lib/domain/session"

import Link from "next/link"
import { addDays } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  currentWeekStartIso,
  parseISODate,
  toISODate,
  weekLabel,
  weekLabelShort,
} from "@/lib/dates"
import { cn } from "@/lib/utils"

export function WeekSwitcher({
  weekStart,
  hrefFor,
  compact = false,
}: {
  weekStart: string
  hrefFor: (iso: string) => string
  compact?: boolean
}) {
  const monday = parseISODate(weekStart)
  if (!monday) return null
  const prev = toISODate(addDays(monday, -7))
  const next = toISODate(addDays(monday, 7))
  const startDay = monday.getDay() as WeekStartDay
  const todayIso = currentWeekStartIso(new Date(), startDay)
  const current = todayIso === weekStart

  return (
    <div className={cn("flex items-center justify-between gap-2", compact ? "py-1" : "py-2")}>
      <Link
        href={hrefFor(prev)}
        prefetch={true}
        className="tap-press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-surface text-ink hover:bg-muted shadow-2xs transition-colors"
        aria-label="Semaine précédente"
      >
        <ChevronLeft className="size-4.5" />
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
        <p
          className={cn(
            "font-fraunces font-bold tracking-tight text-ink",
            compact ? "truncate text-xs sm:text-sm font-semibold" : "text-sm sm:text-base font-bold"
          )}
        >
          {compact ? weekLabelShort(monday) : weekLabel(monday)}
        </p>
        {current ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            En cours
          </span>
        ) : (
          <Link
            href={hrefFor(todayIso)}
            prefetch={true}
            className="tap-press shrink-0 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/15 transition-colors"
          >
            Aujourd&apos;hui
          </Link>
        )}
      </div>

      <Link
        href={hrefFor(next)}
        prefetch={true}
        className="tap-press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-surface text-ink hover:bg-muted shadow-2xs transition-colors"
        aria-label="Semaine suivante"
      >
        <ChevronRight className="size-4.5" />
      </Link>
    </div>
  )
}
