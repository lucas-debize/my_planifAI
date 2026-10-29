import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { parseISODate, toISODate, weekDays } from "@/lib/dates"
import { SLOTS, type SlotKind } from "@/lib/week"
import { getMeal, type MealScope } from "@/lib/domain/meals"

type Client = SupabaseClient<Database>

export type WeekSlot = {
  slot_date: string
  slot_kind: SlotKind
  meal: { id: string; name: string } | null
}

export type SlotScope =
  | { type: "personal"; userId: string }
  | { type: "family"; familyId: string; userId: string }

function emptyWeek(weekStart: string): WeekSlot[] {
  const monday = parseISODate(weekStart)
  if (!monday) throw new Error("INVALID_WEEK")
  return weekDays(monday).flatMap((day) =>
    SLOTS.map((kind) => ({
      slot_date: toISODate(day),
      slot_kind: kind,
      meal: null,
    }))
  )
}

function asMeal(
  value:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
    | undefined
): { id: string; name: string } | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function getWeekSlots(
  supabase: Client,
  scope: SlotScope,
  weekStart: string
): Promise<WeekSlot[]> {
  const slots = emptyWeek(weekStart)
  const monday = parseISODate(weekStart)
  if (!monday) throw new Error("INVALID_WEEK")
  const days = weekDays(monday)
  const from = toISODate(days[0])
  const to = toISODate(days[6])

  let query = supabase
    .from("plan_slots")
    .select("slot_date, slot_kind, meal:meals(id, name)")
    .gte("slot_date", from)
    .lte("slot_date", to)

  if (scope.type === "family") {
    query = query.eq("family_id", scope.familyId)
  } else {
    query = query.eq("user_id", scope.userId).is("family_id", null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const byKey = new Map(
    (data ?? []).map((row) => [
      `${row.slot_date}:${row.slot_kind}`,
      asMeal(row.meal),
    ])
  )

  return slots.map((slot) => ({
    ...slot,
    meal: byKey.get(`${slot.slot_date}:${slot.slot_kind}`) ?? null,
  }))
}

export async function setSlot(
  supabase: Client,
  scope: SlotScope,
  input: { date: string; kind: SlotKind; mealId: string | null }
): Promise<void> {
  if (!parseISODate(input.date)) throw new Error("INVALID_DATE")

  const isFamily = scope.type === "family"

  if (input.mealId === null) {
    let deleteQuery = supabase
      .from("plan_slots")
      .delete()
      .eq("slot_date", input.date)
      .eq("slot_kind", input.kind)

    if (isFamily) {
      deleteQuery = deleteQuery.eq("family_id", scope.familyId)
    } else {
      deleteQuery = deleteQuery.eq("user_id", scope.userId).is("family_id", null)
    }

    const { error } = await deleteQuery
    if (error) throw new Error(error.message)
    return
  }

  const mealScope: MealScope = isFamily
    ? { type: "family", familyId: scope.familyId, userId: scope.userId }
    : { type: "personal", userId: scope.userId }

  const meal = await getMeal(supabase, mealScope, input.mealId)
  if (!meal) throw new Error("MEAL_NOT_FOUND")

  // Delete existing slot at that date & kind
  let deleteExisting = supabase
    .from("plan_slots")
    .delete()
    .eq("slot_date", input.date)
    .eq("slot_kind", input.kind)

  if (isFamily) {
    deleteExisting = deleteExisting.eq("family_id", scope.familyId)
  } else {
    deleteExisting = deleteExisting.eq("user_id", scope.userId).is("family_id", null)
  }
  await deleteExisting

  // Insert the new slot
  const { error: insertError } = await supabase.from("plan_slots").insert({
    family_id: isFamily ? scope.familyId : null,
    user_id: scope.userId,
    slot_date: input.date,
    slot_kind: input.kind,
    meal_id: input.mealId,
  })

  if (insertError) throw new Error(insertError.message)
}

export async function setMultipleSlots(
  supabase: Client,
  scope: SlotScope,
  assignments: { date: string; kind: SlotKind; mealId: string }[]
): Promise<void> {
  if (assignments.length === 0) return
  const selected = new Map<string, (typeof assignments)[number]>()
  for (const item of assignments) {
    if (!parseISODate(item.date)) throw new Error("INVALID_DATE")
    if (!SLOTS.includes(item.kind)) throw new Error("INVALID_SLOT_KIND")
    selected.set(`${item.date}:${item.kind}`, item)
  }

  const mealIds = [...new Set([...selected.values()].map((item) => item.mealId))]
  let mealQuery = supabase.from("meals").select("id").in("id", mealIds)
  if (scope.type === "family") {
    mealQuery = mealQuery.eq("family_id", scope.familyId)
  } else {
    mealQuery = mealQuery.eq("user_id", scope.userId).is("family_id", null)
  }
  const { data: meals, error: mealError } = await mealQuery
  if (mealError) throw new Error(mealError.message)
  const foundIds = new Set((meals ?? []).map((meal) => meal.id))
  if (mealIds.some((id) => !foundIds.has(id))) throw new Error("MEAL_NOT_FOUND")

  const dates = [...new Set([...selected.values()].map((item) => item.date))]
  let slotQuery = supabase
    .from("plan_slots")
    .select("id, user_id, slot_date, slot_kind")
    .in("slot_date", dates)
  if (scope.type === "family") {
    slotQuery = slotQuery.eq("family_id", scope.familyId)
  } else {
    slotQuery = slotQuery.eq("user_id", scope.userId).is("family_id", null)
  }
  const { data: slots, error: slotError } = await slotQuery
  if (slotError) throw new Error(slotError.message)
  const existingByKey = new Map(
    (slots ?? []).map((slot) => [`${slot.slot_date}:${slot.slot_kind}`, slot])
  )
  const rows = [...selected.entries()].map(([key, item]) => {
    const existing = existingByKey.get(key)
    return {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: existing?.user_id ?? scope.userId,
      family_id: scope.type === "family" ? scope.familyId : null,
      slot_date: item.date,
      slot_kind: item.kind,
      meal_id: item.mealId,
    }
  })
  const { error } = await supabase
    .from("plan_slots")
    .upsert(rows, { onConflict: "id" })
  if (error) throw new Error(error.message)
}

export async function copyWeek(
  supabase: Client,
  scope: SlotScope,
  input: { fromStart: string; toStart: string }
): Promise<void> {
  if (input.fromStart === input.toStart) throw new Error("SAME_WEEK")
  const fromSlots = await getWeekSlots(supabase, scope, input.fromStart)
  const toMonday = parseISODate(input.toStart)
  const fromMonday = parseISODate(input.fromStart)
  if (!toMonday || !fromMonday) throw new Error("INVALID_WEEK")

  const toDays = weekDays(toMonday)
  const fromDays = weekDays(fromMonday)

  for (let i = 0; i < 7; i++) {
    const fromDate = toISODate(fromDays[i])
    const toDate = toISODate(toDays[i])
    for (const kind of SLOTS) {
      const fromSlot = fromSlots.find(
        (s) => s.slot_date === fromDate && s.slot_kind === kind
      )
      await setSlot(supabase, scope, {
        date: toDate,
        kind,
        mealId: fromSlot?.meal ? fromSlot.meal.id : null,
      })
    }
  }
}
