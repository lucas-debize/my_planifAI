"use server"

import {
  copyWeek as copyWeekDomain,
  getWeekSlots as getWeekSlotsDomain,
  setSlot as setSlotDomain,
  type SlotScope,
  type WeekSlot,
} from "@/lib/domain/slots"
import { copyMeal, type MealScope, type MealWithIngredients } from "@/lib/domain/meals"
import type { SlotKind } from "@/lib/week"
import { requireScopedContext, revalidateApp } from "@/lib/actions/session"
import { getCurrentIdentity } from "@/lib/accounts/identity"

function toSlotScope(
  scope: { type: "personal" | "family"; familyId: string | null },
  authUid: string
): SlotScope {
  if (scope.type === "family" && scope.familyId) {
    return { type: "family", familyId: scope.familyId, userId: authUid }
  }
  return { type: "personal", userId: authUid }
}

export async function getWeekSlots(weekStart: string): Promise<WeekSlot[]> {
  const { supabase, authUid, scope } = await requireScopedContext()
  return getWeekSlotsDomain(supabase, toSlotScope(scope, authUid), weekStart)
}

export async function setSlot(input: {
  date: string
  kind: SlotKind
  mealId: string | null
}): Promise<void> {
  const { supabase, authUid, scope } = await requireScopedContext()
  await setSlotDomain(supabase, toSlotScope(scope, authUid), input)
  revalidateApp()
}

export async function copyWeek(input: {
  fromStart: string
  toStart: string
}): Promise<void> {
  const { supabase, authUid, scope } = await requireScopedContext()
  await copyWeekDomain(supabase, toSlotScope(scope, authUid), input)
  revalidateApp()
}

/**
 * Assigns a personal meal to a slot:
 * If in family mode, automatically imports the recipe into the family catalog
 * (resolving any name collisions with "(de Author)"), links ingredients, and
 * assigns the new family meal to the slot.
 */
export async function assignPersonalMealToSlot(input: {
  date: string
  kind: SlotKind
  mealId: string
}): Promise<{ meal: MealWithIngredients }> {
  const { supabase, authUid, scope } = await requireScopedContext()

  if (scope.type === "family" && scope.familyId) {
    const identity = await getCurrentIdentity()
    const authorName = identity?.name || identity?.email || "Membre"

    const targetScope: MealScope = {
      type: "family",
      familyId: scope.familyId,
      userId: authUid,
      authorName,
    }

    const familyMeal = await copyMeal(supabase, input.mealId, targetScope, authorName)
    await setSlotDomain(supabase, { type: "family", familyId: scope.familyId, userId: authUid }, {
      date: input.date,
      kind: input.kind,
      mealId: familyMeal.id,
    })
    revalidateApp()
    return { meal: familyMeal }
  }

  // Personal mode
  await setSlotDomain(supabase, { type: "personal", userId: authUid }, {
    date: input.date,
    kind: input.kind,
    mealId: input.mealId,
  })
  revalidateApp()
  return {
    meal: {
      id: input.mealId,
      name: "",
      origin: "user",
      ingredients: [],
    },
  }
}
