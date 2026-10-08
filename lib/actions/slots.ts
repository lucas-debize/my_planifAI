"use server"

import {
  copyWeek as copyWeekDomain,
  getWeekSlots as getWeekSlotsDomain,
  setSlot as setSlotDomain,
  type SlotScope,
  type WeekSlot,
} from "@/lib/domain/slots"
import {
  copyMeal,
  upsertMeal as upsertMealDomain,
  type MealScope,
  type MealWithIngredients,
} from "@/lib/domain/meals"
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

/**
 * Assigns a family meal to a personal slot:
 * Automatically imports the recipe into the user's personal catalog
 * and assigns the new personal meal to the slot.
 */
export async function assignFamilyMealToSlot(input: {
  date: string
  kind: SlotKind
  mealId: string
}): Promise<{ meal: MealWithIngredients }> {
  const { supabase, authUid, scope } = await requireScopedContext()

  if (scope.type === "personal") {
    const identity = await getCurrentIdentity()
    const authorName = identity?.name || identity?.email || "Membre"

    const targetScope: MealScope = {
      type: "personal",
      userId: authUid,
    }

    const personalMeal = await copyMeal(supabase, input.mealId, targetScope, authorName)
    await setSlotDomain(
      supabase,
      { type: "personal", userId: authUid },
      {
        date: input.date,
        kind: input.kind,
        mealId: personalMeal.id,
      }
    )
    revalidateApp()
    return { meal: personalMeal }
  }

  // Family mode
  await setSlotDomain(
    supabase,
    toSlotScope(scope, authUid),
    {
      date: input.date,
      kind: input.kind,
      mealId: input.mealId,
    }
  )
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

/**
 * Creates or reuses a "Reste" meal with 0 ingredients and assigns it to a slot.
 * Prevents any extra ingredients from being added to the shopping list.
 */
export async function assignResteToSlot(input: {
  date: string
  kind: SlotKind
  name: string
}): Promise<{ meal: MealWithIngredients }> {
  const { supabase, authUid, scope } = await requireScopedContext()
  const slotScope = toSlotScope(scope, authUid)
  const mealScope: MealScope =
    scope.type === "family" && scope.familyId
      ? { type: "family", familyId: scope.familyId, userId: authUid }
      : { type: "personal", userId: authUid }

  const cleanName = input.name.trim() || "Reste de repas"
  const resteMeal = await upsertMealDomain(supabase, mealScope, {
    name: cleanName,
    ingredientNames: [],
    origin: "user",
  })

  await setSlotDomain(supabase, slotScope, {
    date: input.date,
    kind: input.kind,
    mealId: resteMeal.id,
  })

  revalidateApp()
  return { meal: resteMeal }
}
