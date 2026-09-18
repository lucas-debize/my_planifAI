import { IdeasBoard } from "@/components/ideas-board"
import { listMeals } from "@/lib/actions/meals"

export const dynamic = "force-dynamic"

export default async function IdeesPage() {
  const meals = await listMeals()
  return <IdeasBoard meals={meals} />
}
