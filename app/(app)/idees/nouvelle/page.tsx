import { listMeals } from "@/lib/actions/meals"
import { NewMealPage } from "@/components/new-meal-page"
import { knownFromMeals } from "@/lib/domain/meals"

export const dynamic = "force-dynamic"

export default async function NouvelleIdeePage() {
  const meals = await listMeals()
  return <NewMealPage knownIngredients={knownFromMeals(meals)} />
}
