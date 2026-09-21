import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"
import { DEV_COOKIE, isDevSessionValue } from "@/lib/dev/config"
import {
  createDevClient,
  createUnauthenticatedClient,
} from "@/lib/dev/client"
import { AUTH_COOKIE_OPTIONS, getSupabasePublicConfig } from "@/lib/supabase/env"

export async function createHostedServerClient() {
  const config = getSupabasePublicConfig()
  if (!config) return null

  const cookieStore = await cookies()
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...AUTH_COOKIE_OPTIONS,
              ...options,
            })
          )
        } catch {
          // Proxy refreshes the session; Server Components cannot set cookies.
        }
      },
    },
  })
}

export async function createClient() {
  const cookieStore = await cookies()
  if (isDevSessionValue(cookieStore.get(DEV_COOKIE)?.value)) {
    return createDevClient()
  }
  return (await createHostedServerClient()) ?? createUnauthenticatedClient()
}
