"use server"

import {
  addWeekItem as addWeekItemDomain,
  listWeekIngredients as listWeekIngredientsDomain,
  removeWeekItem as removeWeekItemDomain,
  renameShopItem as renameShopItemDomain,
  toggleShopCheck as toggleShopCheckDomain,
  type ShopLine,
  type ShoppingScope,
} from "@/lib/domain/shopping"
import { requireScopedContext, revalidateApp } from "@/lib/actions/session"

function toShoppingScope(
  scope: { type: "personal" | "family"; familyId: string | null },
  authUid: string
): ShoppingScope {
  if (scope.type === "family" && scope.familyId) {
    return { type: "family", familyId: scope.familyId, userId: authUid }
  }
  return { type: "personal", userId: authUid }
}

export async function listWeekIngredients(
  weekStart: string
): Promise<ShopLine[]> {
  const { supabase, authUid, scope } = await requireScopedContext()
  return listWeekIngredientsDomain(supabase, toShoppingScope(scope, authUid), weekStart)
}

export async function toggleShopCheck(input: {
  weekStart: string
  ingredientId: string
  checked: boolean
}): Promise<void> {
  const { supabase, authUid, scope } = await requireScopedContext()
  await toggleShopCheckDomain(supabase, toShoppingScope(scope, authUid), input)
  revalidateApp()
}

export async function renameShopItem(input: {
  ingredientId: string
  name: string
}): Promise<{ name: string }> {
  const { supabase, authUid, scope } = await requireScopedContext()
  const result = await renameShopItemDomain(
    supabase,
    toShoppingScope(scope, authUid),
    input
  )
  revalidateApp()
  return result
}

export async function addWeekItem(input: {
  weekStart: string
  name: string
}): Promise<ShopLine> {
  const { supabase, authUid, scope } = await requireScopedContext()
  const line = await addWeekItemDomain(
    supabase,
    toShoppingScope(scope, authUid),
    input
  )
  revalidateApp()
  return line
}

export async function removeWeekItem(input: {
  weekStart: string
  ingredientId: string
}): Promise<void> {
  const { supabase, authUid, scope } = await requireScopedContext()
  await removeWeekItemDomain(
    supabase,
    toShoppingScope(scope, authUid),
    input
  )
  revalidateApp()
}
