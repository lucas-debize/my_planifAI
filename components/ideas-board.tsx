"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Download, Users } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ingredientCountLabel } from "@/components/meal-picker"
import { importPersonalMealsAction, importFamilyMealsAction } from "@/lib/actions/meals"
import { actionErrorMessage } from "@/lib/errors"
import type { MealWithIngredients } from "@/lib/domain/meals"

export function IdeasBoard({
  meals,
  personalMeals = [],
  familyMeals = [],
  isFamilyMode = false,
  scopeDisplayName,
}: {
  meals: MealWithIngredients[]
  personalMeals?: MealWithIngredients[]
  familyMeals?: MealWithIngredients[]
  isFamilyMode?: boolean
  scopeDisplayName?: string
}) {
  const [query, setQuery] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set())
  const [isImporting, startImportTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...meals].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    if (!q) return list
    return list.filter((meal) => {
      if (meal.name.toLowerCase().includes(q)) return true
      return meal.ingredients.some((ingredient) =>
        ingredient.name.toLowerCase().includes(q)
      )
    })
  }, [meals, query])

  const importableMeals = isFamilyMode ? personalMeals : familyMeals

  function toggleMeal(id: string) {
    setSelectedMealIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedMealIds.size === importableMeals.length) {
      setSelectedMealIds(new Set())
    } else {
      setSelectedMealIds(new Set(importableMeals.map((m) => m.id)))
    }
  }

  function handleImport() {
    if (selectedMealIds.size === 0) return
    const ids = Array.from(selectedMealIds)
    startImportTransition(async () => {
      try {
        if (isFamilyMode) {
          await importPersonalMealsAction({ mealIds: ids })
          toast.success(
            `${ids.length} recette${ids.length > 1 ? "s" : ""} importée${ids.length > 1 ? "s" : ""} dans la famille`
          )
        } else {
          await importFamilyMealsAction({ mealIds: ids })
          toast.success(
            `${ids.length} recette${ids.length > 1 ? "s" : ""} importée${ids.length > 1 ? "s" : ""} dans mes idées`
          )
        }
        setImportOpen(false)
        setSelectedMealIds(new Set())
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  return (
    <>
      <PageHeader
        title="Idées"
        actions={
          <div className="flex items-center gap-2">
            {isFamilyMode && personalMeals.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12 gap-1.5"
                onClick={() => {
                  setSelectedMealIds(new Set(personalMeals.map((m) => m.id)))
                  setImportOpen(true)
                }}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Importer mes recettes perso</span>
                <span className="sm:hidden">Importer perso</span>
              </Button>
            ) : null}
            {!isFamilyMode && familyMeals.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12 gap-1.5"
                onClick={() => {
                  setSelectedMealIds(new Set(familyMeals.map((m) => m.id)))
                  setImportOpen(true)
                }}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Importer les recettes du groupe</span>
                <span className="sm:hidden">Importer groupe</span>
              </Button>
            ) : null}
            <Button asChild className="min-h-12">
              <Link href="/idees/nouvelle">Nouvelle idée</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 px-4 md:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {isFamilyMode ? (
              <>
                <Users className="size-3.5" />
                <span>Espace {scopeDisplayName ?? "Famille"}</span>
              </>
            ) : (
              <span>Espace Personnel</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {meals.length} plat{meals.length > 1 ? "s" : ""} au catalogue
          </span>
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un plat ou un ingrédient"
          aria-label="Rechercher un plat ou un ingrédient"
        />
      </div>

      {meals.length === 0 ? (
        <EmptyState
          message="Tes plats restent ici. Tu les reposes sur n’importe quelle semaine."
          actionLabel="Nouvelle idée"
          actionHref="/idees/nouvelle"
        />
      ) : filtered.length === 0 ? (
        <div className="mx-4 mt-6 flex flex-col items-center justify-center rounded-[1rem] border border-dashed border-border bg-surface/50 p-8 text-center md:mx-8">
          <p className="font-fraunces text-lg text-ink">
            Aucun plat ne correspond à «&nbsp;{query.trim()}&nbsp;»
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Vérifie l’orthographe ou ajoute une nouvelle idée dans ton carnet.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuery("")}
            >
              Effacer la recherche
            </Button>
            <Button asChild size="sm">
              <Link
                href={`/idees/nouvelle?nom=${encodeURIComponent(query.trim())}`}
              >
                Créer «&nbsp;{query.trim()}&nbsp;»
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 px-4 pb-8 md:grid-cols-2 md:px-8">
          {filtered.map((meal) => (
            <li key={meal.id}>
              <Link
                href={`/idees/${meal.id}`}
                className="tap-press block min-h-20 rounded-[1rem] bg-surface p-4 shadow-card hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-fraunces text-xl break-words line-clamp-2">
                    {meal.name}
                  </p>
                  {isFamilyMode ? (
                    meal.createdByName ? (
                      <span className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Ajouté par {meal.createdByName}
                      </span>
                    ) : meal.origin === "ai" ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Par IA
                      </span>
                    ) : null
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ingredientCountLabel(meal.ingredients.length)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Dialogue d'import des recettes (perso <-> famille) */}
      {importableMeals.length > 0 ? (
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-fraunces text-lg">
                {isFamilyMode
                  ? "Importer mes recettes perso"
                  : "Importer les recettes du groupe"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isFamilyMode
                  ? "Copiez vos recettes personnelles vers le catalogue de la famille. En cas de doublon de nom, elles seront automatiquement renommées avec votre prénom."
                  : "Copiez des recettes partagées de votre groupe vers votre carnet d'idées personnel."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between border-b pb-2 pt-1 text-xs">
              <span className="text-muted-foreground">
                {selectedMealIds.size} sélectionnée{selectedMealIds.size > 1 ? "s" : ""} sur{" "}
                {importableMeals.length}
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="font-medium text-primary hover:underline"
              >
                {selectedMealIds.size === importableMeals.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
            </div>

            <ScrollArea className="max-h-64 py-1">
              <div className="flex flex-col gap-2">
                {importableMeals.map((meal) => {
                  const checked = selectedMealIds.has(meal.id)
                  return (
                    <label
                      key={meal.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMeal(meal.id)}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{meal.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {ingredientCountLabel(meal.ingredients.length)}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setImportOpen(false)}
                disabled={isImporting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedMealIds.size === 0 || isImporting}
              >
                {isImporting
                  ? "Import en cours..."
                  : `Importer (${selectedMealIds.size})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
