"use server"

import {
  addWeekItem as addWeekItemDomain,
  listWeekIngredients as listWeekIngredientsDomain,
  removeWeekItem as removeWeekItemDomain,
  renameShopItem as renameShopItemDomain,
  toggleShopCheck as toggleShopCheckDomain,
  type ShopLine,
} from "@/lib/domain/shopping"
import { requireUser, revalidateApp } from "@/lib/actions/session"

export async function listWeekIngredients(
  weekStart: string
): Promise<ShopLine[]> {
  const { supabase, userId } = await requireUser()
  return listWeekIngredientsDomain(supabase, userId, weekStart)
}

export async function toggleShopCheck(input: {
  weekStart: string
  ingredientId: string
  checked: boolean
}): Promise<void> {
  const { supabase, userId } = await requireUser()
  await toggleShopCheckDomain(supabase, userId, input)
  revalidateApp()
}

export async function renameShopItem(input: {
  ingredientId: string
  name: string
}): Promise<{ name: string }> {
  const { supabase, userId } = await requireUser()
  const result = await renameShopItemDomain(supabase, userId, input)
  revalidateApp()
  return result
}

export async function addWeekItem(input: {
  weekStart: string
  name: string
}): Promise<ShopLine> {
  const { supabase, userId } = await requireUser()
  const line = await addWeekItemDomain(supabase, userId, input)
  revalidateApp()
  return line
}

export async function removeWeekItem(input: {
  weekStart: string
  ingredientId: string
}): Promise<void> {
  const { supabase, userId } = await requireUser()
  await removeWeekItemDomain(supabase, userId, input)
  revalidateApp()
}
