"use server"

import {
  copyWeek as copyWeekDomain,
  getWeekSlots as getWeekSlotsDomain,
  setSlot as setSlotDomain,
  type WeekSlot,
} from "@/lib/domain/slots"
import type { SlotKind } from "@/lib/week"
import { requireUser, revalidateApp } from "@/lib/actions/session"

export async function getWeekSlots(weekStart: string): Promise<WeekSlot[]> {
  const { supabase, userId } = await requireUser()
  return getWeekSlotsDomain(supabase, userId, weekStart)
}

export async function setSlot(input: {
  date: string
  kind: SlotKind
  mealId: string | null
}): Promise<void> {
  const { supabase, userId } = await requireUser()
  await setSlotDomain(supabase, userId, input)
  revalidateApp()
}

export async function copyWeek(input: {
  fromStart: string
  toStart: string
}): Promise<void> {
  const { supabase, userId } = await requireUser()
  await copyWeekDomain(supabase, userId, input)
  revalidateApp()
}
