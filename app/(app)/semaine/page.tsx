import { redirect } from "next/navigation"
import { currentWeekStartIso } from "@/lib/dates"
import { getWeekStartDay } from "@/lib/actions/session"

export default async function SemaineIndexPage() {
  const startDay = await getWeekStartDay()
  redirect(`/semaine/${currentWeekStartIso(new Date(), startDay)}`)
}
