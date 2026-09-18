import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { parseISODate, toISODate, weekDays } from "@/lib/dates"
import { SLOTS, type SlotKind } from "@/lib/week"
import { getMeal } from "@/lib/domain/meals"

type Client = SupabaseClient<Database>

export type WeekSlot = {
  slot_date: string
  slot_kind: SlotKind
  meal: { id: string; name: string } | null
}

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
  userId: string,
  weekStart: string
): Promise<WeekSlot[]> {
  const slots = emptyWeek(weekStart)
  const monday = parseISODate(weekStart)
  if (!monday) throw new Error("INVALID_WEEK")
  const days = weekDays(monday)
  const from = toISODate(days[0])
  const to = toISODate(days[6])

  const { data, error } = await supabase
    .from("plan_slots")
    .select("slot_date, slot_kind, meal:meals(id, name)")
    .eq("user_id", userId)
    .gte("slot_date", from)
    .lte("slot_date", to)

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
  userId: string,
  input: { date: string; kind: SlotKind; mealId: string | null }
): Promise<void> {
  if (!parseISODate(input.date)) throw new Error("INVALID_DATE")

  if (input.mealId === null) {
    const { error } = await supabase
      .from("plan_slots")
      .delete()
      .eq("user_id", userId)
      .eq("slot_date", input.date)
      .eq("slot_kind", input.kind)
    if (error) throw new Error(error.message)
    return
  }

  const meal = await getMeal(supabase, userId, input.mealId)
  if (!meal) throw new Error("MEAL_NOT_FOUND")

  const { error } = await supabase.from("plan_slots").upsert(
    {
      user_id: userId,
      slot_date: input.date,
      slot_kind: input.kind,
      meal_id: input.mealId,
    },
    { onConflict: "user_id,slot_date,slot_kind" }
  )
  if (error) throw new Error(error.message)
}

export async function copyWeek(
  supabase: Client,
  userId: string,
  input: { fromStart: string; toStart: string }
): Promise<void> {
  if (input.fromStart === input.toStart) throw new Error("SAME_WEEK")
  const fromSlots = await getWeekSlots(supabase, userId, input.fromStart)
  const toSlots = await getWeekSlots(supabase, userId, input.toStart)

  for (let i = 0; i < toSlots.length; i += 1) {
    const source = fromSlots[i]
    const target = toSlots[i]
    await setSlot(supabase, userId, {
      date: target.slot_date,
      kind: target.slot_kind,
      mealId: source.meal?.id ?? null,
    })
  }
}
