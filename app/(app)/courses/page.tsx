import { ShoppingBoard } from "@/components/shopping-board"
import { listWeekIngredients } from "@/lib/actions/shopping"
import {
  currentMondayIso,
  isMonday,
  mondayOf,
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
  const parsed = semaine ? parseISODate(semaine) : new Date()
  const weekStart = parsed
    ? toISODate(isMonday(parsed) ? parsed : mondayOf(parsed))
    : currentMondayIso()
  const lines = await listWeekIngredients(weekStart)
  return <ShoppingBoard key={weekStart} weekStart={weekStart} initialLines={lines} />
}
