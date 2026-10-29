import { ShoppingBoard } from "@/components/shopping-board"
import { listWeekIngredients } from "@/lib/actions/shopping"
import { getWeekStartDay } from "@/lib/actions/session"
import {
  currentWeekStartIso,
  parseISODate,
  toISODate,
} from "@/lib/dates"

export const dynamic = "force-dynamic"

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>
}) {
  const { semaine } = await searchParams
  const startDay = await getWeekStartDay()
  const parsed = semaine ? parseISODate(semaine) : null
  const weekStart = parsed
    ? toISODate(parsed)
    : currentWeekStartIso(new Date(), startDay)
  const lines = await listWeekIngredients(weekStart)
  return <ShoppingBoard key={weekStart} weekStart={weekStart} initialLines={lines} />
}
