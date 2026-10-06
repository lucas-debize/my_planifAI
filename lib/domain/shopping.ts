import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { getWeekSlots, type SlotScope } from "@/lib/domain/slots"
import { displayName, normalizeName } from "@/lib/ingredients"

type Client = SupabaseClient<Database>

export type ShopLine = {
  ingredientId: string
  name: string
  checked: boolean
  extra: boolean
}

export type ShoppingScope =
  | { type: "personal"; userId: string }
  | { type: "family"; familyId: string; userId: string }

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
  scope: ShoppingScope,
  weekStart: string
): Promise<Set<string>> {
  const slotScope: SlotScope =
    scope.type === "family"
      ? { type: "family", familyId: scope.familyId, userId: scope.userId }
      : { type: "personal", userId: scope.userId }

  const slots = await getWeekSlots(supabase, slotScope, weekStart)
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
  scope: ShoppingScope,
  rawName: string
): Promise<{ id: string; name: string }> {
  const name = displayName(rawName)
  if (!name) throw new Error("INGREDIENT_NAME_REQUIRED")
  if (name.length > 80) throw new Error("INGREDIENT_NAME_REQUIRED")
  const nameNormalized = normalizeName(name)

  const isFamily = scope.type === "family"
  let fetchQuery = supabase
    .from("ingredients")
    .select("id, name")
    .eq("name_normalized", nameNormalized)

  if (isFamily) {
    fetchQuery = fetchQuery.eq("family_id", scope.familyId)
  } else {
    fetchQuery = fetchQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data: existing } = await fetchQuery.maybeSingle()
  if (existing) return existing

  const { data: created, error: insertError } = await supabase
    .from("ingredients")
    .insert({
      user_id: scope.userId,
      family_id: isFamily ? scope.familyId : null,
      name,
      name_normalized: nameNormalized,
    })
    .select("id, name")
    .single()

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "INGREDIENT_NOT_FOUND")
  }
  return created
}

export async function listWeekIngredients(
  supabase: Client,
  scope: ShoppingScope,
  weekStart: string
): Promise<ShopLine[]> {
  const slotScope: SlotScope =
    scope.type === "family"
      ? { type: "family", familyId: scope.familyId, userId: scope.userId }
      : { type: "personal", userId: scope.userId }

  const slots = await getWeekSlots(supabase, slotScope, weekStart)
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
  const isFamily = scope.type === "family"

  let checkQuery = supabase
    .from("shopping_checks")
    .select("ingredient_id, checked")
    .eq("week_start", weekStart)

  if (isFamily) {
    checkQuery = checkQuery.eq("family_id", scope.familyId)
  } else {
    checkQuery = checkQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data: checks, error: checkError } = await checkQuery
  if (checkError) throw new Error(checkError.message)

  const checkedById = new Map(
    (checks ?? []).map((row) => [row.ingredient_id, row.checked])
  )

  const extraIds = [
    ...new Set(
      (checks ?? [])
        .map((row) => row.ingredient_id)
        .filter((id) => !plannedIds.has(id))
    ),
  ]

  if (extraIds.length > 0) {
    let extraQuery = supabase
      .from("ingredients")
      .select("id, name")
      .in("id", extraIds)

    if (isFamily) {
      extraQuery = extraQuery.eq("family_id", scope.familyId)
    } else {
      extraQuery = extraQuery.eq("user_id", scope.userId).is("family_id", null)
    }

    const { data: extras, error: extraError } = await extraQuery
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
  scope: ShoppingScope,
  input: { weekStart: string; ingredientId: string; checked: boolean }
): Promise<void> {
  const isFamily = scope.type === "family"

  let deleteQuery = supabase
    .from("shopping_checks")
    .delete()
    .eq("week_start", input.weekStart)
    .eq("ingredient_id", input.ingredientId)

  if (isFamily) {
    deleteQuery = deleteQuery.eq("family_id", scope.familyId)
  } else {
    deleteQuery = deleteQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { error: deleteError } = await deleteQuery
  if (deleteError) throw new Error(deleteError.message)

  const { error: insertError } = await supabase.from("shopping_checks").insert({
    family_id: isFamily ? scope.familyId : null,
    user_id: scope.userId,
    week_start: input.weekStart,
    ingredient_id: input.ingredientId,
    checked: input.checked,
  })

  if (insertError) throw new Error(insertError.message)
}

export async function renameShopItem(
  supabase: Client,
  scope: ShoppingScope,
  input: { ingredientId: string; name: string }
): Promise<{ name: string }> {
  const name = displayName(input.name)
  if (!name) throw new Error("INGREDIENT_NAME_REQUIRED")
  if (name.length > 80) throw new Error("INGREDIENT_NAME_REQUIRED")
  const nameNormalized = normalizeName(name)
  const isFamily = scope.type === "family"

  let currentQuery = supabase
    .from("ingredients")
    .select("id, name_normalized")
    .eq("id", input.ingredientId)

  if (isFamily) {
    currentQuery = currentQuery.eq("family_id", scope.familyId)
  } else {
    currentQuery = currentQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data: current, error: currentError } = await currentQuery.maybeSingle()
  if (currentError) throw new Error(currentError.message)
  if (!current) throw new Error("INGREDIENT_NOT_FOUND")

  if (current.name_normalized !== nameNormalized) {
    let clashQuery = supabase
      .from("ingredients")
      .select("id")
      .eq("name_normalized", nameNormalized)

    if (isFamily) {
      clashQuery = clashQuery.eq("family_id", scope.familyId)
    } else {
      clashQuery = clashQuery.eq("user_id", scope.userId).is("family_id", null)
    }

    const { data: clash, error: clashError } = await clashQuery.maybeSingle()
    if (clashError) throw new Error(clashError.message)
    if (clash) throw new Error("INGREDIENT_EXISTS")
  }

  let updateQuery = supabase
    .from("ingredients")
    .update({ name, name_normalized: nameNormalized })
    .eq("id", input.ingredientId)

  if (isFamily) {
    updateQuery = updateQuery.eq("family_id", scope.familyId)
  } else {
    updateQuery = updateQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { error } = await updateQuery
  if (error) throw new Error(error.message)
  return { name }
}

export async function addWeekItem(
  supabase: Client,
  scope: ShoppingScope,
  input: { weekStart: string; name: string }
): Promise<ShopLine> {
  const ingredient = await getOrCreateIngredient(supabase, scope, input.name)
  await toggleShopCheck(supabase, scope, {
    weekStart: input.weekStart,
    ingredientId: ingredient.id,
    checked: false,
  })
  const planned = await plannedIngredientIds(supabase, scope, input.weekStart)
  return {
    ingredientId: ingredient.id,
    name: ingredient.name,
    checked: false,
    extra: !planned.has(ingredient.id),
  }
}

export async function removeWeekItem(
  supabase: Client,
  scope: ShoppingScope,
  input: { weekStart: string; ingredientId: string }
): Promise<void> {
  const planned = await plannedIngredientIds(supabase, scope, input.weekStart)
  if (planned.has(input.ingredientId)) {
    throw new Error("INGREDIENT_FROM_MEAL")
  }

  const isFamily = scope.type === "family"
  let deleteQuery = supabase
    .from("shopping_checks")
    .delete()
    .eq("week_start", input.weekStart)
    .eq("ingredient_id", input.ingredientId)

  if (isFamily) {
    deleteQuery = deleteQuery.eq("family_id", scope.familyId)
  } else {
    deleteQuery = deleteQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
}
