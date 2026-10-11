"use server"

import {
  deleteMeal as deleteMealDomain,
  getMeal as getMealDomain,
  listMeals as listMealsDomain,
  listPersonalMeals as listPersonalMealsDomain,
  upsertMeal as upsertMealDomain,
  copyMeal as copyMealDomain,
  type MealScope,
  type MealWithIngredients,
  type UpsertMealIngredientInput,
} from "@/lib/domain/meals"
import { requireScopedContext, revalidateApp } from "@/lib/actions/session"
import { getCurrentIdentity } from "@/lib/accounts/identity"
import { getMyFamily } from "@/lib/domain/families"

function toMealScope(
  scope: { type: "personal" | "family"; familyId: string | null },
  authUid: string
): MealScope {
  if (scope.type === "family" && scope.familyId) {
    return { type: "family", familyId: scope.familyId, userId: authUid }
  }
  return { type: "personal", userId: authUid }
}

export async function listMeals(): Promise<MealWithIngredients[]> {
  const { supabase, authUid, scope } = await requireScopedContext()
  return listMealsDomain(supabase, toMealScope(scope, authUid))
}

export async function listPersonalMeals(): Promise<MealWithIngredients[]> {
  const { supabase, authUid } = await requireScopedContext()
  return listPersonalMealsDomain(supabase, authUid)
}

export async function listFamilyMeals(): Promise<MealWithIngredients[]> {
  const { supabase, authUid } = await requireScopedContext()
  const familyInfo = await getMyFamily(supabase, authUid)
  if (!familyInfo) return []
  return listMealsDomain(supabase, {
    type: "family",
    familyId: familyInfo.family.id,
    userId: authUid,
  })
}

export async function getMeal(id: string): Promise<MealWithIngredients | null> {
  const { supabase, authUid, scope } = await requireScopedContext()
  return getMealDomain(supabase, toMealScope(scope, authUid), id)
}

export async function upsertMeal(input: {
  id?: string
  name: string
  ingredientNames: UpsertMealIngredientInput[]
}): Promise<MealWithIngredients> {
  const { supabase, authUid, scope } = await requireScopedContext()
  const meal = await upsertMealDomain(supabase, toMealScope(scope, authUid), {
    ...input,
    origin: "user",
  })
  revalidateApp()
  return meal
}

export async function batchCreateMealsAction(
  meals: { name: string; ingredientNames: UpsertMealIngredientInput[] }[]
): Promise<MealWithIngredients[]> {
  if (meals.length === 0) return []
  const { supabase, authUid, scope } = await requireScopedContext()
  const mealScope = toMealScope(scope, authUid)

  const createdMeals: MealWithIngredients[] = []
  for (const item of meals) {
    const meal = await upsertMealDomain(supabase, mealScope, {
      name: item.name,
      ingredientNames: item.ingredientNames,
      origin: "ai",
    })
    createdMeals.push(meal)
  }

  revalidateApp()
  return createdMeals
}

export async function deleteMeal(id: string): Promise<void> {
  const { supabase, authUid, scope } = await requireScopedContext()
  await deleteMealDomain(supabase, toMealScope(scope, authUid), id)
  revalidateApp()
}

export async function copyMealAction(input: {
  mealId: string
  target: "family" | "personal"
}): Promise<MealWithIngredients> {
  const { supabase, authUid, scope } = await requireScopedContext()
  if (input.target === "family" && (!scope.familyId || scope.type !== "family")) {
    throw new Error("Aucun groupe familial actif")
  }

  const identity = await getCurrentIdentity()
  const authorName = identity?.name || identity?.email || "Membre"

  const targetScope: MealScope =
    input.target === "family"
      ? { type: "family", familyId: scope.familyId!, userId: authUid, authorName }
      : { type: "personal", userId: authUid }

  const meal = await copyMealDomain(
    supabase,
    input.mealId,
    targetScope,
    authorName
  )
  revalidateApp()
  return meal
}

export async function importPersonalMealsAction(input: {
  mealIds: string[]
}): Promise<MealWithIngredients[]> {
  const { supabase, authUid, scope } = await requireScopedContext()
  if (!scope.familyId) {
    throw new Error("Aucun groupe familial actif")
  }

  const identity = await getCurrentIdentity()
  const authorName = identity?.name || identity?.email || "Membre"
  const targetScope: MealScope = {
    type: "family",
    familyId: scope.familyId,
    userId: authUid,
    authorName,
  }

  const imported: MealWithIngredients[] = []
  for (const mealId of input.mealIds) {
    const meal = await copyMealDomain(supabase, mealId, targetScope, authorName)
    imported.push(meal)
  }

  revalidateApp()
  return imported
}

export async function importFamilyMealsAction(input: {
  mealIds: string[]
}): Promise<MealWithIngredients[]> {
  const { supabase, authUid } = await requireScopedContext()
  const identity = await getCurrentIdentity()
  const authorName = identity?.name || identity?.email || "Personnel"
  const targetScope: MealScope = {
    type: "personal",
    userId: authUid,
  }

  const imported: MealWithIngredients[] = []
  for (const mealId of input.mealIds) {
    const meal = await copyMealDomain(supabase, mealId, targetScope, authorName)
    imported.push(meal)
  }

  revalidateApp()
  return imported
}
