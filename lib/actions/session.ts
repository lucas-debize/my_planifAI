import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Returns the authenticated Supabase client and the effective user id.
 * - `userId`: the family owner's id if the caller is in a group,
 *   otherwise the caller's own id.  Use for all data queries.
 * - `authUid`: always the real auth.uid().  Use for identity/family operations.
 */
export async function requireUser(): Promise<{
  supabase: SupabaseClient<Database>
  userId: string
  authUid: string
}> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const authUid = data?.claims?.sub
  if (!authUid || typeof authUid !== "string") {
    throw new Error("UNAUTHENTICATED")
  }
  try {
    const { data: effectiveId } = await supabase.rpc("effective_owner_id")
    if (typeof effectiveId === "string" && effectiveId) {
      return { supabase, userId: effectiveId, authUid }
    }
  } catch {
    // RPC unavailable (dev mode) – fall through
  }
  return { supabase, userId: authUid, authUid }
}

export function revalidateApp() {
  revalidatePath("/", "layout")
}
