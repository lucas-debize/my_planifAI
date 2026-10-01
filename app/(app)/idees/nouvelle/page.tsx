import { listMeals } from "@/lib/actions/meals"
import { NewMealPage } from "@/components/new-meal-page"
import { knownFromMeals } from "@/lib/domain/meals"

export const dynamic = "force-dynamic"

export default async function NouvelleIdeePage(props: {
  searchParams: Promise<{ nom?: string; date?: string; kind?: string }>
}) {
  const { nom, date, kind } = await props.searchParams
  const meals = await listMeals()
  return (
    <NewMealPage
      initialName={nom}
      date={date}
      kind={kind}
      knownIngredients={knownFromMeals(meals)}
    />
  )
}
