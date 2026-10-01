"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { MealForm } from "@/components/meal-form"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteMeal } from "@/lib/actions/meals"
import { actionErrorMessage } from "@/lib/errors"
import type { MealWithIngredients } from "@/lib/domain/meals"

export function EditMealPage({
  meal,
  knownIngredients,
}: {
  meal: MealWithIngredients
  knownIngredients: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <PageHeader
        title={meal.name}
        backHref="/idees"
        backLabel="Retour aux idées"
        actions={
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-10 text-xs sm:min-h-12 sm:text-sm"
            onClick={() => setOpen(true)}
          >
            Supprimer
          </Button>
        }
      />
      <div className="px-4 pb-8 md:max-w-lg md:px-8">
        <MealForm
          meal={meal}
          knownIngredients={knownIngredients}
          submitLabel="Modifier le plat"
          onCancel={() => router.push("/idees")}
          onSaved={() => router.push("/idees")}
        />
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {meal.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les créneaux qui l’utilisent deviendront vides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              variant="destructive"
              disabled={pending}
              onClick={async (event) => {
                event.preventDefault()
                setPending(true)
                try {
                  await deleteMeal(meal.id)
                  router.push("/idees")
                } catch (error) {
                  toast.error(actionErrorMessage(error))
                  setPending(false)
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
