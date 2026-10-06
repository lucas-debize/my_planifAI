"use server"

import {
  setMultipleSlots as setMultipleSlotsDomain,
  type SlotScope,
} from "@/lib/domain/slots"
import { upsertMeal as upsertMealDomain, type MealScope } from "@/lib/domain/meals"
import type { SlotKind } from "@/lib/week"
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

  const { supabase, authUid, scope } = await requireScopedContext()
  const isFamily = scope.type === "family" && Boolean(scope.familyId)

  const slotScope: SlotScope = isFamily
    ? { type: "family", familyId: scope.familyId!, userId: authUid }
    : { type: "personal", userId: authUid }

  const mealScope: MealScope = isFamily
    ? { type: "family", familyId: scope.familyId!, userId: authUid }
    : { type: "personal", userId: authUid }

  const resolvedAssignments: {
    date: string
    kind: SlotKind
    mealId: string
    mealName: string
  }[] = []

  for (const item of assignments) {
    let mealId = item.meal.id

    // Si c'est une suggestion IA sans ID, créer le plat et ses ingrédients dans l'espace actif
    if (!mealId) {
      const created = await upsertMealDomain(supabase, mealScope, {
        name: item.meal.name,
        ingredientNames: item.meal.ingredients,
        origin: "ai",
      })
      mealId = created.id
    }

    resolvedAssignments.push({
      date: item.date,
      kind: item.kind,
      mealId,
      mealName: item.meal.name,
    })
  }

  // Enregistrement des créneaux en base
  await setMultipleSlotsDomain(
    supabase,
    slotScope,
    resolvedAssignments.map((a) => ({
      date: a.date,
      kind: a.kind,
      mealId: a.mealId,
    }))
  )

  await revalidateApp()

  return {
    count: resolvedAssignments.length,
    slots: resolvedAssignments.map((a) => ({
      date: a.date,
      kind: a.kind,
      meal: { id: a.mealId, name: a.mealName },
    })),
  }
}
