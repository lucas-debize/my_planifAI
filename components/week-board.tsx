"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, Check, FileDown, MoreHorizontal, Sparkles, Trash2 } from "lucide-react"
import { MealPicker } from "@/components/meal-picker"
import { MagicPlanDialog } from "@/components/magic-plan-dialog"
import { Button } from "@/components/ui/button"
import { SlotCard } from "@/components/slot-card"
import { WeekSwitcher } from "@/components/week-switcher"
import { PageHeader } from "@/components/page-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { setWeekStartDayAction } from "@/lib/actions/session"
import {
  setSlot,
  assignPersonalMealToSlot,
  assignFamilyMealToSlot,
  assignResteToSlot,
  clearWeekSlotsAction,
} from "@/lib/actions/slots"
import { actionErrorMessage } from "@/lib/errors"
import {
  isPastDay,
  isToday,
  parseISODate,
  toISODate,
  weekDays,
  weekLabel,
  WEEK_DAY_OPTIONS,
  WEEK_DAY_LABELS,
} from "@/lib/dates"
import type { WeekStartDay } from "@/lib/domain/session"
import { SLOT_LABEL, SLOTS, type SlotKind } from "@/lib/week"
import type { MealWithIngredients } from "@/lib/domain/meals"
import type { WeekSlot } from "@/lib/domain/slots"
import { cn } from "@/lib/utils"

type PickerTarget = { date: string; kind: SlotKind }

type WeekBlock = {
  start: string
  slots: WeekSlot[]
}

function dayPanelClass(day: Date) {
  return cn(
    "day-panel",
    isToday(day) && "day-today",
    isPastDay(day) && "day-past"
  )
}

function hrefForWeek(iso: string) {
  return `/semaine/${iso}`
}

function slotKey(date: string, kind: SlotKind) {
  return `${date}:${kind}`
}

export function WeekBoard({
  weekStart,
  weeks,
  meals,
  personalMeals = [],
  familyMeals = [],
  isFamilyMode = false,
}: {
  weekStart: string
  weeks: WeekBlock[]
  meals: MealWithIngredients[]
  personalMeals?: MealWithIngredients[]
  familyMeals?: MealWithIngredients[]
  isFamilyMode?: boolean
}) {
  const router = useRouter()
  const visibleWeeks = weeks.filter((week) => parseISODate(week.start))
  const [slots, setSlotsOptimistic] = useOptimistic(
    visibleWeeks.flatMap((week) => week.slots),
    (
      state: WeekSlot[],
      update: {
        date: string
        kind: SlotKind
        meal: { id: string; name: string } | null
      }
    ) =>
      state.map((slot) =>
        slot.slot_date === update.date && slot.slot_kind === update.kind
          ? { ...slot, meal: update.meal }
          : slot
      )
  )
  const [, startTransition] = useTransition()
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [magicPlanOpen, setMagicPlanOpen] = useState(false)
  const [weekStartDialogOpen, setWeekStartDialogOpen] = useState(false)
  const [isChangingStartDay, setIsChangingStartDay] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const currentWeekDate = parseISODate(weekStart)
  const currentWeekDays = currentWeekDate ? weekDays(currentWeekDate).map(toISODate) : []

  async function handleConfirmClearWeek() {
    setIsClearing(true)
    try {
      startTransition(() => {
        for (const d of currentWeekDays) {
          for (const k of SLOTS) {
            setSlotsOptimistic({ date: d, kind: k, meal: null })
          }
        }
      })
      const result = await clearWeekSlotsAction(weekStart)
      toast.success(
        result.deletedCount > 0
          ? `${result.deletedCount} repas retiré${result.deletedCount > 1 ? "s" : ""} de la semaine`
          : "La semaine a été vidée"
      )
      setConfirmClearOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(actionErrorMessage(err))
    } finally {
      setIsClearing(false)
    }
  }
  function slotFor(date: string, kind: SlotKind) {
    return (
      slots.find((slot) => slot.slot_date === date && slot.slot_kind === kind) ??
      null
    )
  }

  const pickerSlot = picker ? slotFor(picker.date, picker.kind) : null
  const mobileWeek = visibleWeeks[0]

  return (
    <>
      <PageHeader
        title="Semaine"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="tap-press min-h-10 gap-1.5 rounded-xl border-line bg-surface text-xs font-semibold shadow-2xs hover:bg-muted"
                aria-label="Actions de la semaine"
              >
                <MoreHorizontal className="size-4" />
                <span>Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-lg border border-line bg-surface">
              <DropdownMenuItem
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer"
                onClick={() => setMagicPlanOpen(true)}
              >
                <Sparkles className="size-4 text-primary" />
                <span>Remplir avec l&apos;IA</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/pdf/semaine/${weekStart}`}
                  download={`myplanifia-${weekStart}.pdf`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer"
                >
                  <FileDown className="size-4 text-muted-foreground" />
                  <span>Télécharger le PDF</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer"
                onClick={() => setWeekStartDialogOpen(true)}
              >
                <CalendarDays className="size-4 text-primary" />
                <span>
                  Début de semaine ({WEEK_DAY_LABELS[(currentWeekDate?.getDay() ?? 1) as WeekStartDay] ?? "Lundi"})
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                onClick={() => setConfirmClearOpen(true)}
              >
                <Trash2 className="size-4 text-destructive" />
                <span>Vider la semaine</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="hidden px-8 pb-4 md:block">
        <WeekSwitcher weekStart={weekStart} hrefFor={hrefForWeek} />
      </div>

      <div className="sticky top-0 z-30 border-b border-line/80 bg-bg px-4 py-2 md:hidden shadow-2xs">
        <WeekSwitcher compact weekStart={weekStart} hrefFor={hrefForWeek} />
      </div>

      {mobileWeek ? (
        <div className="flex flex-col gap-4 px-4 py-4 md:hidden">
          <WeekDays
            weekStart={mobileWeek.start}
            slotFor={slotFor}
            onPick={setPicker}
            stacked
            active={picker}
            flash={flash}
          />
        </div>
      ) : null}

      <div className="hidden px-8 pb-8 md:block">
        {visibleWeeks.map((week, index) => {
          const monday = parseISODate(week.start)
          if (!monday) return null
          return (
            <section key={week.start} className={cn(index > 0 && "mt-10")}>
              {index > 0 ? (
                <h2 className="mb-4 font-fraunces text-lg leading-tight">
                  {weekLabel(monday)}
                </h2>
              ) : null}
              <WeekDays
                weekStart={week.start}
                slotFor={slotFor}
                onPick={setPicker}
                active={picker}
                flash={flash}
              />
            </section>
          )
        })}
      </div>

      {picker && pickerSlot ? (
        <MealPicker
          open
          onOpenChange={(open) => {
            if (!open) setPicker(null)
          }}
          date={picker.date}
          kind={picker.kind}
          currentMeal={pickerSlot.meal}
          meals={meals}
          personalMeals={personalMeals}
          familyMeals={familyMeals}
          weekSlots={slots}
          isFamilyMode={isFamilyMode}
          onAssign={(meal, source = "normal") => {
            const key = slotKey(picker.date, picker.kind)
            const kindLabel = SLOT_LABEL[picker.kind].toLowerCase()

            if (source === "reste" && meal) {
              startTransition(async () => {
                setSlotsOptimistic({
                  date: picker.date,
                  kind: picker.kind,
                  meal,
                })
                setFlash(key)
                window.setTimeout(() => {
                  setFlash((current) => (current === key ? null : current))
                }, 700)
                toast.success(`${meal.name} posé au ${kindLabel}`)
                try {
                  const result = await assignResteToSlot({
                    date: picker.date,
                    kind: picker.kind,
                    name: meal.name,
                  })
                  if (result.meal?.name) {
                    setSlotsOptimistic({
                      date: picker.date,
                      kind: picker.kind,
                      meal: { id: result.meal.id, name: result.meal.name },
                    })
                  }
                } catch (error) {
                  toast.error(actionErrorMessage(error))
                  throw error
                }
              })
              return
            }

            if (source === "family" && meal) {
              startTransition(async () => {
                setSlotsOptimistic({
                  date: picker.date,
                  kind: picker.kind,
                  meal,
                })
                setFlash(key)
                window.setTimeout(() => {
                  setFlash((current) => (current === key ? null : current))
                }, 700)
                toast.success("Plat importé dans vos recettes et ajouté au planning")
                try {
                  const result = await assignFamilyMealToSlot({
                    date: picker.date,
                    kind: picker.kind,
                    mealId: meal.id,
                  })
                  if (result.meal?.name) {
                    setSlotsOptimistic({
                      date: picker.date,
                      kind: picker.kind,
                      meal: { id: result.meal.id, name: result.meal.name },
                    })
                  }
                } catch (error) {
                  toast.error(actionErrorMessage(error))
                  throw error
                }
              })
              return
            }

            if (source === "personal" && meal) {
              startTransition(async () => {
                setSlotsOptimistic({
                  date: picker.date,
                  kind: picker.kind,
                  meal,
                })
                setFlash(key)
                window.setTimeout(() => {
                  setFlash((current) => (current === key ? null : current))
                }, 700)
                toast.success("Plat ajouté au planning et partagé avec la famille")
                try {
                  const result = await assignPersonalMealToSlot({
                    date: picker.date,
                    kind: picker.kind,
                    mealId: meal.id,
                  })
                  if (result.meal?.name) {
                    setSlotsOptimistic({
                      date: picker.date,
                      kind: picker.kind,
                      meal: { id: result.meal.id, name: result.meal.name },
                    })
                  }
                } catch (error) {
                  toast.error(actionErrorMessage(error))
                  throw error
                }
              })
              return
            }

            startTransition(async () => {
              setSlotsOptimistic({
                date: picker.date,
                kind: picker.kind,
                meal,
              })
              setFlash(key)
              window.setTimeout(() => {
                setFlash((current) => (current === key ? null : current))
              }, 700)
              toast.success(
                meal ? `${meal.name} posé au ${kindLabel}` : "Créneau vidé"
              )
              try {
                await setSlot({
                  date: picker.date,
                  kind: picker.kind,
                  mealId: meal?.id ?? null,
                })
              } catch (error) {
                toast.error(actionErrorMessage(error))
                throw error
              }
            })
          }}
        />
      ) : null}
      <MagicPlanDialog
        open={magicPlanOpen}
        onOpenChange={setMagicPlanOpen}
        slots={slots}
        meals={meals}
        weekStart={weekStart}
        onApplied={(applied) => {
          startTransition(() => {
            for (const item of applied) {
              setSlotsOptimistic({
                date: item.date,
                kind: item.kind,
                meal: item.meal,
              })
            }
          })
        }}
      />

      {/* Dialogue de choix du premier jour de la semaine */}
      <Dialog open={weekStartDialogOpen} onOpenChange={setWeekStartDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-fraunces text-lg">
              Commencement de la semaine
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choisissez le jour où démarre votre semainier.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1.5 py-2">
            {WEEK_DAY_OPTIONS.map((opt) => {
              const currentDayOfWeek = parseISODate(weekStart)?.getDay()
              const isSelected = currentDayOfWeek === opt.day
              return (
                <button
                  key={opt.day}
                  type="button"
                  disabled={isChangingStartDay}
                  onClick={async () => {
                    if (isSelected) {
                      setWeekStartDialogOpen(false)
                      return
                    }
                    setIsChangingStartDay(true)
                    try {
                      await setWeekStartDayAction(opt.day)
                      toast.success(`La semaine commence désormais le ${opt.label.toLowerCase()} matin`)
                      setWeekStartDialogOpen(false)
                      router.push("/semaine")
                    } catch (err) {
                      toast.error(actionErrorMessage(err))
                    } finally {
                      setIsChangingStartDay(false)
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all tap-press",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                      : "bg-surface hover:bg-muted text-ink border border-line/60"
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected ? <Check className="size-4 text-primary" /> : null}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression de la semaine */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-fraunces">
              Vider tous les plats de la semaine ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Cette action supprimera tous les plats planifiés pour cette semaine (
              {currentWeekDate ? weekLabel(currentWeekDate) : ""}). Les ingrédients associés seront également retirés de votre liste de courses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearWeek}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Suppression..." : "Vider la semaine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function WeekDays({
  weekStart,
  slotFor,
  onPick,
  stacked = false,
  active,
  flash,
}: {
  weekStart: string
  slotFor: (date: string, kind: SlotKind) => WeekSlot | null
  onPick: (target: PickerTarget) => void
  stacked?: boolean
  active: PickerTarget | null
  flash: string | null
}) {
  const monday = parseISODate(weekStart)
  const days = monday ? weekDays(monday) : []

  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-4"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3"
      }
    >
      {days.map((day) => {
        const iso = toISODate(day)
        return (
          <section key={iso} className={dayPanelClass(day)}>
            <DayHeading day={day} />
            <div className="flex flex-col gap-2">
              {SLOTS.map((kind) => {
                const slot = slotFor(iso, kind)
                return (
                  <SlotCard
                    key={kind}
                    label={SLOT_LABEL[kind]}
                    mealName={slot?.meal?.name ?? null}
                    past={isPastDay(day)}
                    selected={active?.date === iso && active.kind === kind}
                    flash={flash === slotKey(iso, kind)}
                    onClick={() => onPick({ date: iso, kind })}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DayHeading({ day }: { day: Date }) {
  const today = isToday(day)
  const past = isPastDay(day)
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-1 px-1">
      <h2
        className={cn(
          "day-heading font-fraunces text-sm sm:text-base font-bold capitalize tracking-tight truncate",
          today ? "text-mark font-extrabold" : "text-ink"
        )}
      >
        {day.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
        })}
      </h2>
      {today ? (
        <span className="shrink-0 rounded-full bg-mark px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-fg shadow-2xs">
          Aujourd’hui
        </span>
      ) : past ? (
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground/75">
          Passé
        </span>
      ) : null}
    </div>
  )
}
