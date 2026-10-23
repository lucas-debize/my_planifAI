"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MagicRecipeDialog } from "@/components/magic-recipe-dialog"
import { ingredientCountLabel } from "@/components/meal-picker"
import { upsertMeal } from "@/lib/actions/meals"
import { actionErrorMessage } from "@/lib/errors"
import { displayName, normalizeName } from "@/lib/ingredients"
import { cleanIngredientName, extractIngredientQuantity } from "@/lib/ai/recipe-extractor"
import type { MealWithIngredients } from "@/lib/domain/meals"

export type FormIngredientItem = {
  name: string
  quantity?: string | null
}

export function MealForm({
  meal,
  initialName,
  knownIngredients,
  submitLabel = "Enregistrer",
  existingMeals,
  onSaved,
  onCancel,
}: {
  meal?: MealWithIngredients
  initialName?: string
  knownIngredients: { id: string; name: string }[]
  submitLabel?: string
  existingMeals?: MealWithIngredients[]
  onSaved: (saved: MealWithIngredients) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(meal?.name ?? initialName ?? "")
  const [ingredients, setIngredients] = useState<FormIngredientItem[]>(() =>
    meal?.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity ?? null,
    })) ?? []
  )
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)

  // Édition d'un ingrédient spécifique
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editQty, setEditQty] = useState("")

  const duplicateMeal = useMemo(() => {
    if (meal) return null
    const norm = normalizeName(name)
    if (!norm) return null
    return existingMeals?.find((m) => normalizeName(m.name) === norm) ?? null
  }, [meal, name, existingMeals])

  const selectedNorms = useMemo(
    () => new Set(ingredients.map((i) => normalizeName(i.name))),
    [ingredients]
  )

  const suggestions = useMemo(() => {
    const query = normalizeName(draft)
    if (!query) return []
    return knownIngredients.filter((item) => {
      const norm = normalizeName(item.name)
      return norm.startsWith(query) && !selectedNorms.has(norm)
    })
  }, [draft, knownIngredients, selectedNorms])

  function parseInputToIngredient(part: string): FormIngredientItem | null {
    const trimmed = part.trim()
    if (!trimmed) return null
    const cleaned = cleanIngredientName(trimmed)
    const name = displayName(cleaned || trimmed)
    if (!name) return null
    const quantity = extractIngredientQuantity(trimmed) ?? null
    return { name, quantity }
  }

  function addIngredient(value: string) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return

    setIngredients((current) => {
      const next = [...current]
      const seen = new Set(current.map((i) => normalizeName(i.name)))
      for (const part of parts) {
        const item = parseInputToIngredient(part)
        if (!item) continue
        const norm = normalizeName(item.name)
        if (!norm || seen.has(norm)) continue
        seen.add(norm)
        next.push(item)
      }
      return next
    })
    setDraft("")
    setOpen(false)
  }

  function startEditing(index: number) {
    const target = ingredients[index]
    if (!target) return
    setEditingIndex(index)
    setEditName(target.name)
    setEditQty(target.quantity ?? "")
  }

  function saveEditing() {
    if (editingIndex === null) return
    const target = ingredients[editingIndex]
    if (!target) {
      setEditingIndex(null)
      return
    }

    const nextName = displayName(editName)
    if (!nextName) {
      // Si le nom est vidé, on supprime l'ingrédient
      setIngredients((current) => current.filter((_, idx) => idx !== editingIndex))
      setEditingIndex(null)
      return
    }

    const nextNorm = normalizeName(nextName)
    const nextQty = editQty.trim() || null

    setIngredients((current) => {
      const taken = current.some(
        (item, idx) => idx !== editingIndex && normalizeName(item.name) === nextNorm
      )
      if (taken) {
        toast.error("Cet ingrédient est déjà présent dans la liste.")
        return current
      }
      return current.map((item, idx) =>
        idx === editingIndex ? { name: nextName, quantity: nextQty } : item
      )
    })
    setEditingIndex(null)
  }

  function onDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addIngredient(draft)
    }
  }

  function prepareIngredients(): FormIngredientItem[] {
    const list = [...ingredients]
    if (editingIndex !== null && list[editingIndex]) {
      const nextName = displayName(editName)
      if (nextName) {
        list[editingIndex] = {
          name: nextName,
          quantity: editQty.trim() || null,
        }
      }
    }
    if (draft.trim()) {
      const parts = draft
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
      const seen = new Set(list.map((i) => normalizeName(i.name)))
      for (const part of parts) {
        const item = parseInputToIngredient(part)
        if (!item) continue
        const norm = normalizeName(item.name)
        if (!norm || seen.has(norm)) continue
        seen.add(norm)
        list.push(item)
      }
    }
    return list
  }

  async function executeSave(targetMealId?: string) {
    if (!name.trim()) {
      toast.error("Donne un nom au plat.")
      return
    }

    const submitIngredients = prepareIngredients()
    setIngredients(submitIngredients)
    setDraft("")
    setOpen(false)
    setEditingIndex(null)

    setPending(true)
    try {
      const saved = await upsertMeal({
        id: targetMealId ?? meal?.id,
        name: name.trim(),
        ingredientNames: submitIngredients,
      })
      toast.success(
        targetMealId ? "Ancien plat écrasé et mis à jour" : "Plat enregistré"
      )
      onSaved(saved)
    } catch (error) {
      toast.error(actionErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("Donne un nom au plat.")
      return
    }

    if (duplicateMeal) {
      toast.error(`Le plat « ${duplicateMeal.name} » existe déjà dans tes idées.`)
      return
    }

    await executeSave()
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="meal-name">Nom du plat</Label>
          <MagicRecipeDialog
            onRecipeExtracted={(extracted) => {
              if (extracted.title) setName(extracted.title)
              if (extracted.detailedIngredients && extracted.detailedIngredients.length > 0) {
                setIngredients((current) => {
                  const seen = new Set(current.map((i) => normalizeName(i.name)))
                  const next = [...current]
                  for (const ing of extracted.detailedIngredients) {
                    const norm = normalizeName(ing.name)
                    if (!seen.has(norm)) {
                      seen.add(norm)
                      next.push({ name: ing.name, quantity: ing.quantity ?? null })
                    }
                  }
                  return next
                })
              } else if (extracted.ingredients.length > 0) {
                setIngredients((current) => {
                  const seen = new Set(current.map((i) => normalizeName(i.name)))
                  const next = [...current]
                  for (const ing of extracted.ingredients) {
                    const norm = normalizeName(ing)
                    if (!seen.has(norm)) {
                      seen.add(norm)
                      next.push({ name: ing, quantity: null })
                    }
                  }
                  return next
                })
              }
            }}
          />
        </div>
        <Input
          id="meal-name"
          value={name}
          maxLength={80}
          required
          placeholder="ex: Poulet basquaise, Salade niçoise..."
          className="min-h-11 rounded-xl border-line/80 bg-surface shadow-2xs text-base font-semibold focus-visible:ring-primary/30"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ingredient-draft">Ingrédients &amp; Quantités</Label>
          <span className="text-[11px] text-muted-foreground">
            Cliquez sur un ingrédient pour modifier sa quantité
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ingredients.map((item, index) =>
            editingIndex === index ? (
              <div
                key={index}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-primary bg-surface p-1 shadow-xs"
              >
                <Input
                  value={editQty}
                  placeholder="Qté"
                  autoFocus
                  maxLength={40}
                  className="h-9 w-20 px-2 font-mono text-xs"
                  onChange={(e) => setEditQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      saveEditing()
                    }
                    if (e.key === "Escape") setEditingIndex(null)
                  }}
                />
                <Input
                  value={editName}
                  maxLength={80}
                  className="h-9 w-32 px-2 text-xs"
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      saveEditing()
                    }
                    if (e.key === "Escape") setEditingIndex(null)
                  }}
                />
                <button
                  type="button"
                  onClick={saveEditing}
                  aria-label="Valider la modification"
                  className="tap-press inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  aria-label="Annuler la modification"
                  className="tap-press inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <span
                key={index}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-muted/60 pl-2.5 pr-1.5 py-1 text-sm text-ink transition-colors hover:border-line-active"
              >
                {item.quantity ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    {item.quantity}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="tap-press max-w-[14rem] truncate text-xs font-medium hover:underline"
                  onClick={() => startEditing(index)}
                  title="Modifier le nom ou la quantité"
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  className="tap-press inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-ink"
                  onClick={() => startEditing(index)}
                  aria-label={`Modifier ${item.name}`}
                  title="Modifier"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  className="tap-press inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Supprimer ${item.name}`}
                  onClick={() =>
                    setIngredients((current) =>
                      current.filter((_, idx) => idx !== index)
                    )
                  }
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )
          )}
        </div>

        <Input
          id="ingredient-draft"
          value={draft}
          placeholder="ex: 200g farine, 3 oeufs, 1 c. à soupe d'huile..."
          className="min-h-11 rounded-xl border-line/80 bg-surface shadow-2xs text-sm focus-visible:ring-primary/30"
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
          }}
          onKeyDown={onDraftKeyDown}
        />
        {open && suggestions.length > 0 ? (
          <ul
            className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-sm"
            aria-label="Suggestions d'ingrédients"
          >
            {suggestions.slice(0, 5).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="tap-press flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted"
                  onClick={() => addIngredient(item.name)}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {duplicateMeal ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold">Ce plat existe déjà dans tes idées</p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                Un plat nommé « {duplicateMeal.name} » existe déjà ({ingredientCountLabel(duplicateMeal.ingredients.length)}). Tu ne peux pas créer de doublon.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-semibold"
              disabled={pending}
              onClick={() => executeSave(duplicateMeal.id)}
            >
              Écraser l&apos;ancien plat
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end pt-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="tap-press min-h-11 sm:min-h-12 rounded-xl font-medium"
            onClick={onCancel}
          >
            Annuler
          </Button>
        ) : null}
        <Button type="submit" className="tap-press min-h-11 sm:min-h-12 rounded-xl font-semibold shadow-xs px-6" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  )
}
