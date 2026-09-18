"use server"

import {
  deleteMeal as deleteMealDomain,
  getMeal as getMealDomain,
  listMeals as listMealsDomain,
  upsertMeal as upsertMealDomain,
  type MealWithIngredients,
} from "@/lib/domain/meals"
import { requireUser, revalidateApp } from "@/lib/actions/session"

export async function listMeals(): Promise<MealWithIngredients[]> {
  const { supabase, userId } = await requireUser()
  return listMealsDomain(supabase, userId)
}

export async function getMeal(id: string): Promise<MealWithIngredients | null> {
  const { supabase, userId } = await requireUser()
  return getMealDomain(supabase, userId, id)
}

export async function upsertMeal(input: {
  id?: string
  name: string
  ingredientNames: string[]
}): Promise<MealWithIngredients> {
  const { supabase, userId } = await requireUser()
  const meal = await upsertMealDomain(supabase, userId, {
    ...input,
    origin: "user",
  })
  revalidateApp()
  return meal
}

export async function deleteMeal(id: string): Promise<void> {
  const { supabase, userId } = await requireUser()
  await deleteMealDomain(supabase, userId, id)
  revalidateApp()
}
