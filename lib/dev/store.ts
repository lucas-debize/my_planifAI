import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DEV_USER_ID } from "@/lib/dev/config"
import { normalizeName } from "@/lib/ingredients"

export type MealRow = {
  id: string
  user_id: string
  name: string
  origin: "user" | "ai"
  created_at: string
  updated_at: string
}

export type IngredientRow = {
  id: string
  user_id: string
  name: string
  name_normalized: string
}

export type MealIngredientRow = {
  meal_id: string
  ingredient_id: string
  position: number
}

export type PlanSlotRow = {
  id: string
  user_id: string
  slot_date: string
  slot_kind: "dejeuner" | "diner"
  meal_id: string | null
}

export type ShoppingCheckRow = {
  user_id: string
  week_start: string
  ingredient_id: string
  checked: boolean
}

export type DevStore = {
  version: 1
  seeded: boolean
  meals: MealRow[]
  ingredients: IngredientRow[]
  meal_ingredients: MealIngredientRow[]
  plan_slots: PlanSlotRow[]
  shopping_checks: ShoppingCheckRow[]
}

const STORE_PATH = join(process.cwd(), ".data", "dev-store.json")

const MEAL_SALADE = "22222222-2222-4222-8222-222222222222"
const MEAL_PATES = "33333333-3333-4333-8333-333333333333"
const ING_CHEVRE = "44444444-4444-4444-8444-444444444441"
const ING_SALADE = "44444444-4444-4444-8444-444444444442"
const ING_PATES = "44444444-4444-4444-8444-444444444443"
const ING_PESTO = "44444444-4444-4444-8444-444444444444"

function nowIso() {
  return new Date().toISOString()
}

function ingredient(id: string, name: string): IngredientRow {
  return {
    id,
    user_id: DEV_USER_ID,
    name,
    name_normalized: normalizeName(name),
  }
}

function emptyStore(): DevStore {
  const created = nowIso()
  return {
    version: 1,
    seeded: true,
    meals: [
      {
        id: MEAL_SALADE,
        user_id: DEV_USER_ID,
        name: "Salade chèvre",
        origin: "user",
        created_at: created,
        updated_at: created,
      },
      {
        id: MEAL_PATES,
        user_id: DEV_USER_ID,
        name: "Pâtes pesto",
        origin: "user",
        created_at: created,
        updated_at: created,
      },
    ],
    ingredients: [
      ingredient(ING_CHEVRE, "Chèvre"),
      ingredient(ING_SALADE, "Salade"),
      ingredient(ING_PATES, "Pâtes"),
      ingredient(ING_PESTO, "Pesto"),
    ],
    meal_ingredients: [
      { meal_id: MEAL_SALADE, ingredient_id: ING_CHEVRE, position: 0 },
      { meal_id: MEAL_SALADE, ingredient_id: ING_SALADE, position: 1 },
      { meal_id: MEAL_PATES, ingredient_id: ING_PATES, position: 0 },
      { meal_id: MEAL_PATES, ingredient_id: ING_PESTO, position: 1 },
    ],
    plan_slots: [],
    shopping_checks: [],
  }
}

function loadStore(): DevStore {
  try {
    const raw = readFileSync(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as DevStore
    if (parsed?.version !== 1) return emptyStore()
    return {
      version: 1,
      seeded: Boolean(parsed.seeded),
      meals: parsed.meals ?? [],
      ingredients: parsed.ingredients ?? [],
      meal_ingredients: parsed.meal_ingredients ?? [],
      plan_slots: parsed.plan_slots ?? [],
      shopping_checks: parsed.shopping_checks ?? [],
    }
  } catch {
    const store = emptyStore()
    saveStore(store)
    return store
  }
}

function saveStore(store: DevStore) {
  mkdirSync(dirname(STORE_PATH), { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

let chain: Promise<unknown> = Promise.resolve()

export function withStore<T>(
  fn: (store: DevStore) => T,
  write = false
): Promise<T> {
  const run = chain.then(() => {
    const store = loadStore()
    const result = fn(store)
    if (write) saveStore(store)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export type TableName = keyof Omit<DevStore, "version" | "seeded">
