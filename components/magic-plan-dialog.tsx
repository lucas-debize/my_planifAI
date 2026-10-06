"use client"

import { useState, useTransition } from "react"
import { Dices, Loader2, RefreshCw, Sparkles, Utensils } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { parseISODate, slotTitleDate } from "@/lib/dates"
import { SLOT_LABEL, type SlotKind } from "@/lib/week"
import {
  generateWeekPlanProposal,
  rerollSlot,
  type AutoPlanOptions,
  type PlanProposal,
} from "@/lib/ai/auto-planner"
import { applyAutoPlanAction } from "@/lib/actions/auto-plan"
import { actionErrorMessage } from "@/lib/errors"
import type { MealWithIngredients } from "@/lib/domain/meals"
import type { WeekSlot } from "@/lib/domain/slots"
import { cn } from "@/lib/utils"

export function MagicPlanDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slots: WeekSlot[]
  meals: MealWithIngredients[]
  onApplied: (
    appliedSlots: {
      date: string
      kind: SlotKind
      meal: { id: string; name: string }
    }[]
  ) => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <MagicPlanModalContent {...props} /> : null}
    </Dialog>
  )
}

function MagicPlanModalContent({
  onOpenChange,
  slots,
  meals,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void
  slots: WeekSlot[]
  meals: MealWithIngredients[]
  onApplied: (
    appliedSlots: {
      date: string
      kind: SlotKind
      meal: { id: string; name: string }
    }[]
  ) => void
}) {
  const [vegetarianOnly, setVegetarianOnly] = useState(false)
  const [onlyCatalog, setOnlyCatalog] = useState(false)
  const [proposals, setProposals] = useState<PlanProposal[]>(() =>
    generateWeekPlanProposal({
      slots,
      catalogMeals: meals,
      options: { mode: "balanced", onlyCatalog: false },
    })
  )
  const [isApplying, startApplyTransition] = useTransition()

  const emptySlotsCount = slots.filter((s) => s.meal === null).length

  function generate(veg = vegetarianOnly, catalog = onlyCatalog) {
    const opts: AutoPlanOptions = {
      mode: veg ? "vegetarian" : "balanced",
      onlyCatalog: catalog,
    }
    const generated = generateWeekPlanProposal({
      slots,
      catalogMeals: meals,
      options: opts,
    })
    setProposals(generated)
  }
  function handleRerollSlot(index: number) {
    const target = proposals[index]
    if (!target) return

    const replacement = rerollSlot({
      slot: { date: target.date, kind: target.kind },
      currentMealName: target.meal.name,
      proposals,
      catalogMeals: meals,
      options: {
        mode: vegetarianOnly ? "vegetarian" : "balanced",
        onlyCatalog,
      },
    })

    if (!replacement) {
      toast.info("Aucune autre alternative disponible pour ce créneau.")
      return
    }

    setProposals((current) => {
      const next = [...current]
      next[index] = {
        ...target,
        meal: replacement,
      }
      return next
    })
  }

  function handleApply() {
    if (proposals.length === 0) return

    startApplyTransition(async () => {
      try {
        const result = await applyAutoPlanAction(
          proposals.map((p) => ({
            date: p.date,
            kind: p.kind,
            meal: {
              id: p.meal.id,
              name: p.meal.name,
              ingredients: p.meal.ingredients,
              origin: p.meal.origin,
            },
          }))
        )
        onApplied(result.slots)
        toast.success(
          `${result.count} repas planifié${result.count > 1 ? "s" : ""} ! Les ingrédients sont ajoutés aux courses.`
        )
        onOpenChange(false)
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  const categoryEmoji: Record<string, string> = {
    poisson: "🐟 Poisson",
    viande: "🥩 Viande",
    vege: "🥬 Végé",
    feculent: "🍝 Féculent",
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-fraunces text-lg">
                Magic Fill : Remplir la semaine avec l&apos;IA
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Complète intelligemment les créneaux vides en respectant l&apos;équilibre et la
                rotation des repas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {emptySlotsCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Utensils className="size-8 text-muted-foreground/60" />
            <p className="font-fraunces text-base text-ink">
              Tous les créneaux de cette semaine sont déjà remplis !
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Videz quelques créneaux pour laisser l&apos;IA vous faire des propositions
              équilibrées.
            </p>
          </div>
        ) : (
          <>
            {/* Options de filtrage rapide */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-muted/40 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Switch
                  id="veg-mode"
                  checked={vegetarianOnly}
                  onCheckedChange={(checked) => {
                    setVegetarianOnly(checked)
                    generate(checked, onlyCatalog)
                  }}
                />
                <Label htmlFor="veg-mode" className="cursor-pointer font-medium">
                  100% Végétarien
                </Label>
              </div>

              {meals.length >= 3 ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id="catalog-only"
                    checked={onlyCatalog}
                    onCheckedChange={(checked) => {
                      setOnlyCatalog(checked)
                      generate(vegetarianOnly, checked)
                    }}
                  />
                  <Label htmlFor="catalog-only" className="cursor-pointer font-medium">
                    Mon carnet uniquement
                  </Label>
                </div>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => generate(vegetarianOnly, onlyCatalog)}
                disabled={isApplying}
              >
                <RefreshCw className="size-3" />
                <span>Tout régénérer</span>
              </Button>
            </div>

            {/* Liste des propositions créneau par créneau */}
            <ScrollArea className="flex-1 max-h-[46vh] pr-2">
              <div className="flex flex-col gap-2 py-1">
                {proposals.map((proposal, index) => {
                  const parsed = parseISODate(proposal.date)
                  const dateLabel = parsed ? slotTitleDate(parsed) : proposal.date

                  return (
                    <div
                      key={`${proposal.date}:${proposal.kind}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/80 p-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {dateLabel} · {SLOT_LABEL[proposal.kind]}
                        </span>
                        <span className="truncate font-fraunces text-sm font-medium text-ink">
                          {proposal.meal.name}
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                            {categoryEmoji[proposal.meal.category] ?? "Équilibré"}
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-medium",
                              proposal.meal.origin === "catalog"
                                ? "bg-primary/10 text-primary"
                                : "bg-accent/15 text-accent-fg"
                            )}
                          >
                            {proposal.meal.origin === "catalog" ? "📖 Mon carnet" : "✨ Idée IA"}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 shrink-0 p-0 text-muted-foreground hover:text-ink"
                        title="Régénérer ce créneau"
                        onClick={() => handleRerollSlot(index)}
                        disabled={isApplying}
                      >
                        <Dices className="size-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-xs text-muted-foreground self-center">
                {proposals.length} créneau{proposals.length > 1 ? "s" : ""} à compléter
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isApplying}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={proposals.length === 0 || isApplying}
                  className="gap-2"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Application...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Appliquer au planning</span>
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
    </DialogContent>
  )
}
