import { redirect } from "next/navigation"
import { currentMondayIso } from "@/lib/dates"

export default function SemaineIndexPage() {
  redirect(`/semaine/${currentMondayIso()}`)
}
