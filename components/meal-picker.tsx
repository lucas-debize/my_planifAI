"use client"

import { useMemo, useRef, useState } from "react"
import { Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MealForm } from "@/components/meal-form"
import { parseISODate, slotTitleDate } from "@/lib/dates"
import { SLOT_LABEL, type SlotKind } from "@/lib/week"
import type { MealWithIngredients } from "@/lib/domain/meals"
import { useMediaQuery } from "@/hooks/use-media-query"
import { tapFeedback } from "@/hooks/use-press"
import { cn } from "@/lib/utils"

export function MealPicker({
  open,
  onOpenChange,
  date,
  kind,
  currentMeal,
  meals,
  onAssign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  kind: SlotKind
  currentMeal: { id: string; name: string } | null
  meals: MealWithIngredients[]
  onAssign: (meal: { id: string; name: string } | null) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)
  const parsed = parseISODate(date)
  const title = `${SLOT_LABEL[kind]} · ${parsed ? slotTitleDate(parsed) : date}`

  const knownIngredients = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const meal of meals) {
      for (const ingredient of meal.ingredients) {
        map.set(ingredient.id, ingredient)
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [meals])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return meals
    return meals.filter((meal) => {
      if (meal.name.toLowerCase().includes(q)) return true
      return meal.ingredients.some((ingredient) =>
        ingredient.name.toLowerCase().includes(q)
      )
    })
  }, [meals, query])

  function reset() {
    setCreating(false)
    setQuery("")
    setPickingId(null)
  }

  function assign(meal: { id: string; name: string } | null) {
    if (pickingId) return
    tapFeedback()
    setPickingId(meal?.id ?? "empty")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(
      () => {
        onAssign(meal)
        onOpenChange(false)
        reset()
      },
      reduce ? 0 : 180
    )
  }

  const body = creating ? (
    <MealForm
      knownIngredients={knownIngredients}
      submitLabel="Ajouter au créneau"
      onCancel={() => setCreating(false)}
      onSaved={(saved) => assign({ id: saved.id, name: saved.name })}
    />
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un plat"
        aria-label="Rechercher un plat"
      />
      <ScrollArea className="h-64">
        {filtered.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            Aucun plat dans le carnet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((meal) => {
              const chosen =
                pickingId === meal.id ||
                (!pickingId && currentMeal?.id === meal.id)
              return (
                <li key={meal.id}>
                  <button
                    type="button"
                    className={cn(
                      "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-[0.75rem] px-3 text-left",
                      chosen ? "bg-muted" : "hover:bg-muted"
                    )}
                    onClick={() => assign({ id: meal.id, name: meal.name })}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-fraunces text-base">{meal.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {ingredientCountLabel(meal.ingredients.length)}
                      </span>
                    </span>
                    {chosen ? (
                      <Check className="size-5 shrink-0 text-accent" aria-hidden />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  )

  const footer = creating ? null : (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        onClick={() => setCreating(true)}
      >
        Nouvelle idée
      </Button>
      {currentMeal ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-12"
          onClick={() => assign(null)}
        >
          {pickingId === "empty" ? "Retiré" : "Retirer"}
        </Button>
      ) : null}
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset()
          onOpenChange(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-fraunces">{title}</DialogTitle>
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-fraunces">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">{body}</div>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  )
}

export function ingredientCountLabel(count: number) {
  if (count === 0) return "Sans ingrédient"
  if (count === 1) return "1 ingrédient"
  return `${count} ingrédients`
}
