"use client"

import Link from "next/link"
import { addDays } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  currentMondayIso,
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
  const current = currentMondayIso() === weekStart

  return (
    <div className="flex items-center gap-2">
      <Link
        href={hrefFor(prev)}
        className="tap-press inline-flex size-12 shrink-0 items-center justify-center rounded-[0.75rem] hover:bg-muted"
        aria-label="Semaine précédente"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className={cn(
            "font-fraunces leading-tight",
            compact ? "truncate text-base" : "text-lg"
          )}
        >
          {compact ? weekLabelShort(monday) : weekLabel(monday)}
        </p>
        {current && !compact ? (
          <Badge variant="outline" className="mt-1 w-fit border-mark text-mark">
            Cette semaine
          </Badge>
        ) : null}
      </div>
      <Link
        href={hrefFor(next)}
        className="tap-press inline-flex size-12 shrink-0 items-center justify-center rounded-[0.75rem] hover:bg-muted"
        aria-label="Semaine suivante"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  )
}
