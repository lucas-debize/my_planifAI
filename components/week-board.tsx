"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { MealPicker } from "@/components/meal-picker"
import { MagicPlanDialog } from "@/components/magic-plan-dialog"
import { Button } from "@/components/ui/button"
import { DownloadPdfButton } from "@/components/download-pdf-button"
import { SlotCard } from "@/components/slot-card"
import { WeekSwitcher } from "@/components/week-switcher"
import { PageHeader } from "@/components/page-header"
import { setSlot, assignPersonalMealToSlot } from "@/lib/actions/slots"
import { actionErrorMessage } from "@/lib/errors"
import {
  isPastDay,
  isToday,
  parseISODate,
  toISODate,
  weekDays,
  weekLabel,
} from "@/lib/dates"
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
  isFamilyMode = false,
}: {
  weekStart: string
  weeks: WeekBlock[]
  meals: MealWithIngredients[]
  personalMeals?: MealWithIngredients[]
  isFamilyMode?: boolean
}) {
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-1.5 text-xs font-medium text-primary hover:text-primary"
              onClick={() => setMagicPlanOpen(true)}
            >
              <Sparkles className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Remplir avec l&apos;IA</span>
              <span className="sm:hidden">Magic Fill</span>
            </Button>
            <DownloadPdfButton weekStart={weekStart} />
          </div>
        }
      />
      <div className="hidden px-8 pb-4 md:block">
        <WeekSwitcher weekStart={weekStart} hrefFor={hrefForWeek} />
      </div>

      <div className="sticky top-0 z-30 border-b border-line bg-bg px-3 py-2 md:hidden">
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
          isFamilyMode={isFamilyMode}
          onAssign={(meal, fromPersonal) => {
            const key = slotKey(picker.date, picker.kind)
            const kindLabel = SLOT_LABEL[picker.kind].toLowerCase()

            if (fromPersonal && meal) {
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
    <div className="mb-2 flex min-h-10 flex-col gap-1 px-1">
      <h2 className="day-heading font-source text-sm capitalize leading-tight md:text-base">
        {day.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </h2>
      {today ? (
        <span className="w-fit rounded-full bg-mark px-2 py-0.5 text-[11px] font-medium text-accent-fg">
          Aujourd’hui
        </span>
      ) : past ? (
        <span className="w-fit text-[11px] font-medium text-muted-foreground">
          Passé
        </span>
      ) : null}
    </div>
  )
}
