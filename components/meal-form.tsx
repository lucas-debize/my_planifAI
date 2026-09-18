"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { upsertMeal } from "@/lib/actions/meals"
import { actionErrorMessage } from "@/lib/errors"
import { normalizeName } from "@/lib/ingredients"
import type { MealWithIngredients } from "@/lib/domain/meals"

export function MealForm({
  meal,
  knownIngredients,
  submitLabel = "Enregistrer",
  onSaved,
  onCancel,
}: {
  meal?: MealWithIngredients
  knownIngredients: { id: string; name: string }[]
  submitLabel?: string
  onSaved: (saved: MealWithIngredients) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(meal?.name ?? "")
  const [ingredients, setIngredients] = useState(
    meal?.ingredients.map((item) => item.name) ?? []
  )
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const selectedNorms = useMemo(
    () => new Set(ingredients.map(normalizeName)),
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

  function addIngredient(value: string) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setIngredients((current) => {
      const next = [...current]
      const seen = new Set(current.map(normalizeName))
      for (const part of parts) {
        const norm = normalizeName(part)
        if (!norm || seen.has(norm)) continue
        seen.add(norm)
        next.push(part.replace(/\s+/g, " "))
      }
      return next
    })
    setDraft("")
    setOpen(false)
  }

  function saveChip(original: string) {
    const next = editValue.trim().replace(/\s+/g, " ")
    if (!next) {
      setIngredients((current) => current.filter((value) => value !== original))
      setEditing(null)
      return
    }
    const nextNorm = normalizeName(next)
    setIngredients((current) => {
      const taken = current.some(
        (value) => value !== original && normalizeName(value) === nextNorm
      )
      if (taken) return current
      return current.map((value) => (value === original ? next : value))
    })
    setEditing(null)
  }

  function onDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addIngredient(draft)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("Donne un nom au plat.")
      return
    }
    setPending(true)
    try {
      const saved = await upsertMeal({
        id: meal?.id,
        name,
        ingredientNames: ingredients,
      })
      toast.success("Plat enregistré")
      onSaved(saved)
    } catch (error) {
      toast.error(actionErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="meal-name">Nom du plat</Label>
        <Input
          id="meal-name"
          value={name}
          maxLength={80}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ingredient-draft">Ingrédients</Label>
        <div className="flex flex-wrap gap-2">
          {ingredients.map((item) =>
            editing === item ? (
              <Input
                key={item}
                value={editValue}
                autoFocus
                maxLength={80}
                aria-label={`Modifier ${item}`}
                className="h-12 min-h-12 w-40"
                onChange={(event) => setEditValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    saveChip(item)
                  }
                  if (event.key === "Escape") setEditing(null)
                }}
                onBlur={() => saveChip(item)}
              />
            ) : (
              <span
                key={item}
                className="inline-flex min-h-12 items-center gap-1 rounded-full bg-muted px-3 text-sm text-ink"
              >
                <button
                  type="button"
                  className="tap-press max-w-[12rem] truncate"
                  onClick={() => {
                    setEditing(item)
                    setEditValue(item)
                  }}
                >
                  {item}
                </button>
                <button
                  type="button"
                  className="tap-press inline-flex size-8 items-center justify-center rounded-full hover:bg-background"
                  aria-label={`Supprimer ${item}`}
                  onClick={() =>
                    setIngredients((current) =>
                      current.filter((value) => value !== item)
                    )
                  }
                >
                  <X className="size-4" />
                </button>
              </span>
            )
          )}
        </div>
        <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <Input
              id="ingredient-draft"
              value={draft}
              placeholder="Entrée ou virgule pour ajouter"
              onChange={(event) => {
                setDraft(event.target.value)
                setOpen(true)
              }}
              onKeyDown={onDraftKeyDown}
              onBlur={() => {
                if (draft.trim()) addIngredient(draft)
              }}
            />
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-1"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <ul>
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="tap-press flex min-h-12 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addIngredient(item.name)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={onCancel}
          >
            Annuler
          </Button>
        ) : null}
        <Button type="submit" className="min-h-12" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
