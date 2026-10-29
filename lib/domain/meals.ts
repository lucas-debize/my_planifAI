import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { displayName, normalizeName } from "@/lib/ingredients"
import { cleanIngredientName, extractIngredientQuantity } from "@/lib/ai/recipe-extractor"

type Client = SupabaseClient<Database>

export type MealOrigin = "user" | "ai"

export type MealIngredientItem = {
  id: string
  name: string
  quantity?: string | null
}

export type MealWithIngredients = {
  id: string
  name: string
  origin: MealOrigin
  ingredients: MealIngredientItem[]
  familyId?: string | null
  createdByUserId?: string | null
  createdByName?: string | null
}

export type UpsertMealIngredientInput =
  | string
  | { name: string; quantity?: string | null }

export type NewMealInput = {
  name: string
  ingredientNames: UpsertMealIngredientInput[]
  origin?: MealOrigin
}

export type MealRef = { id: string; name: string }

export type MealScope =
  | { type: "personal"; userId: string }
  | { type: "family"; familyId: string; userId: string; authorName?: string }

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
  quantity?: string | null
  ingredient: { id: string; name: string } | { id: string; name: string }[] | null
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapMeal(
  row: {
    id: string
    name: string
    origin: string
    family_id?: string | null
    created_by_user_id?: string | null
    meal_ingredients?: MealIngredientRow[] | null
  },
  memberNamesById?: Map<string, string>
): MealWithIngredients {
  const origin: MealOrigin = row.origin === "ai" ? "ai" : "user"
  const ingredients: MealIngredientItem[] = []
  for (const item of (row.meal_ingredients ?? []).slice().sort((a, b) => a.position - b.position)) {
    const ing = asOne(item.ingredient)
    if (ing) {
      ingredients.push({
        id: ing.id,
        name: ing.name,
        quantity: item.quantity ?? null,
      })
    }
  }
  return {
    id: row.id,
    name: row.name,
    origin,
    ingredients,
    familyId: row.family_id ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    createdByName: row.created_by_user_id
      ? memberNamesById?.get(row.created_by_user_id) ?? null
      : null,
  }
}

const MEAL_SELECT = `
  id,
  name,
  origin,
  family_id,
  created_by_user_id,
  meal_ingredients (
    position,
    quantity,
    ingredient:ingredients (
      id,
      name
    )
  )
`

const MEAL_SELECT_LEGACY = `
  id,
  name,
  origin,
  family_id,
  created_by_user_id,
  meal_ingredients (
    position,
    ingredient:ingredients (
      id,
      name
    )
  )
`

export function resolveMealCopyName(
  originalName: string,
  authorName: string,
  existingNames: string[],
  target: "family" | "personal"
): string {
  const cleanOriginal = originalName.trim()
  const exists = (candidate: string) => {
    const norm = candidate.trim().toLowerCase()
    return existingNames.some((e) => e.trim().toLowerCase() === norm)
  }

  if (!exists(cleanOriginal)) {
    return cleanOriginal
  }

  if (target === "family") {
    const author = authorName.trim() || "Membre"
    const firstCandidate = `${cleanOriginal} (de ${author})`
    if (!exists(firstCandidate)) {
      return firstCandidate
    }
    let count = 2
    while (true) {
      const candidate = `${cleanOriginal} (de ${author} ${count})`
      if (!exists(candidate)) {
        return candidate
      }
      count += 1
    }
  }

  let count = 2
  while (true) {
    const candidate = `${cleanOriginal} (${count})`
    if (!exists(candidate)) {
      return candidate
    }
    count += 1
  }
}

export async function listMeals(
  supabase: Client,
  scope: MealScope
): Promise<MealWithIngredients[]> {
  let query = supabase.from("meals").select(MEAL_SELECT)

  let memberNamesById: Map<string, string> | undefined
  let data: Awaited<typeof query>["data"] = null
  let error: Awaited<typeof query>["error"] = null
  if (scope.type === "family") {
    query = query.eq("family_id", scope.familyId)
    const [membersRes, mealsRes] = await Promise.all([
      supabase
        .from("family_members")
        .select("user_id, display_name")
        .eq("family_id", scope.familyId),
      query,
    ])
    memberNamesById = new Map<string, string>(
      (membersRes.data ?? []).map((m) => [m.user_id, m.display_name || "Membre"])
    )
    data = mealsRes.data
    error = mealsRes.error
  } else {
    query = query.eq("user_id", scope.userId).is("family_id", null)
    const mealsRes = await query
    data = mealsRes.data
    error = mealsRes.error
  }
  if (error && /quantity/i.test(error.message)) {
    let legacyQuery = supabase.from("meals").select(MEAL_SELECT_LEGACY)
    if (scope.type === "family") {
      legacyQuery = legacyQuery.eq("family_id", scope.familyId)
    } else {
      legacyQuery = legacyQuery.eq("user_id", scope.userId).is("family_id", null)
    }
    const res = await legacyQuery
    data = res.data as unknown as typeof data
    error = res.error
  }
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => mapMeal(row, memberNamesById))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export async function listPersonalMeals(
  supabase: Client,
  userId: string
): Promise<MealWithIngredients[]> {
  let { data, error } = await supabase
    .from("meals")
    .select(MEAL_SELECT)
    .eq("user_id", userId)
    .is("family_id", null)

  if (error && /quantity/i.test(error.message)) {
    const res = await supabase
      .from("meals")
      .select(MEAL_SELECT_LEGACY)
      .eq("user_id", userId)
      .is("family_id", null)
    data = res.data as unknown as typeof data
    error = res.error
  }

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => mapMeal(row))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export async function getMeal(
  supabase: Client,
  scope: MealScope,
  id: string
): Promise<MealWithIngredients | null> {
  let query = supabase.from("meals").select(MEAL_SELECT).eq("id", id)
  let memberNamesById: Map<string, string> | undefined

  if (scope.type === "family") {
    query = query.eq("family_id", scope.familyId)
    const { data: members } = await supabase
      .from("family_members")
      .select("user_id, display_name")
      .eq("family_id", scope.familyId)
    memberNamesById = new Map<string, string>(
      (members ?? []).map((m) => [m.user_id, m.display_name || "Membre"])
    )
  } else {
    query = query.eq("user_id", scope.userId).is("family_id", null)
  }

  let { data, error } = await query.maybeSingle()
  if (error && /quantity/i.test(error.message)) {
    let legacyQuery = supabase.from("meals").select(MEAL_SELECT_LEGACY).eq("id", id)
    if (scope.type === "family") {
      legacyQuery = legacyQuery.eq("family_id", scope.familyId)
    } else {
      legacyQuery = legacyQuery.eq("user_id", scope.userId).is("family_id", null)
    }
    const res = await legacyQuery.maybeSingle()
    data = res.data as unknown as typeof data
    error = res.error
  }
  if (error) throw new Error(error.message)
  return data ? mapMeal(data, memberNamesById) : null
}

function normalizeIngredientInputs(
  inputs: UpsertMealIngredientInput[]
): { name: string; quantity: string | null }[] {
  const seen = new Set<string>()
  const result: { name: string; quantity: string | null }[] = []

  for (const item of inputs) {
    let rawName: string
    let rawQuantity: string | null = null

    if (typeof item === "string") {
      const cleaned = cleanIngredientName(item)
      rawName = cleaned || item
      rawQuantity = extractIngredientQuantity(item) ?? null
    } else {
      rawName = item.name
      rawQuantity = item.quantity?.trim() || null
    }

    const shown = displayName(rawName)
    const normalized = normalizeName(shown)
    if (!normalized || normalized.length > 80) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push({
      name: shown.slice(0, 80),
      quantity: rawQuantity ? rawQuantity.slice(0, 40) : null,
    })
  }
  return result
}

export async function createMeals(
  supabase: Client,
  scope: MealScope,
  inputs: readonly NewMealInput[]
): Promise<MealRef[]> {
  const distinct = new Map<
    string,
    {
      id: string
      name: string
      origin: MealOrigin
      ingredients: { name: string; quantity: string | null }[]
    }
  >()
  const ordered = inputs.map((input) => {
    const name = displayName(input.name)
    if (!name || name.length > 80) throw new Error("NAME_REQUIRED")
    const origin = input.origin ?? "user"
    const ingredients = normalizeIngredientInputs(input.ingredientNames)
    const key = JSON.stringify([
      normalizeName(name),
      origin,
      ingredients.map((item) => [normalizeName(item.name), item.quantity]),
    ])
    const existing = distinct.get(key)
    if (existing) return existing
    const meal = { id: crypto.randomUUID(), name, origin, ingredients }
    distinct.set(key, meal)
    return meal
  })
  if (ordered.length === 0) return []

  const namesByNorm = new Map<string, string>()
  for (const meal of distinct.values()) {
    for (const item of meal.ingredients) {
      const norm = normalizeName(item.name)
      if (!namesByNorm.has(norm)) namesByNorm.set(norm, item.name)
    }
  }

  const ingredientIds = new Map<string, string>()
  const fetchIngredients = async (norms: string[]) => {
    let query = supabase
      .from("ingredients")
      .select("id, name_normalized")
      .in("name_normalized", norms)
    if (scope.type === "family") {
      query = query.eq("family_id", scope.familyId)
    } else {
      query = query.eq("user_id", scope.userId).is("family_id", null)
    }
    const { data, error } = await query
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      ingredientIds.set(row.name_normalized, row.id)
    }
  }

  if (namesByNorm.size > 0) {
    await fetchIngredients([...namesByNorm.keys()])
    let missing = [...namesByNorm].filter(([norm]) => !ingredientIds.has(norm))
    while (missing.length > 0) {
      const { data, error } = await supabase
        .from("ingredients")
        .insert(missing.map(([norm, name]) => ({
          user_id: scope.userId,
          family_id: scope.type === "family" ? scope.familyId : null,
          name,
          name_normalized: norm,
        })))
        .select("id, name_normalized")
      if (error) {
        if (error.code !== "23505" && !error.message.toLowerCase().includes("unique")) {
          throw new Error(error.message)
        }
        const previousSize = ingredientIds.size
        await fetchIngredients(missing.map(([norm]) => norm))
        if (ingredientIds.size <= previousSize) throw new Error(error.message)
      } else {
        for (const row of data ?? []) {
          ingredientIds.set(row.name_normalized, row.id)
        }
        if (missing.some(([norm]) => !ingredientIds.has(norm))) {
          throw new Error("INGREDIENT_NOT_FOUND")
        }
      }
      missing = missing.filter(([norm]) => !ingredientIds.has(norm))
    }
  }

  const { error: mealError } = await supabase.from("meals").insert(
    [...distinct.values()].map((meal) => ({
      id: meal.id,
      user_id: scope.userId,
      family_id: scope.type === "family" ? scope.familyId : null,
      created_by_user_id: scope.type === "family" ? scope.userId : null,
      name: meal.name,
      origin: meal.origin,
    }))
  )
  if (mealError) throw new Error(mealError.message)

  const links = [...distinct.values()].flatMap((meal) =>
    meal.ingredients.map((item, position) => {
      const ingredientId = ingredientIds.get(normalizeName(item.name))
      if (!ingredientId) throw new Error("INGREDIENT_NOT_FOUND")
      return {
        meal_id: meal.id,
        ingredient_id: ingredientId,
        position,
        quantity: item.quantity,
      }
    })
  )
  if (links.length > 0) {
    let { error } = await supabase.from("meal_ingredients").insert(links)
    if (
      error &&
      (error.code === "42703" || error.code === "PGRST204") &&
      /quantity/i.test(error.message)
    ) {
      const result = await supabase.from("meal_ingredients").insert(
        links.map(({ meal_id, ingredient_id, position }) => ({
          meal_id,
          ingredient_id,
          position,
        }))
      )
      error = result.error
    }
    if (error) throw new Error(error.message)
  }

  return ordered.map(({ id, name }) => ({ id, name }))
}

async function replaceMealIngredients(
  supabase: Client,
  scope: MealScope,
  mealId: string,
  ingredientInputs: UpsertMealIngredientInput[]
) {
  const items = normalizeIngredientInputs(ingredientInputs)
  const names = items.map((i) => i.name)

  const { error: deleteError } = await supabase
    .from("meal_ingredients")
    .delete()
    .eq("meal_id", mealId)
  if (deleteError) throw new Error(deleteError.message)

  if (names.length === 0) return

  const isFamily = scope.type === "family"
  const norms = names.map(normalizeName)

  let fetchQuery = supabase
    .from("ingredients")
    .select("id, name_normalized")
    .in("name_normalized", norms)

  if (isFamily) {
    fetchQuery = fetchQuery.eq("family_id", scope.familyId)
  } else {
    fetchQuery = fetchQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data: existingIngs, error: fetchError } = await fetchQuery
  if (fetchError) throw new Error(fetchError.message)

  const existingNorms = new Set((existingIngs ?? []).map((i) => i.name_normalized))
  const missingNames = names.filter((n) => !existingNorms.has(normalizeName(n)))

  if (missingNames.length > 0) {
    const rowsToInsert = missingNames.map((name) => ({
      user_id: scope.userId,
      family_id: isFamily ? scope.familyId : null,
      name,
      name_normalized: normalizeName(name),
    }))

    const { error: insertError } = await supabase
      .from("ingredients")
      .insert(rowsToInsert)
    if (insertError && !insertError.message.toLowerCase().includes("unique")) {
      throw new Error(insertError.message)
    }
  }

  let refetchQuery = supabase
    .from("ingredients")
    .select("id, name_normalized")
    .in("name_normalized", norms)

  if (isFamily) {
    refetchQuery = refetchQuery.eq("family_id", scope.familyId)
  } else {
    refetchQuery = refetchQuery.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data: allIngs, error: allFetchError } = await refetchQuery
  if (allFetchError) throw new Error(allFetchError.message)

  const byNorm = new Map(
    (allIngs ?? []).map((row) => [row.name_normalized, row.id])
  )
  if (byNorm.size < norms.length) {
    const { data: fallbackIngs } = await supabase
      .from("ingredients")
      .select("id, name_normalized")
      .in("name_normalized", norms)
    for (const row of fallbackIngs ?? []) {
      if (!byNorm.has(row.name_normalized)) {
        byNorm.set(row.name_normalized, row.id)
      }
    }
  }

  const links = items
    .map((item, position) => {
      const ingredientId = byNorm.get(normalizeName(item.name))
      if (!ingredientId) return null
      return {
        meal_id: mealId,
        ingredient_id: ingredientId,
        position,
        quantity: item.quantity,
      }
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link))

  let { error: linkError } = await supabase
    .from("meal_ingredients")
    .insert(links)
  if (linkError && /quantity/i.test(linkError.message)) {
    const fallbackLinks = links.map(({ quantity: _qty, ...rest }) => {
      void _qty
      return rest
    })
    const res = await supabase.from("meal_ingredients").insert(fallbackLinks)
    linkError = res.error
  }
  if (linkError) throw new Error(linkError.message)
}

export async function upsertMeal(
  supabase: Client,
  scope: MealScope,
  input: {
    id?: string
    name: string
    ingredientNames: UpsertMealIngredientInput[]
    origin?: MealOrigin
  }
): Promise<MealWithIngredients> {
  const name = displayName(input.name)
  if (!name) throw new Error("NAME_REQUIRED")
  if (name.length > 80) throw new Error("NAME_REQUIRED")

  let mealId = input.id
  const isFamily = scope.type === "family"

  if (mealId) {
    const existing = await getMeal(supabase, scope, mealId)
    if (!existing) throw new Error("MEAL_NOT_FOUND")

    let updateQuery = supabase.from("meals").update({ name }).eq("id", mealId)
    if (isFamily) {
      updateQuery = updateQuery.eq("family_id", scope.familyId)
    } else {
      updateQuery = updateQuery.eq("user_id", scope.userId).is("family_id", null)
    }
    const { error } = await updateQuery
    if (error) throw new Error(error.message)
  } else {
    const insertPayload = {
      user_id: scope.userId,
      family_id: isFamily ? scope.familyId : null,
      created_by_user_id: isFamily ? scope.userId : null,
      name,
      origin: input.origin ?? "user",
    }
    const { data, error } = await supabase
      .from("meals")
      .insert(insertPayload)
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "SAVE_FAILED")
    mealId = data.id
  }

  await replaceMealIngredients(supabase, scope, mealId, input.ingredientNames)
  const meal = await getMeal(supabase, scope, mealId)
  if (!meal) throw new Error("SAVE_FAILED")
  return meal
}

export async function deleteMeal(
  supabase: Client,
  scope: MealScope,
  id: string
): Promise<void> {
  let query = supabase.from("meals").delete().eq("id", id)
  if (scope.type === "family") {
    query = query.eq("family_id", scope.familyId)
  } else {
    query = query.eq("user_id", scope.userId).is("family_id", null)
  }
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function copyMeal(
  supabase: Client,
  sourceMealId: string,
  targetScope: MealScope,
  authorName: string
): Promise<MealWithIngredients> {
  const { data: source, error: sourceError } = await supabase
    .from("meals")
    .select(MEAL_SELECT)
    .eq("id", sourceMealId)
    .maybeSingle()

  if (sourceError || !source) throw new Error("MEAL_NOT_FOUND")
  const sourceMeal = mapMeal(source)

  const targetMeals = await listMeals(supabase, targetScope)
  const existingNames = targetMeals.map((m) => m.name)

  const newName = resolveMealCopyName(
    sourceMeal.name,
    authorName,
    existingNames,
    targetScope.type
  )

  const ingredientInputs = sourceMeal.ingredients.map((i) => ({
    name: i.name,
    quantity: i.quantity ?? null,
  }))
  return upsertMeal(supabase, targetScope, {
    name: newName,
    ingredientNames: ingredientInputs,
    origin: sourceMeal.origin,
  })
}
