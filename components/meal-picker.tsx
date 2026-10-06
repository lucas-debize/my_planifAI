"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, User, Users } from "lucide-react"
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
  personalMeals = [],
  isFamilyMode = false,
  onAssign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  kind: SlotKind
  currentMeal: { id: string; name: string } | null
  meals: MealWithIngredients[]
  personalMeals?: MealWithIngredients[]
  isFamilyMode?: boolean
  onAssign: (
    meal: { id: string; name: string } | null,
    isPersonal?: boolean
  ) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [tab, setTab] = useState<"family" | "personal">("family")
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)
  const parsed = parseISODate(date)
  const dateLabel = parsed ? slotTitleDate(parsed) : date
  const title = creating
    ? `Nouvelle idée · ${SLOT_LABEL[kind]}`
    : `${SLOT_LABEL[kind]} · ${dateLabel}`

  const activeMealList = isFamilyMode && tab === "personal" ? personalMeals : meals

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
    if (!q) return activeMealList
    return activeMealList.filter((meal) => {
      if (meal.name.toLowerCase().includes(q)) return true
      return meal.ingredients.some((ingredient) =>
        ingredient.name.toLowerCase().includes(q)
      )
    })
  }, [activeMealList, query])

  function reset() {
    setTab("family")
    setCreating(false)
    setQuery("")
    setPickingId(null)
  }

  function assign(
    meal: { id: string; name: string } | null,
    fromPersonal = false
  ) {
    if (pickingId) return
    tapFeedback()
    setPickingId(meal?.id ?? "empty")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(
      () => {
        onAssign(meal, fromPersonal)
        onOpenChange(false)
        reset()
      },
      reduce ? 0 : 180
    )
  }

  const isFromPersonalTab = isFamilyMode && tab === "personal"

  const body = creating ? (
    <MealForm
      initialName={query.trim() || undefined}
      knownIngredients={knownIngredients}
      submitLabel="Ajouter au créneau"
      onCancel={() => setCreating(false)}
      onSaved={(saved) => assign({ id: saved.id, name: saved.name }, false)}
    />
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {isFamilyMode ? (
        <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "family"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("family")}
          >
            <Users className="size-3.5" />
            <span>Plats de la famille</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "personal"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("personal")}
          >
            <User className="size-3.5" />
            <span>Mes recettes perso</span>
          </button>
        </div>
      ) : null}

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          isFromPersonalTab ? "Rechercher parmi mes plats perso" : "Rechercher un plat"
        }
        aria-label="Rechercher un plat"
        data-vaul-no-drag
      />

      <ScrollArea className="h-64" data-vaul-no-drag>
        {filtered.length === 0 ? (
          query.trim() ? (
            <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun plat ne correspond à «&nbsp;{query.trim()}&nbsp;»
              </p>
              {!isFromPersonalTab ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <Link
                    href={`/idees/nouvelle?nom=${encodeURIComponent(query.trim())}&date=${date}&kind=${kind}`}
                    onClick={() => onOpenChange(false)}
                  >
                    Créer le plat «&nbsp;{query.trim()}&nbsp;»
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              {isFromPersonalTab
                ? "Aucun plat personnel dans votre carnet."
                : "Aucun plat dans le carnet de la famille."}
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((meal) => {
              const chosen =
                pickingId === meal.id ||
                (!pickingId && !isFromPersonalTab && currentMeal?.id === meal.id)
              return (
                <li key={meal.id}>
                  <button
                    type="button"
                    className={cn(
                      "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-[0.75rem] px-3 text-left",
                      chosen ? "bg-muted" : "hover:bg-muted"
                    )}
                    onClick={() => assign({ id: meal.id, name: meal.name }, isFromPersonalTab)}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-fraunces text-base">{meal.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ingredientCountLabel(meal.ingredients.length)}
                        {meal.createdByName ? ` · Par ${meal.createdByName}` : ""}
                        {isFromPersonalTab ? " · Cliquez pour importer & planifier" : ""}
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
        asChild
        variant="outline"
        className="min-h-12"
      >
        <Link
          href={`/idees/nouvelle?date=${date}&kind=${kind}${query.trim() ? `&nom=${encodeURIComponent(query.trim())}` : ""}`}
          onClick={() => onOpenChange(false)}
        >
          Nouvelle idée
        </Link>
      </Button>
      {currentMeal ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-12"
          onClick={() => assign(null, false)}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            {creating ? (
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="tap-press inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-ink"
              >
                <ArrowLeft className="size-3.5" />
                <span>Choisir un plat existant</span>
              </button>
            ) : null}
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
          {creating ? (
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="tap-press inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-ink"
            >
              <ArrowLeft className="size-3.5" />
              <span>Choisir un plat existant</span>
            </button>
          ) : null}
          <DrawerTitle className="font-fraunces">{title}</DrawerTitle>
        </DrawerHeader>
        <div
          className="max-h-[calc(85dvh-8rem)] overflow-y-auto px-4 pb-4 overscroll-contain"
          data-vaul-no-drag
        >
          {body}
        </div>
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
