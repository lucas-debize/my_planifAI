import { IdeasBoard } from "@/components/ideas-board"
import { listMeals, listPersonalMeals, listFamilyMeals } from "@/lib/actions/meals"
import { getPlanningScope } from "@/lib/actions/session"

export const dynamic = "force-dynamic"

export default async function IdeesPage() {
  const scope = await getPlanningScope()
  const isFamily = scope.type === "family"

  const [meals, otherMeals] = await Promise.all([
    listMeals(),
    isFamily ? listPersonalMeals() : listFamilyMeals(),
  ])

  return (
    <IdeasBoard
      meals={meals}
      personalMeals={isFamily ? otherMeals : []}
      familyMeals={isFamily ? [] : otherMeals}
      isFamilyMode={isFamily}
      scopeDisplayName={scope.displayName}
    />
  )
}
