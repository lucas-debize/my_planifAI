import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { DEV_USER_EMAIL, DEV_USER_ID } from "@/lib/dev/config"
import {
  withStore,
  type DevStore,
  type TableName,
} from "@/lib/dev/store"

type Row = Record<string, unknown>
type Filter =
  | { kind: "eq"; col: string; value: unknown }
  | { kind: "gte"; col: string; value: unknown }
  | { kind: "lte"; col: string; value: unknown }
  | { kind: "in"; col: string; value: unknown[] }

function ok<T>(data: T) {
  return { data, error: null as { message: string } | null }
}

function fail(message: string) {
  return { data: null, error: { message } }
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => {
    const current = row[filter.col]
    if (filter.kind === "eq") return current === filter.value
    if (filter.kind === "gte") return String(current) >= String(filter.value)
    if (filter.kind === "lte") return String(current) <= String(filter.value)
    return filter.value.includes(current)
  })
}

function pick(row: Row, columns: string[]) {
  if (columns.length === 0 || columns.includes("*")) return { ...row }
  const next: Row = {}
  for (const column of columns) {
    if (column in row) next[column] = row[column]
  }
  return next
}

function topLevelColumns(spec: string) {
  const columns: string[] = []
  let depth = 0
  let current = ""
  for (const char of spec.replace(/\s+/g, " ").trim()) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      const token = current.trim()
      if (token && !token.includes("(") && !token.includes(":")) {
        columns.push(token)
      }
      current = ""
      continue
    }
    current += char
  }
  const token = current.trim()
  if (token && !token.includes("(") && !token.includes(":")) {
    columns.push(token)
  }
  return columns
}

function expand(store: DevStore, table: TableName, row: Row, spec: string): Row {
  const columns = topLevelColumns(spec)
  const base = columns.length > 0 ? pick(row, columns) : { ...row }

  if (table === "meals" && spec.includes("meal_ingredients")) {
    const links = store.meal_ingredients
      .filter((link) => link.meal_id === row.id)
      .map((link) => {
        const ingredient = store.ingredients.find(
          (item) => item.id === link.ingredient_id
        )
        return {
          position: link.position,
          ingredient: ingredient
            ? { id: ingredient.id, name: ingredient.name }
            : null,
        }
      })
    return { ...base, meal_ingredients: links }
  }

  if (table === "plan_slots" && spec.includes("meal:")) {
    const meal = store.meals.find((item) => item.id === row.meal_id)
    return {
      ...base,
      meal: meal ? { id: meal.id, name: meal.name } : null,
    }
  }

  if (table === "meal_ingredients" && spec.includes("ingredient:")) {
    const ingredient = store.ingredients.find(
      (item) => item.id === row.ingredient_id
    )
    return {
      ...base,
      ingredient: ingredient
        ? { id: ingredient.id, name: ingredient.name }
        : null,
    }
  }

  return base
}

function cascadeDelete(store: DevStore, table: TableName, row: Row) {
  if (table !== "meals") return
  const mealId = String(row.id)
  store.meal_ingredients = store.meal_ingredients.filter(
    (link) => link.meal_id !== mealId
  )
  for (const slot of store.plan_slots) {
    if (slot.meal_id === mealId) slot.meal_id = null
  }
}

class Query {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select"
  private filters: Filter[] = []
  private payload: Row | Row[] | null = null
  private upsertOpts?: { onConflict?: string; ignoreDuplicates?: boolean }
  private spec = "*"
  private mode: "many" | "single" | "maybe" = "many"

  constructor(private table: TableName) {}

  select(spec: string) {
    this.spec = spec
    return this
  }

  eq(col: string, value: unknown) {
    this.filters.push({ kind: "eq", col, value })
    return this
  }

  gte(col: string, value: unknown) {
    this.filters.push({ kind: "gte", col, value })
    return this
  }

  lte(col: string, value: unknown) {
    this.filters.push({ kind: "lte", col, value })
    return this
  }

  in(col: string, value: unknown[]) {
    this.filters.push({ kind: "in", col, value })
    return this
  }

  insert(values: Row | Row[]) {
    this.op = "insert"
    this.payload = values
    return this
  }

  update(values: Row) {
    this.op = "update"
    this.payload = values
    return this
  }

  upsert(
    values: Row | Row[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) {
    this.op = "upsert"
    this.payload = values
    this.upsertOpts = opts
    return this
  }

  delete() {
    this.op = "delete"
    return this
  }

  single() {
    this.mode = "single"
    return this.execute()
  }

  maybeSingle() {
    this.mode = "maybe"
    return this.execute()
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((
          value: { data: unknown; error: { message: string } | null }
        ) => TResult1)
      | null,
    onrejected?: ((reason: unknown) => TResult2) | null
  ) {
    return this.execute().then(onfulfilled, onrejected)
  }

  private execute() {
    const write = this.op !== "select"
    return withStore((store) => {
      try {
        const table = store[this.table] as Row[]
        if (this.op === "select") {
          const rows = table
            .filter((row) => matches(row, this.filters))
            .map((row) => expand(store, this.table, row, this.spec))
          if (this.mode === "single") {
            if (rows.length !== 1) return fail("JSON_SINGLE")
            return ok(rows[0])
          }
          if (this.mode === "maybe") return ok(rows[0] ?? null)
          return ok(rows)
        }

        if (this.op === "insert") {
          const incoming = Array.isArray(this.payload)
            ? this.payload
            : [this.payload ?? {}]
          const inserted: Row[] = []
          for (const row of incoming) {
            const next = { ...row }
            if (
              this.table !== "meal_ingredients" &&
              this.table !== "shopping_checks"
            ) {
              next.id = next.id ?? crypto.randomUUID()
            }
            if (this.table === "meals") {
              const stamp = new Date().toISOString()
              next.created_at = stamp
              next.updated_at = stamp
              next.origin = next.origin ?? "user"
            }
            table.push(next)
            inserted.push(next)
          }
          const projected = inserted.map((row) =>
            expand(store, this.table, row, this.spec)
          )
          if (this.mode === "single") return ok(projected[0] ?? null)
          if (this.mode === "maybe") return ok(projected[0] ?? null)
          return ok(projected)
        }

        if (this.op === "update") {
          const patch = (this.payload ?? {}) as Row
          for (const row of table) {
            if (!matches(row, this.filters)) continue
            Object.assign(row, patch)
            if (this.table === "meals") {
              row.updated_at = new Date().toISOString()
            }
          }
          return ok(null)
        }

        if (this.op === "delete") {
          const remaining: Row[] = []
          for (const row of table) {
            if (matches(row, this.filters)) {
              cascadeDelete(store, this.table, row)
            } else {
              remaining.push(row)
            }
          }
          ;(store[this.table] as Row[]) = remaining
          return ok(null)
        }

        const incoming = Array.isArray(this.payload)
          ? this.payload
          : [this.payload ?? {}]
        const keys = (this.upsertOpts?.onConflict ?? "id")
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean)
        for (const row of incoming) {
          const index = table.findIndex((existing) =>
            keys.every((key) => existing[key] === row[key])
          )
          if (index >= 0) {
            if (!this.upsertOpts?.ignoreDuplicates) {
              table[index] = { ...table[index], ...row }
            }
          } else {
            const next = { ...row }
            if (
              this.table !== "meal_ingredients" &&
              this.table !== "shopping_checks"
            ) {
              next.id = next.id ?? crypto.randomUUID()
            }
            table.push(next)
          }
        }
        return ok(null)
      } catch (error) {
        return fail(error instanceof Error ? error.message : "DEV_STORE")
      }
    }, write)
  }
}

export function createDevClient() {
  return {
    auth: {
      async getClaims() {
        return {
          data: {
            claims: {
              sub: DEV_USER_ID,
              email: DEV_USER_EMAIL,
            },
          },
          error: null,
        }
      },
      async signOut() {
        return { error: null }
      },
      async exchangeCodeForSession() {
        return { error: { message: "Dev bypass" } }
      },
      async verifyOtp() {
        return { error: { message: "Dev bypass" } }
      },
    },
    from(table: TableName) {
      return new Query(table)
    },
  } as unknown as SupabaseClient<Database>
}

export function createUnauthenticatedClient() {
  return {
    auth: {
      async getClaims() {
        return { data: { claims: null }, error: null }
      },
      async signOut() {
        return { error: null }
      },
      async exchangeCodeForSession() {
        return { data: null, error: { message: "Supabase n’est pas configuré" } }
      },
      async verifyOtp() {
        return { data: null, error: { message: "Supabase n’est pas configuré" } }
      },
    },
    from() {
      throw new Error("Supabase n’est pas configuré")
    },
  } as unknown as SupabaseClient<Database>
}
