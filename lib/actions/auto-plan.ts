"use server"

import {
  setMultipleSlots as setMultipleSlotsDomain,
  type SlotScope,
} from "@/lib/domain/slots"
import { createMeals, type MealScope } from "@/lib/domain/meals"
import { parseISODate } from "@/lib/dates"
import { displayName } from "@/lib/ingredients"
import { SLOTS, type SlotKind } from "@/lib/week"
import { requireScopedContext, revalidateApp } from "@/lib/actions/session"

export type AutoPlanAssignment = {
  date: string
  kind: SlotKind
  meal: {
    id?: string
    name: string
    ingredients: string[]
    origin: "catalog" | "ai"
  }
}

export type AutoPlanResult = {
  count: number
  slots: {
    date: string
    kind: SlotKind
    meal: { id: string; name: string }
  }[]
}

/**
 * Enregistre en bloc une sélection de créneaux générés par l'IA ou choisis dans le carnet.
 * Crée automatiquement les nouveaux plats avec leurs ingrédients dans l'espace actif (perso ou famille).
 */
export async function applyAutoPlanAction(
  assignments: AutoPlanAssignment[]
): Promise<AutoPlanResult> {
  if (assignments.length === 0) {
    return { count: 0, slots: [] }
  }

  const selectedByKey = new Map<string, AutoPlanAssignment>()
  for (const item of assignments) {
    if (!parseISODate(item.date)) throw new Error("INVALID_DATE")
    if (!SLOTS.includes(item.kind)) throw new Error("INVALID_SLOT_KIND")
    selectedByKey.set(`${item.date}:${item.kind}`, item)
  }
  const selected = [...selectedByKey.values()]
  const fresh = selected.filter((item) => !item.meal.id)
  for (const item of fresh) {
    const name = displayName(item.meal.name)
    if (!name || name.length > 80) throw new Error("NAME_REQUIRED")
  }

  const { supabase, authUid, scope } = await requireScopedContext()
  const isFamily = scope.type === "family" && Boolean(scope.familyId)

  const slotScope: SlotScope = isFamily
    ? { type: "family", familyId: scope.familyId!, userId: authUid }
    : { type: "personal", userId: authUid }

  const mealScope: MealScope = isFamily
    ? { type: "family", familyId: scope.familyId!, userId: authUid }
    : { type: "personal", userId: authUid }

  const created = await createMeals(
    supabase,
    mealScope,
    fresh.map((item) => ({
      name: item.meal.name,
      ingredientNames: item.meal.ingredients,
      origin: "ai",
    }))
  )
  const resolved: AutoPlanResult["slots"] = []
  let createdIndex = 0

  for (const item of selected) {
    const meal = item.meal.id
      ? { id: item.meal.id, name: item.meal.name }
      : created[createdIndex++]
    if (!meal) throw new Error("SAVE_FAILED")
    resolved.push({
      date: item.date,
      kind: item.kind,
      meal: { id: meal.id, name: meal.name },
    })
  }

  await setMultipleSlotsDomain(
    supabase,
    slotScope,
    resolved.map((item) => ({
      date: item.date,
      kind: item.kind,
      mealId: item.meal.id,
    }))
  )

  await revalidateApp()

  return {
    count: resolved.length,
    slots: resolved,
  }
}
