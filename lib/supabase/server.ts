import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"
import { DEV_COOKIE, isDevSessionValue } from "@/lib/dev/config"
import {
  createDevClient,
  createUnauthenticatedClient,
} from "@/lib/dev/client"

export async function createClient() {
  const cookieStore = await cookies()
  if (isDevSessionValue(cookieStore.get(DEV_COOKIE)?.value)) {
    return createDevClient()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return createUnauthenticatedClient()
  }

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Proxy refreshes the session; Server Components cannot set cookies.
          }
        },
      },
    }
  )
}
