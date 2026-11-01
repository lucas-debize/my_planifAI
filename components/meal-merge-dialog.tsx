"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowRight, Copy, RefreshCw, X } from "lucide-react"
import type { MealWithIngredients } from "@/lib/domain/meals"

export type MealMergeOption = "update_existing" | "keep_both" | "keep_existing"

export type MealMergeCandidate = {
  name: string
  ingredientNames: { name: string; quantity?: string | null }[]
}

export function MealMergeDialog({
  open,
  onOpenChange,
  existingMeal,
  incomingMeal,
  onResolve,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingMeal: MealWithIngredients | null
  incomingMeal: MealMergeCandidate | null
  onResolve: (action: MealMergeOption) => void
}) {
  if (!existingMeal || !incomingMeal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-5 shrink-0" />
            <DialogTitle className="font-fraunces text-lg sm:text-xl text-ink">
              Plat similaire déjà présent
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Un plat avec un titre proche existe déjà dans vos idées. Choisissez comment vous souhaitez gérer cette recette.
          </DialogDescription>
        </DialogHeader>

        {/* Comparatif côte à côte / empilé */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {/* Version actuelle */}
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-muted/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Version actuelle (dans vos idées)
            </span>
            <p className="font-fraunces text-base font-bold text-ink">
              {existingMeal.name}
            </p>
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Ingrédients ({existingMeal.ingredients.length}) :
              </span>
              {existingMeal.ingredients.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Aucun ingrédient renseigné
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {existingMeal.ingredients.map((ing) => (
                    <li
                      key={ing.id}
                      className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink border border-line/60"
                    >
                      {ing.quantity ? `${ing.quantity} ` : ""}
                      {ing.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Nouvelle version */}
          <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Nouvelle version
            </span>
            <p className="font-fraunces text-base font-bold text-ink">
              {incomingMeal.name}
            </p>
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Ingrédients ({incomingMeal.ingredientNames.length}) :
              </span>
              {incomingMeal.ingredientNames.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Aucun ingrédient renseigné
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {incomingMeal.ingredientNames.map((ing, idx) => (
                    <li
                      key={idx}
                      className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink border border-primary/20"
                    >
                      {ing.quantity ? `${ing.quantity} ` : ""}
                      {ing.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Actions de résolution */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="tap-press min-h-10 justify-between rounded-xl font-semibold text-xs"
            onClick={() => onResolve("update_existing")}
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="size-3.5" />
              <span>Mettre à jour l&apos;existant avec ces ingrédients</span>
            </span>
            <ArrowRight className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="tap-press min-h-10 justify-between rounded-xl font-semibold text-xs border-line bg-surface hover:bg-muted"
            onClick={() => onResolve("keep_both")}
          >
            <span className="flex items-center gap-1.5">
              <Copy className="size-3.5" />
              <span>Garder les deux (créer un nouveau plat)</span>
            </span>
            <ArrowRight className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="tap-press min-h-9 justify-center rounded-xl text-xs text-muted-foreground hover:text-ink"
            onClick={() => onResolve("keep_existing")}
          >
            <X className="size-3.5 mr-1" />
            <span>Conserver l&apos;actuel (ignorer le nouveau plat)</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
