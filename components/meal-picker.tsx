"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, RefreshCw, Sparkles, User, Users, X } from "lucide-react"
import { toast } from "sonner"
import { normalizeName } from "@/lib/ingredients"
import { STAPLE_MEALS } from "@/lib/ai/auto-planner"
import { upsertMeal } from "@/lib/actions/meals"
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
import type { WeekSlot } from "@/lib/domain/slots"
import { useMediaQuery } from "@/hooks/use-media-query"
import { tapFeedback } from "@/hooks/use-press"
import { cn } from "@/lib/utils"

export function ingredientCountLabel(count: number) {
  if (count === 0) return "Aucun ingrédient"
  if (count === 1) return "1 ingrédient"
  return `${count} ingrédients`
}

export type AssignSource = "normal" | "personal" | "family" | "reste"

export function MealPicker({
  open,
  onOpenChange,
  date,
  kind,
  currentMeal,
  meals,
  personalMeals = [],
  familyMeals = [],
  weekSlots = [],
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
  familyMeals?: MealWithIngredients[]
  weekSlots?: WeekSlot[]
  isFamilyMode?: boolean
  onAssign: (
    meal: { id: string; name: string } | null,
    source?: AssignSource
  ) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const hasFamilyGroup = isFamilyMode || familyMeals.length > 0

  // Onglet courant : "primary" (catalogue actif) ou "secondary" (autre catalogue importable)
  const [tab, setTab] = useState<"primary" | "secondary">("primary")
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [pickingReste, setPickingReste] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [aiProposal, setAiProposal] = useState<{
    id?: string
    name: string
    ingredients: string[]
    origin: "catalog" | "ai"
  } | null>(null)
  const closeTimer = useRef<number | null>(null)
  const parsed = parseISODate(date)
  const dateLabel = parsed ? slotTitleDate(parsed) : date

  const title = creating
    ? `Nouvelle idée · ${SLOT_LABEL[kind]}`
    : pickingReste
      ? `🍲 Poser un reste · ${SLOT_LABEL[kind]}`
      : `${SLOT_LABEL[kind]} · ${dateLabel}`

  // Liste active selon l'onglet
  // En mode famille : primary = family (meals), secondary = personal (personalMeals)
  // En mode perso : primary = personal (meals), secondary = family (familyMeals)
  const activeMealList = useMemo(() => {
    if (isFamilyMode) {
      return tab === "secondary" ? personalMeals : meals
    }
    return tab === "secondary" ? familyMeals : meals
  }, [isFamilyMode, tab, meals, personalMeals, familyMeals])

  const isCrossScopeTab = tab === "secondary"

  // Plats cuisinés plus tôt dans la semaine pour l'option rapide "Reste"
  const previousMeals = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const slot of weekSlots) {
      if (slot.meal?.name) {
        const cleanName = slot.meal.name.replace(/^reste\s*:\s*/i, "").trim()
        if (cleanName && !seen.has(cleanName.toLowerCase())) {
          seen.add(cleanName.toLowerCase())
          list.push(cleanName)
        }
      }
    }
    return list
  }, [weekSlots])

  // Plat cuisiné immédiatement avant ce créneau (la veille ou le midi même)
  const previousMealInfo = useMemo(() => {
    if (!date || !kind || weekSlots.length === 0) return null

    const isTargetDiner = kind === "diner"
    const priorSlots = weekSlots.filter((s) => {
      if (s.slot_date < date) return true
      if (s.slot_date === date && isTargetDiner && s.slot_kind === "dejeuner") {
        return true
      }
      return false
    })

    priorSlots.sort((a, b) => {
      if (a.slot_date !== b.slot_date) return b.slot_date.localeCompare(a.slot_date)
      if (a.slot_kind === "diner" && b.slot_kind === "dejeuner") return -1
      if (a.slot_kind === "dejeuner" && b.slot_kind === "diner") return 1
      return 0
    })

    const found = priorSlots.find((s) => Boolean(s.meal?.name))
    if (!found || !found.meal) return null

    const cleanName = found.meal.name.replace(/^reste\s*:\s*/i, "").trim()
    const isSameDayLunch = found.slot_date === date && found.slot_kind === "dejeuner"
    return {
      cleanName,
      label: isSameDayLunch
        ? `Reste de ce midi : ${cleanName}`
        : `Reste de la veille : ${cleanName}`,
      resteTitle: `Reste : ${cleanName}`,
    }
  }, [date, kind, weekSlots])

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
    setTab("primary")
    setCreating(false)
    setPickingReste(false)
    setQuery("")
    setPickingId(null)
    setAiProposal(null)
  }

  function assign(
    meal: { id: string; name: string } | null,
    source: AssignSource = "normal"
  ) {
    if (pickingId) return
    tapFeedback()
    setPickingId(meal?.id ?? "empty")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(
      () => {
        onAssign(meal, source)
        onOpenChange(false)
        reset()
      },
      reduce ? 0 : 180
    )
  }
  function handleAiSuggestSlot() {
    tapFeedback()
    const usedNames = new Set(
      weekSlots
        .filter((s) => s.meal?.name)
        .map((s) => normalizeName(s.meal!.name))
    )

    if (aiProposal) {
      usedNames.add(normalizeName(aiProposal.name))
    }

    // 1. Priorité au carnet d'idées de l'utilisateur
    const availableFromCatalog = meals.filter(
      (m) => !usedNames.has(normalizeName(m.name))
    )

    if (availableFromCatalog.length > 0) {
      const chosen = availableFromCatalog[Math.floor(Math.random() * availableFromCatalog.length)]
      setAiProposal({
        id: chosen.id,
        name: chosen.name,
        ingredients: chosen.ingredients.map((i) => i.name),
        origin: "catalog",
      })
      return
    }

    // 2. Repli : proposition équilibrée intelligente
    const availableStaples = STAPLE_MEALS.filter(
      (s) => !usedNames.has(normalizeName(s.name))
    )
    const staple = availableStaples.length > 0
      ? availableStaples[Math.floor(Math.random() * availableStaples.length)]
      : STAPLE_MEALS[Math.floor(Math.random() * STAPLE_MEALS.length)]

    setAiProposal({
      name: staple.name,
      ingredients: staple.ingredients,
      origin: "ai",
    })
  }

  async function handleConfirmAiProposal() {
    if (!aiProposal) return
    if (aiProposal.id) {
      assign({ id: aiProposal.id, name: aiProposal.name }, "normal")
      toast.success(`Plat « ${aiProposal.name} » ajouté au créneau`)
    } else {
      try {
        const created = await upsertMeal({
          name: aiProposal.name,
          ingredientNames: aiProposal.ingredients.map((ing) => ({ name: ing })),
        })
        assign({ id: created.id, name: created.name }, "normal")
        toast.success(`Plat « ${created.name} » ajouté au créneau`)
      } catch {
        toast.error("Impossible d'enregistrer ce plat.")
      }
    }
    setAiProposal(null)
  }


  const body = creating ? (
    <MealForm
      initialName={query.trim() || undefined}
      knownIngredients={knownIngredients}
      existingMeals={activeMealList}
      submitLabel="Ajouter au créneau"
      onCancel={() => setCreating(false)}
      onSaved={(saved) => assign({ id: saved.id, name: saved.name }, "normal")}
    />
  ) : pickingReste ? (
    /* Sous-vue pour poser un reste de repas */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => setPickingReste(false)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        <span>Retour aux recettes</span>
      </button>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
        <p className="font-semibold">🍲 Reste de repas</p>
        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
          Ce plat est enregistré sans ingrédient lié : aucun doublon ne sera ajouté à votre liste de courses.
        </p>
      </div>

      <ScrollArea className="h-64" data-vaul-no-drag>
        <div className="flex flex-col gap-2">
          {previousMeals.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Plats cuisinés dans la semaine :
              </span>
              {previousMeals.map((prevName) => (
                <button
                  key={prevName}
                  type="button"
                  className="tap-press flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 text-left hover:bg-muted"
                  onClick={() =>
                    assign({ id: "reste", name: `Reste : ${prevName}` }, "reste")
                  }
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span>🍲</span>
                    <span>Reste : {prevName}</span>
                  </span>
                  <span className="text-xs font-medium text-primary">Poser</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Option générique :
            </span>
            <button
              type="button"
              className="tap-press flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 text-left hover:bg-muted"
              onClick={() =>
                assign({ id: "reste", name: "Reste de repas" }, "reste")
              }
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <span>🍲</span>
                <span>Reste de repas</span>
              </span>
              <span className="text-xs font-medium text-primary">Poser</span>
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Actions rapides sur la même ligne : Reste discret & Suggérer avec l'IA */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tap-press h-9 gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-950 dark:text-amber-200 hover:bg-amber-500/20 shadow-2xs"
          onClick={() => {
            if (previousMeals.length > 1) {
              setPickingReste(true)
            } else {
              assign(
                {
                  id: "reste",
                  name: previousMealInfo ? previousMealInfo.resteTitle : "Reste de repas",
                },
                "reste"
              )
            }
          }}
          title={previousMealInfo ? previousMealInfo.label : "Poser un reste"}
        >
          <span>🍲</span>
          <span className="truncate">{previousMealInfo ? "Poser ce reste" : "Poser un reste"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tap-press h-9 gap-1.5 rounded-xl border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 shadow-2xs"
          onClick={handleAiSuggestSlot}
        >
          <Sparkles className="size-3.5 text-primary" />
          <span className="truncate">Remplir avec l&apos;IA</span>
        </Button>
      </div>

      {/* Proposition IA à confirmer avant d'assigner */}
      {aiProposal ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs animate-in fade-in-0 duration-150">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Suggestion IA pour ce créneau</span>
            </span>
            <button
              type="button"
              onClick={() => setAiProposal(null)}
              className="text-muted-foreground hover:text-ink p-0.5"
              aria-label="Fermer la suggestion"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="rounded-lg bg-surface border border-line p-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-fraunces text-sm font-bold text-ink truncate">{aiProposal.name}</p>
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {aiProposal.origin === "catalog" ? "📖 Carnet" : "✨ IA"}
              </span>
            </div>
            {aiProposal.ingredients.length > 0 ? (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {aiProposal.ingredients.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              className="tap-press h-8 flex-1 bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 gap-1.5"
              onClick={handleConfirmAiProposal}
            >
              <Check className="size-3.5" />
              <span>Valider ce plat</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tap-press h-8 px-2.5 text-xs border-line hover:bg-muted gap-1 text-muted-foreground hover:text-ink"
              onClick={handleAiSuggestSlot}
            >
              <RefreshCw className="size-3" />
              <span>Autre idée</span>
            </Button>
          </div>
        </div>
      ) : null}


      {/* Onglets selon le contexte (famille ou perso avec groupe) */}
      {hasFamilyGroup ? (
        <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "primary"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("primary")}
          >
            {isFamilyMode ? (
              <>
                <Users className="size-3.5" />
                <span>Plats de la famille</span>
              </>
            ) : (
              <>
                <User className="size-3.5" />
                <span>Mes recettes perso</span>
              </>
            )}
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "secondary"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("secondary")}
          >
            {isFamilyMode ? (
              <>
                <User className="size-3.5" />
                <span>Mes recettes perso</span>
              </>
            ) : (
              <>
                <Users className="size-3.5" />
                <span>Recettes du groupe</span>
              </>
            )}
          </button>
        </div>
      ) : null}

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          isCrossScopeTab
            ? isFamilyMode
              ? "Rechercher parmi mes plats perso..."
              : "Rechercher dans les recettes du groupe..."
            : "Rechercher un plat..."
        }
        aria-label="Rechercher un plat"
        data-vaul-no-drag
      />

      <ScrollArea className="h-60 max-h-60 overflow-hidden rounded-xl border border-line/50 p-1" data-vaul-no-drag>
        {filtered.length === 0 ? (
          query.trim() ? (
            <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun plat ne correspond à «&nbsp;{query.trim()}&nbsp;»
              </p>
              {!isCrossScopeTab ? (
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
              {isCrossScopeTab
                ? isFamilyMode
                  ? "Aucun plat personnel dans votre carnet."
                  : "Aucun plat dans le carnet du groupe."
                : "Aucun plat disponible."}
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((meal) => {
              const chosen =
                pickingId === meal.id ||
                (!pickingId && !isCrossScopeTab && currentMeal?.id === meal.id)
              return (
                <li key={meal.id}>
                  <button
                    type="button"
                    className={cn(
                      "tap-press flex min-h-12 w-full items-center justify-between gap-3 rounded-[0.75rem] px-3 text-left",
                      chosen ? "bg-muted" : "hover:bg-muted"
                    )}
                    onClick={() =>
                      assign(
                        { id: meal.id, name: meal.name },
                        isCrossScopeTab
                          ? isFamilyMode
                            ? "personal"
                            : "family"
                          : "normal"
                      )
                    }
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-fraunces text-base">{meal.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ingredientCountLabel(meal.ingredients.length)}
                        {meal.createdByName ? ` · Par ${meal.createdByName}` : ""}
                        {isCrossScopeTab
                          ? isFamilyMode
                            ? " · Cliquez pour importer dans le groupe"
                            : " · Cliquez pour importer dans vos plats perso"
                          : ""}
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
    <div className="flex flex-col gap-2 pt-2">
      <Button
        asChild
        className="tap-press min-h-12 w-full rounded-xl font-semibold shadow-xs"
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
          variant="outline"
          className="tap-press min-h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 font-medium"
          onClick={() => assign(null, "normal")}
        >
          Vider ce créneau
        </Button>
      ) : null}
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          if (!next) reset()
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6 overflow-hidden rounded-2xl shadow-xl">
          <DialogHeader className="pb-2 shrink-0">
            <DialogTitle className="font-fraunces text-xl">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col">{body}</div>
          {footer ? <div className="shrink-0 pt-3 border-t border-line/60">{footer}</div> : null}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-fraunces text-xl">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-2">{body}</div>
        {footer ? <DrawerFooter className="pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))] px-4">{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  )
}
