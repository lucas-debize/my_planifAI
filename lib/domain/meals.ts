import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { displayName, normalizeName } from "@/lib/ingredients"

type Client = SupabaseClient<Database>

export type MealOrigin = "user" | "ai"

export type MealWithIngredients = {
  id: string
  name: string
  origin: MealOrigin
  ingredients: { id: string; name: string }[]
}

export function knownFromMeals(meals: MealWithIngredients[]) {
  const map = new Map<string, { id: string; name: string }>()
  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      map.set(ingredient.id, ingredient)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

type MealIngredientRow = {
  position: number
  ingredient: { id: string; name: string } | { id: string; name: string }[] | null
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapMeal(row: {
  id: string
  name: string
  origin: string
  meal_ingredients?: MealIngredientRow[] | null
}): MealWithIngredients {
  const origin: MealOrigin = row.origin === "ai" ? "ai" : "user"
  const ingredients = (row.meal_ingredients ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => asOne(item.ingredient))
    .filter((item): item is { id: string; name: string } => Boolean(item))
  return { id: row.id, name: row.name, origin, ingredients }
}

const MEAL_SELECT = `
  id,
  name,
  origin,
  meal_ingredients (
    position,
    ingredient:ingredients (
      id,
      name
    )
  )
`

export async function listMeals(
  supabase: Client,
  userId: string
): Promise<MealWithIngredients[]> {
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_SELECT)
    .eq("user_id", userId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map(mapMeal)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export async function getMeal(
  supabase: Client,
  userId: string,
  id: string
): Promise<MealWithIngredients | null> {
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_SELECT)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapMeal(data) : null
}

function uniqueIngredientNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const shown = displayName(raw)
    const normalized = normalizeName(shown)
    if (!normalized) continue
    if (normalized.length > 80) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(shown.slice(0, 80))
  }
  return result
}

async function replaceMealIngredients(
  supabase: Client,
  userId: string,
  mealId: string,
  ingredientNames: string[]
) {
  const names = uniqueIngredientNames(ingredientNames)

  const { error: deleteError } = await supabase
    .from("meal_ingredients")
    .delete()
    .eq("meal_id", mealId)
  if (deleteError) throw new Error(deleteError.message)

  if (names.length === 0) return

  const rows = names.map((name) => ({
    user_id: userId,
    name,
    name_normalized: normalizeName(name),
  }))

  const { error: upsertError } = await supabase
    .from("ingredients")
    .upsert(rows, {
      onConflict: "user_id,name_normalized",
      ignoreDuplicates: true,
    })
  if (upsertError) throw new Error(upsertError.message)

  const norms = names.map(normalizeName)
  const { data: ingredients, error: fetchError } = await supabase
    .from("ingredients")
    .select("id, name_normalized")
    .eq("user_id", userId)
    .in("name_normalized", norms)
  if (fetchError) throw new Error(fetchError.message)

  const byNorm = new Map(
    (ingredients ?? []).map((row) => [row.name_normalized, row.id])
  )

  const links = names.map((name, position) => {
    const ingredientId = byNorm.get(normalizeName(name))
    if (!ingredientId) {
      throw new Error("INGREDIENT_MISSING")
    }
    return {
      meal_id: mealId,
      ingredient_id: ingredientId,
      position,
    }
  })

  const { error: linkError } = await supabase
    .from("meal_ingredients")
    .insert(links)
  if (linkError) throw new Error(linkError.message)
}

export async function upsertMeal(
  supabase: Client,
  userId: string,
  input: {
    id?: string
    name: string
    ingredientNames: string[]
    origin?: MealOrigin
  }
): Promise<MealWithIngredients> {
  const name = displayName(input.name)
  if (!name) throw new Error("NAME_REQUIRED")
  if (name.length > 80) throw new Error("NAME_REQUIRED")

  let mealId = input.id

  if (mealId) {
    const existing = await getMeal(supabase, userId, mealId)
    if (!existing) throw new Error("MEAL_NOT_FOUND")
    const { error } = await supabase
      .from("meals")
      .update({ name })
      .eq("id", mealId)
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase
      .from("meals")
      .insert({
        user_id: userId,
        name,
        origin: input.origin ?? "user",
      })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "SAVE_FAILED")
    mealId = data.id
  }

  await replaceMealIngredients(supabase, userId, mealId, input.ingredientNames)
  const meal = await getMeal(supabase, userId, mealId)
  if (!meal) throw new Error("SAVE_FAILED")
  return meal
}

export async function deleteMeal(
  supabase: Client,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}
