"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Plus, Search, Sparkles, Trash2, Users, X } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { MagicRecipeDialog } from "@/components/magic-recipe-dialog"
import { ingredientCountLabel } from "@/components/meal-picker"
import { importPersonalMealsAction, importFamilyMealsAction, deleteMeal } from "@/lib/actions/meals"
import { actionErrorMessage } from "@/lib/errors"
import { tapFeedback } from "@/hooks/use-press"
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
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set())
  const [isImporting, startImportTransition] = useTransition()
  const [mealToDelete, setMealToDelete] = useState<MealWithIngredients | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirmDelete() {
    if (!mealToDelete) return
    setIsDeleting(true)
    try {
      await deleteMeal(mealToDelete.id)
      toast.success(`Plat « ${mealToDelete.name} » supprimé`)
      setMealToDelete(null)
      router.refresh()
    } catch (err) {
      toast.error(actionErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <MagicRecipeDialog
              onBatchImported={() => router.refresh()}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="tap-press min-h-10 gap-1.5 rounded-xl border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 shadow-2xs transition-all sm:min-h-11 sm:text-sm"
                >
                  <Sparkles className="size-4 text-primary" />
                  <span className="hidden sm:inline">Import planning (photo, texte)</span>
                  <span className="sm:hidden">Import planning</span>
                </Button>
              }
            />
            {isFamilyMode && personalMeals.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="tap-press min-h-10 gap-1.5 rounded-xl border-line bg-surface text-xs font-semibold hover:bg-muted shadow-2xs transition-all sm:min-h-11 sm:text-sm"
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
                size="sm"
                className="tap-press min-h-10 gap-1.5 rounded-xl border-line bg-surface text-xs font-semibold hover:bg-muted shadow-2xs transition-all sm:min-h-11 sm:text-sm"
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
            <Button asChild size="sm" className="tap-press min-h-10 gap-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-all sm:min-h-11 sm:text-sm">
              <Link href="/idees/nouvelle">
                <Plus className="size-4" />
                <span>Nouvelle idée</span>
              </Link>
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

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un plat ou un ingrédient..."
            aria-label="Rechercher un plat ou un ingrédient"
            className="pl-10 pr-9 min-h-11 rounded-xl border-line/80 bg-surface shadow-2xs focus-visible:ring-primary/30"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="tap-press absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
              aria-label="Effacer la recherche"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
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
        <ul className="mt-4 grid gap-3.5 px-4 pb-8 sm:grid-cols-2 lg:grid-cols-3 md:px-8">
          {filtered.map((meal) => (
            <li key={meal.id}>
              <MealCardItem
                meal={meal}
                isFamilyMode={isFamilyMode}
                onRequestDelete={setMealToDelete}
              />
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

      {/* Dialogue de confirmation de suppression d'un plat */}
      <AlertDialog open={mealToDelete !== null} onOpenChange={(open) => !open && setMealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer « {mealToDelete?.name} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les créneaux de planning qui utilisent ce plat deviendront vides. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="min-h-11">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              className="min-h-11"
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
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

function MealCardItem({
  meal,
  isFamilyMode,
  onRequestDelete,
}: {
  meal: MealWithIngredients
  isFamilyMode: boolean
  onRequestDelete: (meal: MealWithIngredients) => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<number | undefined>(undefined)
  const didLongPressRef = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    didLongPressRef.current = false
    setIsSwiping(false)

    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true
      tapFeedback()
      onRequestDelete(meal)
    }, 500)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y

    if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwiping) {
      window.clearTimeout(longPressTimerRef.current)
      return
    }

    if (Math.abs(deltaX) > 10) {
      window.clearTimeout(longPressTimerRef.current)
    }

    if (deltaX < 0) {
      setIsSwiping(true)
      setOffsetX(Math.max(deltaX, -100))
    }
  }

  function handleTouchEnd() {
    window.clearTimeout(longPressTimerRef.current)
    if (offsetX < -60) {
      tapFeedback()
      onRequestDelete(meal)
    }
    setOffsetX(0)
    setIsSwiping(false)
    touchStartRef.current = null
  }

  return (
    <div className="relative overflow-hidden rounded-2xl group">
      {/* Fond rouge de suppression révélé au glissement */}
      <div
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-destructive text-white rounded-r-2xl font-semibold text-xs transition-opacity"
        style={{ opacity: offsetX < -15 ? 1 : 0 }}
      >
        <div className="flex flex-col items-center gap-1">
          <Trash2 className="size-4.5" />
          <span>Supprimer</span>
        </div>
      </div>

      {/* Carte principale */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? "none" : "transform 200ms ease-out",
        }}
        className="relative z-10 bg-surface rounded-2xl border border-line/70 shadow-2xs hover:shadow-xs hover:border-line hover:bg-surface/90 transition-all select-none"
      >
        <Link
          href={`/idees/${meal.id}`}
          onClick={(e) => {
            if (didLongPressRef.current || offsetX !== 0) {
              e.preventDefault()
            }
          }}
          className="tap-press flex flex-col justify-between min-h-24 p-4"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="font-fraunces text-lg sm:text-xl font-bold tracking-tight text-ink group-hover:text-primary transition-colors break-words line-clamp-2">
                {meal.name}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {isFamilyMode ? (
                  meal.createdByName ? (
                    <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {meal.createdByName}
                    </span>
                  ) : meal.origin === "ai" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                      IA
                    </span>
                  ) : null
                ) : null}

                {/* Bouton corbeille discret pour suppression directe sans swipe */}
                <button
                  type="button"
                  aria-label={`Supprimer ${meal.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRequestDelete(meal)
                  }}
                  className="tap-press inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground font-medium">
              {ingredientCountLabel(meal.ingredients.length)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/70 group-hover:text-primary font-semibold transition-colors">
            <span>Modifier le plat</span>
            <span className="transform group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
