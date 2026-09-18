import { addDays } from "date-fns"
import { redirect } from "next/navigation"
import { WeekBoard } from "@/components/week-board"
import { listMeals } from "@/lib/actions/meals"
import { getWeekSlots } from "@/lib/actions/slots"
import {
  currentMondayIso,
  isMonday,
  mondayOf,
  parseISODate,
  toISODate,
} from "@/lib/dates"

export const dynamic = "force-dynamic"

export default async function SemainePage({
  params,
}: {
  params: Promise<{ weekStart: string }>
}) {
  const { weekStart } = await params
  const parsed = parseISODate(weekStart)
  if (!parsed) {
    redirect(`/semaine/${currentMondayIso()}`)
  }
  if (!isMonday(parsed)) {
    redirect(`/semaine/${toISODate(mondayOf(parsed))}`)
  }

  const nextStart = toISODate(addDays(parsed, 7))
  const [slots, nextSlots, meals] = await Promise.all([
    getWeekSlots(weekStart),
    getWeekSlots(nextStart),
    listMeals(),
  ])

  return (
    <WeekBoard
      key={weekStart}
      weekStart={weekStart}
      weeks={[
        { start: weekStart, slots },
        { start: nextStart, slots: nextSlots },
      ]}
      meals={meals}
    />
  )
}
