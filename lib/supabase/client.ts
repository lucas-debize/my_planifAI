import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/database.types"
import { AUTH_COOKIE_OPTIONS, getSupabasePublicConfig } from "@/lib/supabase/env"

export function createClient() {
  const config = getSupabasePublicConfig()
  if (!config) {
    throw new Error("Supabase n’est pas configuré")
  }
  return createBrowserClient<Database>(config.url, config.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
  })
}
