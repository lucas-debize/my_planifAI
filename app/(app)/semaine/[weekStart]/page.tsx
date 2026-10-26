import { addDays } from "date-fns"
import { redirect } from "next/navigation"
import { WeekBoard } from "@/components/week-board"
import { listMeals, listPersonalMeals, listFamilyMeals } from "@/lib/actions/meals"
import { getWeekSlots } from "@/lib/actions/slots"
import { getPlanningScope } from "@/lib/actions/session"
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
  const scope = await getPlanningScope()
  const isFamily = scope.type === "family"

  const [slots, nextSlots, meals, otherMeals] = await Promise.all([
    getWeekSlots(weekStart),
    getWeekSlots(nextStart),
    listMeals(),
    isFamily ? listPersonalMeals() : listFamilyMeals(),
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
      personalMeals={isFamily ? otherMeals : []}
      familyMeals={isFamily ? [] : otherMeals}
      isFamilyMode={isFamily}
    />
  )
}
