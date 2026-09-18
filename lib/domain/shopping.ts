import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { getWeekSlots } from "@/lib/domain/slots"
import { displayName, normalizeName } from "@/lib/ingredients"

type Client = SupabaseClient<Database>

export type ShopLine = {
  ingredientId: string
  name: string
  checked: boolean
  extra: boolean
}

function asIngredient(
  value:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
    | undefined
): { id: string; name: string } | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

async function plannedIngredientIds(
  supabase: Client,
  userId: string,
  weekStart: string
): Promise<Set<string>> {
  const slots = await getWeekSlots(supabase, userId, weekStart)
  const mealIds = [
    ...new Set(
      slots.map((slot) => slot.meal?.id).filter((id): id is string => Boolean(id))
    ),
  ]
  if (mealIds.length === 0) return new Set()

  const { data: links, error } = await supabase
    .from("meal_ingredients")
    .select("ingredient:ingredients(id, name)")
    .in("meal_id", mealIds)
  if (error) throw new Error(error.message)

  const ids = new Set<string>()
  for (const row of links ?? []) {
    const ingredient = asIngredient(row.ingredient)
    if (ingredient) ids.add(ingredient.id)
  }
  return ids
}

async function getOrCreateIngredient(
  supabase: Client,
  userId: string,
  rawName: string
): Promise<{ id: string; name: string }> {
  const name = displayName(rawName)
  if (!name) throw new Error("INGREDIENT_NAME_REQUIRED")
  if (name.length > 80) throw new Error("INGREDIENT_NAME_REQUIRED")
  const nameNormalized = normalizeName(name)

  const { error: upsertError } = await supabase.from("ingredients").upsert(
    {
      user_id: userId,
      name,
      name_normalized: nameNormalized,
    },
    { onConflict: "user_id,name_normalized", ignoreDuplicates: true }
  )
  if (upsertError) throw new Error(upsertError.message)

  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name_normalized", nameNormalized)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message ?? "INGREDIENT_NOT_FOUND")
  return data
}

export async function listWeekIngredients(
  supabase: Client,
  userId: string,
  weekStart: string
): Promise<ShopLine[]> {
  const slots = await getWeekSlots(supabase, userId, weekStart)
  const mealIds = [
    ...new Set(
      slots.map((slot) => slot.meal?.id).filter((id): id is string => Boolean(id))
    ),
  ]

  const unique = new Map<string, string>()
  if (mealIds.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from("meal_ingredients")
      .select("ingredient:ingredients(id, name)")
      .in("meal_id", mealIds)
    if (linkError) throw new Error(linkError.message)

    for (const row of links ?? []) {
      const ingredient = asIngredient(row.ingredient)
      if (!ingredient) continue
      if (!unique.has(ingredient.id)) {
        unique.set(ingredient.id, ingredient.name)
      }
    }
  }

  const plannedIds = new Set(unique.keys())

  const { data: checks, error: checkError } = await supabase
    .from("shopping_checks")
    .select("ingredient_id, checked")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
  if (checkError) throw new Error(checkError.message)

  const checkedById = new Map(
    (checks ?? []).map((row) => [row.ingredient_id, row.checked])
  )

  const extraIds = [...new Set(
    (checks ?? [])
      .map((row) => row.ingredient_id)
      .filter((id) => !plannedIds.has(id))
  )]

  if (extraIds.length > 0) {
    const { data: extras, error: extraError } = await supabase
      .from("ingredients")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", extraIds)
    if (extraError) throw new Error(extraError.message)
    for (const row of extras ?? []) {
      unique.set(row.id, row.name)
    }
  }

  return [...unique.entries()]
    .map(([ingredientId, name]) => ({
      ingredientId,
      name,
      checked: checkedById.get(ingredientId) ?? false,
      extra: !plannedIds.has(ingredientId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export async function toggleShopCheck(
  supabase: Client,
  userId: string,
  input: { weekStart: string; ingredientId: string; checked: boolean }
): Promise<void> {
  const { error } = await supabase.from("shopping_checks").upsert(
    {
      user_id: userId,
      week_start: input.weekStart,
      ingredient_id: input.ingredientId,
      checked: input.checked,
    },
    { onConflict: "user_id,week_start,ingredient_id" }
  )
  if (error) throw new Error(error.message)
}

export async function renameShopItem(
  supabase: Client,
  userId: string,
  input: { ingredientId: string; name: string }
): Promise<{ name: string }> {
  const name = displayName(input.name)
  if (!name) throw new Error("INGREDIENT_NAME_REQUIRED")
  if (name.length > 80) throw new Error("INGREDIENT_NAME_REQUIRED")
  const nameNormalized = normalizeName(name)

  const { data: current, error: currentError } = await supabase
    .from("ingredients")
    .select("id, name_normalized")
    .eq("user_id", userId)
    .eq("id", input.ingredientId)
    .maybeSingle()
  if (currentError) throw new Error(currentError.message)
  if (!current) throw new Error("INGREDIENT_NOT_FOUND")

  if (current.name_normalized !== nameNormalized) {
    const { data: clash, error: clashError } = await supabase
      .from("ingredients")
      .select("id")
      .eq("user_id", userId)
      .eq("name_normalized", nameNormalized)
      .maybeSingle()
    if (clashError) throw new Error(clashError.message)
    if (clash) throw new Error("INGREDIENT_EXISTS")
  }

  const { error } = await supabase
    .from("ingredients")
    .update({ name, name_normalized: nameNormalized })
    .eq("id", input.ingredientId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
  return { name }
}

export async function addWeekItem(
  supabase: Client,
  userId: string,
  input: { weekStart: string; name: string }
): Promise<ShopLine> {
  const ingredient = await getOrCreateIngredient(supabase, userId, input.name)
  await toggleShopCheck(supabase, userId, {
    weekStart: input.weekStart,
    ingredientId: ingredient.id,
    checked: false,
  })
  const planned = await plannedIngredientIds(supabase, userId, input.weekStart)
  return {
    ingredientId: ingredient.id,
    name: ingredient.name,
    checked: false,
    extra: !planned.has(ingredient.id),
  }
}

export async function removeWeekItem(
  supabase: Client,
  userId: string,
  input: { weekStart: string; ingredientId: string }
): Promise<void> {
  const planned = await plannedIngredientIds(supabase, userId, input.weekStart)
  if (planned.has(input.ingredientId)) {
    throw new Error("INGREDIENT_FROM_MEAL")
  }
  const { error } = await supabase
    .from("shopping_checks")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", input.weekStart)
    .eq("ingredient_id", input.ingredientId)
  if (error) throw new Error(error.message)
}
