import { notFound } from "next/navigation"
import { getMeal, listMeals } from "@/lib/actions/meals"
import { EditMealPage } from "@/components/edit-meal-page"
import { knownFromMeals } from "@/lib/domain/meals"

export const dynamic = "force-dynamic"

export default async function IdeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [meal, meals] = await Promise.all([getMeal(id), listMeals()])
  if (!meal) notFound()
  return <EditMealPage meal={meal} knownIngredients={knownFromMeals(meals)} />
}
