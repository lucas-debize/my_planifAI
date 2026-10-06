import { IdeasBoard } from "@/components/ideas-board"
import { listMeals, listPersonalMeals } from "@/lib/actions/meals"
import { getPlanningScope } from "@/lib/actions/session"

export const dynamic = "force-dynamic"

export default async function IdeesPage() {
  const [meals, scope] = await Promise.all([
    listMeals(),
    getPlanningScope(),
  ])

  const personalMeals =
    scope.type === "family" ? await listPersonalMeals() : []

  return (
    <IdeasBoard
      meals={meals}
      personalMeals={personalMeals}
      isFamilyMode={scope.type === "family"}
      scopeDisplayName={scope.displayName}
    />
  )
}
