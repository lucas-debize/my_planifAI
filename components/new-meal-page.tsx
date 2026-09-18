"use client"

import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { MealForm } from "@/components/meal-form"

export function NewMealPage({
  knownIngredients,
}: {
  knownIngredients: { id: string; name: string }[]
}) {
  const router = useRouter()
  return (
    <>
      <PageHeader title="Nouvelle idée" />
      <div className="px-4 pb-8 md:max-w-lg md:px-8">
        <MealForm
          knownIngredients={knownIngredients}
          submitLabel="Enregistrer"
          onCancel={() => router.push("/idees")}
          onSaved={() => router.push("/idees")}
        />
      </div>
    </>
  )
}
