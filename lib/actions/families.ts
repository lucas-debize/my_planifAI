"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentIdentity } from "@/lib/accounts/identity"
import {
  createFamily as createFamilyDomain,
  joinFamily as joinFamilyDomain,
  leaveFamily as leaveFamilyDomain,
  deleteFamily as deleteFamilyDomain,
} from "@/lib/domain/families"

async function authUid(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const uid = data?.claims?.sub
  if (!uid || typeof uid !== "string") throw new Error("UNAUTHENTICATED")
  return uid
}

async function displayName(): Promise<string> {
  const identity = await getCurrentIdentity()
  return identity?.name || identity?.email || "Membre"
}

export async function createFamilyAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const name = formData.get("name")
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "Choisis un nom pour le groupe" }
  }
  try {
    const uid = await authUid()
    const supabase = await createClient()
    await createFamilyDomain(supabase, uid, name, await displayName())
    revalidatePath("/", "layout")
    return null
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" }
  }
}

export async function joinFamilyAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const code = formData.get("code")
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return { error: "Entre un code d\u2019invitation" }
  }
  try {
    const uid = await authUid()
    const supabase = await createClient()
    await joinFamilyDomain(supabase, uid, code, await displayName())
    revalidatePath("/", "layout")
    return null
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" }
  }
}

export async function leaveFamilyAction(): Promise<void> {
  const uid = await authUid()
  const supabase = await createClient()
  await leaveFamilyDomain(supabase, uid)
  revalidatePath("/", "layout")
}

export async function deleteFamilyAction(): Promise<void> {
  const uid = await authUid()
  const supabase = await createClient()
  await deleteFamilyDomain(supabase, uid)
  revalidatePath("/", "layout")
}
