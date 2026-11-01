import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const source = (path: string) => JSON.stringify(new URL(path, import.meta.url).href)
const sdkPath = JSON.stringify(createRequire(import.meta.url).resolve("@supabase/supabase-js"))
const sessionPath = JSON.stringify(fileURLToPath(new URL("../lib/actions/session.ts", import.meta.url)))

function runScenario(
  scenario: string,
  options: {
    sdk?: boolean
    ingredientConflict?: "progress" | "stalled"
    messageOnlyConflict?: boolean
    legacyQuantity?: boolean
  } = {}
): unknown {
  const directory = mkdtempSync(join(tmpdir(), "planifia-batch-"))
  // Dynamic imports isolate the dev store path and load the action only after its session boundary is replaced.
  const script = `
    const { createDevClient } = await import(${source("../lib/dev/client.ts")})
    const { withStore } = await import(${source("../lib/dev/store.ts")})
    const { createMeals, getMeal, listMeals } = await import(${source("../lib/domain/meals.ts")})
    const { clearWeekSlots, setMultipleSlots, getWeekSlots } = await import(${source("../lib/domain/slots.ts")})
    const { listWeekIngredients } = await import(${source("../lib/domain/shopping.ts")})
    const { createClient } = await import(${sdkPath})
    const { mock } = await import("bun:test")
    const dev = createDevClient()
    const userId = "11111111-1111-4111-8111-111111111111"
    const otherUserId = "99999999-9999-4999-8999-999999999999"
    const familyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const personal = { type: "personal", userId }
    const family = { type: "family", userId, familyId }
    const other = { type: "personal", userId: otherUserId }
    const faults = ${JSON.stringify(options)}
    let collisionHandled = false
    await withStore((store) => {
      store.meals = []
      store.ingredients = []
      store.meal_ingredients = []
      store.plan_slots = []
      store.shopping_checks = []
    }, true)
    const reply = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    })
    const failure = (code, message, status = 400) => reply({ code, message, details: null, hint: null }, status)
    const transport = async (input, init) => {
      const url = new URL(input)
      const table = url.pathname.split("/").pop()
      const method = init?.method ?? "GET"
      if (table === "family_members" && method === "GET") return reply([])
      if (["meals", "ingredients", "plan_slots"].includes(table) && method === "GET") {
        const familyFilter = url.searchParams.get("family_id")
        const personalFilter = url.searchParams.get("user_id")
        if (!(familyFilter?.startsWith("eq.") || (personalFilter?.startsWith("eq.") && familyFilter === "is.null"))) {
          return failure("SCOPE_REQUIRED", "Unscoped read refused")
        }
      }
      const prefer = new Headers(init?.headers).get("prefer") ?? ""
      let query = dev.from(table)
      if (method === "POST") {
        const payload = JSON.parse(init.body)
        const rows = Array.isArray(payload) ? payload : [payload]
        if (rows.length === 0) return failure("EMPTY_INSERT", "Empty insert refused")
        if (table === "ingredients" && faults.ingredientConflict && !collisionHandled) {
          collisionHandled = true
          if (faults.ingredientConflict === "progress") {
            await dev.from("ingredients").insert(rows[0])
          }
          return failure(faults.messageOnlyConflict ? "" : "23505", "Concurrent unique ingredient", 409)
        }
        if (table === "meal_ingredients" && faults.legacyQuantity && rows.some((row) => "quantity" in row)) {
          return failure("PGRST204", "Could not find the quantity column of meal_ingredients")
        }
        if (table === "meal_ingredients" && faults.failLinks) {
          return failure("23514", "quantity validation failed")
        }
        if (table === "plan_slots") {
          if (faults.failSlots) return failure("23505", "Concurrent slot", 409)
          if (prefer.includes("resolution=merge-duplicates") && url.searchParams.get("on_conflict") !== "id") {
            return failure("42P10", "Partial index requires a predicate")
          }
          const collision = await withStore((store) => rows.some((row, index) => {
            const sameKey = (existing) => existing.slot_date === row.slot_date && existing.slot_kind === row.slot_kind &&
              (row.family_id ? existing.family_id === row.family_id : !existing.family_id && existing.user_id === row.user_id)
            return store.plan_slots.some((existing) => existing.id !== row.id && sameKey(existing)) ||
              rows.slice(0, index).some(sameKey)
          }))
          if (collision) return failure("23505", "Duplicate slot", 409)
        }
        query = prefer.includes("resolution=merge-duplicates")
          ? query.upsert(payload, { onConflict: url.searchParams.get("on_conflict") ?? "id" })
          : query.insert(payload)
      } else if (method === "DELETE") {
        query = query.delete()
      } else if (method !== "GET") {
        return failure("UNSUPPORTED", method)
      }
      for (const [column, filter] of url.searchParams) {
        if (["select", "on_conflict", "columns", "order"].includes(column)) continue
        const dot = filter.indexOf(".")
        const operator = filter.slice(0, dot)
        const value = filter.slice(dot + 1)
        if (operator === "eq") query = query.eq(column, value)
        else if (operator === "is") query = query.is(column, value === "null" ? null : value)
        else if (operator === "gte") query = query.gte(column, value)
        else if (operator === "lte") query = query.lte(column, value)
        else if (operator === "in") {
          query = query.in(column, value.slice(1, -1).split(",").map((item) => item.replace(/^"|"$/g, "")))
        } else return failure("UNSUPPORTED_FILTER", filter)
      }
      query = query.select(url.searchParams.get("select") ?? "*")
      const { data, error } = await query
      if (error) return failure("DEV_STORE", error.message)
      const accept = new Headers(init?.headers).get("accept") ?? ""
      if (accept.includes("application/vnd.pgrst.object+json")) return reply(data[0] ?? null)
      if (method === "GET" || prefer.includes("return=representation")) {
        return reply(Array.isArray(data) ? data.slice().reverse() : data, method === "POST" ? 201 : 200)
      }
      return new Response(null, { status: method === "POST" ? 201 : 204 })
    }
    const client = faults.sdk
      ? createClient("https://planning.invalid", "test-key", {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: transport },
        })
      : dev
    let activeScope = personal
    mock.module(${sessionPath}, () => ({
      requireScopedContext: async () => ({ supabase: client, authUid: userId, scope: activeScope }),
      revalidateApp: async () => undefined,
    }))
    const { applyAutoPlanAction } = await import(${source("../lib/actions/auto-plan.ts")})
    const assigned = async (scope, start) => (await getWeekSlots(client, scope, start))
      .filter((slot) => slot.meal)
      .map((slot) => [slot.slot_date, slot.slot_kind, slot.meal.name])
    const snapshot = () => withStore((store) => JSON.stringify(store))
    const result = await (async () => { ${scenario} })()
    console.log(JSON.stringify(result))
  `
  try {
    const child = spawnSync(process.execPath, ["--eval", script], {
      cwd: directory,
      encoding: "utf8",
      timeout: 15000,
    })
    if (child.error) throw child.error
    if (child.status !== 0) throw new Error(child.stderr || "Batch planning subprocess failed")
    return JSON.parse(child.stdout)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe("Application groupée du planning", () => {
  it("réutilise un seul nouveau reste et n'ajoute rien aux courses sur deux semaines", () => {
    expect(runScenario(`
      const result = await applyAutoPlanAction([
        { date: "2026-10-31", kind: "diner", meal: { name: " Reste ", ingredients: [], origin: "ai" } },
        { date: "2026-11-07", kind: "dejeuner", meal: { name: "reste", ingredients: [], origin: "ai" } },
      ])
      const meals = await listMeals(client, personal)
      return {
        count: result.count,
        sameId: result.slots[0].meal.id === result.slots[1].meal.id,
        meals: meals.map((meal) => [meal.name, meal.ingredients]),
        first: await assigned(personal, "2026-10-26"),
        second: await assigned(personal, "2026-11-02"),
        groceries: [await listWeekIngredients(client, personal, "2026-10-26"), await listWeekIngredients(client, personal, "2026-11-02")],
      }
    `)).toEqual({
      count: 2,
      sameId: true,
      meals: [["Reste", []]],
      first: [["2026-10-31", "diner", "Reste"]],
      second: [["2026-11-07", "dejeuner", "Reste"]],
      groceries: [[], []],
    })
  })

  it("garde distinctes les recettes homonymes et partage les ingrédients sans perdre les quantités ni l'espace", () => {
    expect(runScenario(`
      const [foreign] = await createMeals(client, family, [{ name: "Sauce", ingredientNames: [{ name: "Tomate", quantity: "1 kg" }] }])
      const [freshFamily] = await createMeals(client, family, [{ name: "Sauce", ingredientNames: [{ name: "Tomate", quantity: "1 kg" }] }])
      const [first, second, duplicate, differentQuantity, differentOrigin] = await createMeals(client, personal, [
        { name: "Sauce", origin: "ai", ingredientNames: [{ name: " Tomate ", quantity: " 200 g " }, { name: "Basilic", quantity: "3 feuilles" }, { name: "tomate", quantity: "9 kg" }] },
        { name: "Sauce", origin: "ai", ingredientNames: [{ name: "TOMATE", quantity: "500 g" }, { name: "Oignon", quantity: "1" }] },
        { name: " sauce ", origin: "ai", ingredientNames: [{ name: "tomate", quantity: "200 g" }, { name: "basilic", quantity: "3 feuilles" }] },
        { name: "Sauce", origin: "ai", ingredientNames: [{ name: "Tomate", quantity: "300 g" }, { name: "Basilic", quantity: "3 feuilles" }] },
        { name: "Sauce", origin: "user", ingredientNames: [{ name: "Tomate", quantity: "200 g" }, { name: "Basilic", quantity: "3 feuilles" }] },
      ])
      const a = await getMeal(client, personal, first.id)
      const b = await getMeal(client, personal, second.id)
      const f = await getMeal(client, family, foreign.id)
      await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: first.id }, { date: "2026-11-01", kind: "diner", mealId: second.id }])
      return {
        distinct: new Set([first.id, second.id, differentQuantity.id, differentOrigin.id]).size,
        duplicate: first.id === duplicate.id,
        first: a.ingredients.map((item) => [item.name, item.quantity]),
        second: b.ingredients.map((item) => [item.name, item.quantity]),
        shared: a.ingredients[0].id === b.ingredients[0].id,
        scoped: a.ingredients[0].id !== f.ingredients[0].id,
        newFamilyRecipe: freshFamily.id !== foreign.id,
        family: f.ingredients.map((item) => [item.name, item.quantity]),
        groceries: (await listWeekIngredients(client, personal, "2026-10-26")).map((item) => item.name),
        mealCount: (await listMeals(client, personal)).length,
      }
    `, { sdk: true })).toEqual({
      distinct: 4,
      duplicate: true,
      first: [["Tomate", "200 g"], ["Basilic", "3 feuilles"]],
      second: [["Tomate", "500 g"], ["Oignon", "1"]],
      shared: true,
      scoped: true,
      newFamilyRecipe: true,
      family: [["Tomate", "1 kg"]],
      groceries: ["Basilic", "Oignon", "Tomate"],
      mealCount: 4,
    })
  })

  it("applique le dernier choix une seule fois et conserve les recettes existantes, les créneaux voisins et les autres espaces", () => {
    expect(runScenario(`
      const [old, replacement] = await createMeals(client, personal, [
        { name: "Recette conservée", ingredientNames: [{ name: "Riz", quantity: "200 g" }] },
        { name: "Remplacement", ingredientNames: [] },
      ])
      const [familyMeal] = await createMeals(client, family, [{ name: "Famille", ingredientNames: [] }])
      const [otherMeal] = await createMeals(client, other, [{ name: "Autre personne", ingredientNames: [] }])
      await setMultipleSlots(client, personal, [
        { date: "2026-10-31", kind: "diner", mealId: old.id },
        { date: "2026-10-31", kind: "dejeuner", mealId: old.id },
        { date: "2026-11-07", kind: "diner", mealId: old.id },
        { date: "2026-11-07", kind: "dejeuner", mealId: old.id },
      ])
      await setMultipleSlots(client, family, [{ date: "2026-10-31", kind: "diner", mealId: familyMeal.id }])
      await setMultipleSlots(client, other, [{ date: "2026-10-31", kind: "diner", mealId: otherMeal.id }])
      const before = await getMeal(client, personal, old.id)
      const result = await applyAutoPlanAction([
        { date: "2026-10-31", kind: "diner", meal: { name: "Ne doit pas être créé", ingredients: ["Pomme"], origin: "ai" } },
        { date: "2026-10-31", kind: "diner", meal: { id: replacement.id, name: "Remplacement", ingredients: ["Modifier interdit"], origin: "catalog" } },
        { date: "2026-11-07", kind: "diner", meal: { id: old.id, name: "Recette conservée", ingredients: ["Modifier interdit"], origin: "catalog" } },
      ])
      return {
        count: result.count,
        dates: result.slots.map((slot) => slot.date),
        first: await assigned(personal, "2026-10-26"),
        second: await assigned(personal, "2026-11-02"),
        family: await assigned(family, "2026-10-26"),
        other: await assigned(other, "2026-10-26"),
        unchanged: JSON.stringify(before) === JSON.stringify(await getMeal(client, personal, old.id)),
        names: (await listMeals(client, personal)).map((meal) => meal.name),
      }
    `, { sdk: true })).toEqual({
      count: 2,
      dates: ["2026-10-31", "2026-11-07"],
      first: [["2026-10-31", "dejeuner", "Recette conservée"], ["2026-10-31", "diner", "Remplacement"]],
      second: [["2026-11-07", "dejeuner", "Recette conservée"], ["2026-11-07", "diner", "Recette conservée"]],
      family: [["2026-10-31", "diner", "Famille"]],
      other: [["2026-10-31", "diner", "Autre personne"]],
      unchanged: true,
      names: ["Recette conservée", "Remplacement"],
    })
  })

  it("conserve l'auteur des créneaux familiaux existants et choisit le dernier repas par clé", () => {
    expect(runScenario(`
      const [first, last] = await createMeals(client, family, [{ name: "Premier", ingredientNames: [] }, { name: "Dernier", ingredientNames: [] }])
      const memberScope = { ...family, userId: otherUserId }
      await setMultipleSlots(client, memberScope, [{ date: "2026-11-07", kind: "diner", mealId: first.id }])
      const before = await withStore((store) => store.plan_slots[0])
      await setMultipleSlots(client, family, [
        { date: "2026-11-07", kind: "diner", mealId: first.id },
        { date: "2026-11-07", kind: "diner", mealId: last.id },
        { date: "2026-11-08", kind: "dejeuner", mealId: last.id },
      ])
      const after = await withStore((store) => store.plan_slots.find((slot) => slot.id === before.id))
      const added = await withStore((store) => store.plan_slots.find((slot) => slot.slot_date === "2026-11-08"))
      return { sameRow: after.id === before.id, owner: after.user_id, newOwner: added.user_id, slots: await assigned(family, "2026-11-02") }
    `, { sdk: true })).toEqual({
      sameRow: true,
      owner: "99999999-9999-4999-8999-999999999999",
      newOwner: "11111111-1111-4111-8111-111111111111",
      slots: [["2026-11-07", "diner", "Dernier"], ["2026-11-08", "dejeuner", "Dernier"]],
    })
  })

  it("ne perd aucun ancien créneau lorsque l'enregistrement groupé échoue", () => {
    expect(runScenario(`
      const [old, next] = await createMeals(client, personal, [{ name: "Ancien", ingredientNames: [] }, { name: "Nouveau", ingredientNames: [] }])
      await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: old.id }, { date: "2026-11-07", kind: "diner", mealId: old.id }])
      const before = await snapshot()
      faults.failSlots = true
      let rejected = false
      try {
        await applyAutoPlanAction(["2026-10-31", "2026-11-07"].map((date) => ({ date, kind: "diner", meal: { ...next, ingredients: [], origin: "catalog" } })))
      } catch { rejected = true }
      return { rejected, unchanged: before === await snapshot(), first: await assigned(personal, "2026-10-26"), second: await assigned(personal, "2026-11-02") }
    `, { sdk: true })).toEqual({
      rejected: true,
      unchanged: true,
      first: [["2026-10-31", "diner", "Ancien"]],
      second: [["2026-11-07", "diner", "Ancien"]],
    })
  })

  it("refuse les identifiants de repas hors espace avant de modifier le planning", () => {
    expect(runScenario(`
      const [own] = await createMeals(client, personal, [{ name: "Personnel", ingredientNames: [] }])
      const [foreign] = await createMeals(client, family, [{ name: "Familial", ingredientNames: [] }])
      const [someoneElse] = await createMeals(client, other, [{ name: "Autre", ingredientNames: [] }])
      await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: own.id }])
      const before = await snapshot()
      const rejected = []
      for (const [scope, mealId] of [[personal, foreign.id], [family, own.id], [personal, someoneElse.id]]) {
        try { await setMultipleSlots(client, scope, [{ date: "2026-10-31", kind: "diner", mealId }]); rejected.push(false) }
        catch { rejected.push(true) }
      }
      return { rejected, unchanged: before === await snapshot(), slots: await assigned(personal, "2026-10-26") }
    `, { sdk: true })).toEqual({ rejected: [true, true, true], unchanged: true, slots: [["2026-10-31", "diner", "Personnel"]] })
  })

  it("réinsère tous les ingrédients encore absents après une collision concurrente", () => {
    for (const messageOnlyConflict of [false, true]) {
      expect(runScenario(`
        const [meal] = await createMeals(client, personal, [{ name: "Soupe", ingredientNames: [{ name: "Carotte", quantity: "2" }, { name: "Poireau", quantity: "3" }] }])
        await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: meal.id }])
        return {
          ingredients: (await getMeal(client, personal, meal.id)).ingredients.map((item) => [item.name, item.quantity]),
          groceries: (await listWeekIngredients(client, personal, "2026-10-26")).map((item) => item.name),
          count: await withStore((store) => store.ingredients.length),
        }
      `, { sdk: true, ingredientConflict: "progress", messageOnlyConflict })).toEqual({ ingredients: [["Carotte", "2"], ["Poireau", "3"]], groceries: ["Carotte", "Poireau"], count: 2 })
    }
  })

  it("arrête une collision sans progrès au lieu de perdre des liens ou de boucler", () => {
    expect(runScenario(`
      let rejected = false
      try { await createMeals(client, personal, [{ name: "Soupe", ingredientNames: ["Carotte", "Poireau"] }]) }
      catch { rejected = true }
      return { rejected, meals: await listMeals(client, personal), groceries: await listWeekIngredients(client, personal, "2026-10-26") }
    `, { sdk: true, ingredientConflict: "stalled" })).toEqual({ rejected: true, meals: [], groceries: [] })
  })

  it("garde tous les liens si l'ancienne base n'a pas la colonne quantity", () => {
    expect(runScenario(`
      const [meal] = await createMeals(client, personal, [{ name: "Soupe", ingredientNames: [{ name: "Carotte", quantity: "2" }, { name: "Poireau", quantity: "3" }] }])
      await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: meal.id }])
      return {
        ingredients: (await getMeal(client, personal, meal.id)).ingredients.map((item) => [item.name, item.quantity]),
        groceries: (await listWeekIngredients(client, personal, "2026-10-26")).map((item) => item.name),
      }
    `, { sdk: true, legacyQuantity: true })).toEqual({ ingredients: [["Carotte", null], ["Poireau", null]], groceries: ["Carotte", "Poireau"] })
  })

  it("ne masque pas une autre erreur de quantité et laisse l'ancien planning intact", () => {
    expect(runScenario(`
      const [old] = await createMeals(client, personal, [{ name: "Ancien", ingredientNames: [] }])
      await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: old.id }])
      faults.failLinks = true
      let rejected = false
      try { await applyAutoPlanAction([{ date: "2026-10-31", kind: "diner", meal: { name: "Soupe", ingredients: ["Carotte"], origin: "ai" } }]) }
      catch { rejected = true }
      return { rejected, slots: await assigned(personal, "2026-10-26") }
    `, { sdk: true })).toEqual({ rejected: true, slots: [["2026-10-31", "diner", "Ancien"]] })
  })

  it("valide l'ensemble du lot avant toute écriture de recette ou de créneau", () => {
    expect(runScenario(`
      const [meal] = await createMeals(client, personal, [{ name: "Existant", ingredientNames: [] }])
      const before = await snapshot()
      const rejected = []
      for (const invalid of [{ date: "2026-02-30", kind: "diner" }, { date: "2026-11-07", kind: "petit-dejeuner" }]) {
        try { await setMultipleSlots(client, personal, [{ date: "2026-10-31", kind: "diner", mealId: meal.id }, { ...invalid, mealId: meal.id }]); rejected.push(false) }
        catch { rejected.push(true) }
        try { await applyAutoPlanAction([{ date: "2026-10-31", kind: "diner", meal: { name: "À ne pas créer", ingredients: [], origin: "ai" } }, { ...invalid, meal: { name: "Soupe", ingredients: [], origin: "ai" } }]); rejected.push(false) }
        catch { rejected.push(true) }
      }
      for (const name of ["   ", "x".repeat(81)]) {
        try { await applyAutoPlanAction([{ date: "2026-10-31", kind: "diner", meal: { name: "À ne pas créer", ingredients: [], origin: "ai" } }, { date: "2026-11-07", kind: "diner", meal: { name, ingredients: [], origin: "ai" } }]); rejected.push(false) }
        catch { rejected.push(true) }
        try { await createMeals(client, personal, [{ name: "À ne pas créer", ingredientNames: ["Carotte"] }, { name, ingredientNames: [] }]); rejected.push(false) }
        catch { rejected.push(true) }
      }
      return { rejected, unchanged: before === await snapshot() }
    `)).toEqual({ rejected: [true, true, true, true, true, true, true, true], unchanged: true })
  })

  it("supprime tous les repas d'une semaine sans impacter les autres semaines", () => {
    expect(runScenario(`
      const [meal1, meal2] = await createMeals(client, personal, [
        { name: "Plat Semaine 1", ingredientNames: [] },
        { name: "Plat Semaine 2", ingredientNames: [] },
      ])
      await setMultipleSlots(client, personal, [
        { date: "2026-10-26", kind: "dejeuner", mealId: meal1.id },
        { date: "2026-10-27", kind: "diner", mealId: meal1.id },
        { date: "2026-11-02", kind: "dejeuner", mealId: meal2.id },
      ])

      const deleted = await clearWeekSlots(client, personal, "2026-10-26")
      const week1Slots = await getWeekSlots(client, personal, "2026-10-26")
      const week2Slots = await getWeekSlots(client, personal, "2026-11-02")

      return {
        deleted,
        week1Count: week1Slots.filter((s) => s.meal !== null).length,
        week2Count: week2Slots.filter((s) => s.meal !== null).length,
      }
    `)).toEqual({ deleted: 2, week1Count: 0, week2Count: 1 })
  })
})
