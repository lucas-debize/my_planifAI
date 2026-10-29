"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { MealForm } from "@/components/meal-form"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
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
            className="tap-press min-h-10 rounded-xl px-3 text-xs font-semibold sm:min-h-11 sm:text-sm shadow-2xs gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-4" />
            <span>Supprimer</span>
          </Button>
        }
      />
      <div className="px-4 pb-8 md:max-w-lg md:px-8">
        <MealForm
          meal={meal}
          knownIngredients={knownIngredients}
          submitLabel="Modifier le plat"
          onCancel={() => router.push("/idees")}
          onSaved={() => {
            router.refresh()
            router.push("/idees")
          }}
        />
        <div className="mt-8 pt-6 border-t border-line/60 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-medium">Zone de danger</p>
          <Button
            type="button"
            variant="outline"
            className="tap-press w-full min-h-11 border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-semibold rounded-xl gap-2"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-4" />
            <span>Supprimer ce plat définitivement</span>
          </Button>
        </div>
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
