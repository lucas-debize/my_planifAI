import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  FamilyRow,
  FamilyMemberRow,
  Json,
} from "@/lib/database.types"

type Client = SupabaseClient<Database>

function mapFamilyError(
  error: { message: string } | null,
  fallback: string
): string {
  const message = error?.message ?? fallback
  if (
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message) ||
    /infinite recursion/i.test(message)
  ) {
    return "La base n’est pas à jour. Exécute supabase/migrations/003_fix_family_rls.sql dans l’éditeur SQL Supabase, puis réessaie."
  }
  return message
}

export type FamilyInfo = {
  family: FamilyRow
  members: FamilyMemberRow[]
  isAdmin: boolean
}

type FamilyPayload = {
  family?: FamilyRow | null
  members?: FamilyMemberRow[] | null
}

function parseFamilyPayload(data: Json | null): FamilyPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  return data as FamilyPayload
}

/**
 * Return the family of the given user, or null if not in any group.
 * Uses the real auth uid (not effective).
 */
export async function getMyFamily(
  supabase: Client,
  authUid: string
): Promise<FamilyInfo | null> {
  const { data, error } = await supabase.rpc("get_my_family")
  if (error || !data) return null

  const payload = parseFamilyPayload(data)
  if (!payload?.family) return null

  const members = payload.members ?? []
  return {
    family: payload.family,
    members,
    isAdmin: members.some(
      (member) => member.user_id === authUid && member.role === "admin"
    ),
  }
}

/**
 * Create a new family group. The caller becomes admin.
 * Runs as SECURITY DEFINER so RLS on family_members cannot recurse.
 */
export async function createFamily(
  supabase: Client,
  _authUid: string,
  name: string,
  displayName: string
): Promise<FamilyRow> {
  const { data: family, error } = await supabase.rpc("create_family", {
    family_name: name.trim(),
    member_name: displayName,
  })

  if (error || !family) throw new Error(mapFamilyError(error, "Erreur création"))
  return family
}

/**
 * Join a family using an invite code.
 */
export async function joinFamily(
  supabase: Client,
  _authUid: string,
  inviteCode: string,
  displayName: string
): Promise<FamilyRow> {
  const { data: family, error } = await supabase.rpc("join_family", {
    invite: inviteCode.trim().toLowerCase(),
    member_name: displayName,
  })

  if (error || !family) throw new Error(mapFamilyError(error, "Erreur"))
  return family
}

/**
 * Leave current family group.
 */
export async function leaveFamily(
  supabase: Client
): Promise<void> {
  const { error } = await supabase.rpc("leave_family")
  if (error) throw new Error(mapFamilyError(error, error.message))
}

/**
 * Delete a family (admin only — CASCADE deletes all memberships).
 */
export async function deleteFamily(
  supabase: Client
): Promise<void> {
  const { error } = await supabase.rpc("delete_family")
  if (error) throw new Error(mapFamilyError(error, error.message))
}
