"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { MealForm } from "@/components/meal-form"
import { setSlot } from "@/lib/actions/slots"
import { parseISODate, slotTitleDate } from "@/lib/dates"
import { SLOT_LABEL, type SlotKind } from "@/lib/week"
import type { MealWithIngredients } from "@/lib/domain/meals"
export function NewMealPage({
  initialName,
  date,
  kind,
  knownIngredients,
}: {
  initialName?: string
  date?: string
  kind?: string
  knownIngredients: { id: string; name: string }[]
}) {
  const router = useRouter()
  const isSlot = Boolean(date && (kind === "lunch" || kind === "dinner"))
  const slotKind = (kind === "lunch" || kind === "dinner" ? kind : null) as SlotKind | null
  const parsedDate = date ? parseISODate(date) : null
  const dateLabel = parsedDate ? slotTitleDate(parsedDate) : date
  const title = isSlot && slotKind
    ? `Nouvelle idée · ${SLOT_LABEL[slotKind]}`
    : "Nouvelle idée"

  async function onSaved(saved: MealWithIngredients) {
    if (isSlot && date && slotKind) {
      try {
        await setSlot({
          date,
          kind: slotKind,
          mealId: saved.id,
        })
        const kindLabel = SLOT_LABEL[slotKind].toLowerCase()
        toast.success(`${saved.name} posé au ${kindLabel}`)
        router.push("/semaine")
        return
      } catch {
        // continue to navigation fallback
      }
    }
    router.push("/idees")
  }
  return (
    <>
      <PageHeader
        title={title}
        backHref={isSlot ? "/semaine" : "/idees"}
        backLabel={isSlot ? "Retour au planning" : "Retour aux idées"}
      />
      <div className="px-4 pb-8 md:max-w-lg md:px-8">
        <MealForm
          initialName={initialName}
          knownIngredients={knownIngredients}
          submitLabel={isSlot ? "Ajouter au créneau" : "Enregistrer"}
          onCancel={() => router.push(isSlot ? "/semaine" : "/idees")}
          onSaved={onSaved}
        />
      </div>
    </>
  )
}
