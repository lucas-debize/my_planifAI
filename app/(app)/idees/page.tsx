import { IdeasBoard } from "@/components/ideas-board"
import { listMeals, listPersonalMeals, listFamilyMeals } from "@/lib/actions/meals"
import { getPlanningScope } from "@/lib/actions/session"

export const dynamic = "force-dynamic"

export default async function IdeesPage() {
  const [meals, scope] = await Promise.all([
    listMeals(),
    getPlanningScope(),
  ])

  const personalMeals =
    scope.type === "family" ? await listPersonalMeals() : []
  const familyMeals =
    scope.type === "personal" ? await listFamilyMeals() : []
  return (
    <IdeasBoard
      meals={meals}
      personalMeals={personalMeals}
      familyMeals={familyMeals}
      isFamilyMode={scope.type === "family"}
      scopeDisplayName={scope.displayName}
    />
  )
}
