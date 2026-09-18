import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function requireUser(): Promise<{
  supabase: SupabaseClient<Database>
  userId: string
}> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId || typeof userId !== "string") {
    throw new Error("UNAUTHENTICATED")
  }
  return { supabase, userId }
}

export function revalidateApp() {
  revalidatePath("/", "layout")
}
