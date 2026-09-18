"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DEV_COOKIE, isDevBypassAllowed } from "@/lib/dev/config"

export async function signOut() {
  if (isDevBypassAllowed()) {
    const cookieStore = await cookies()
    cookieStore.delete(DEV_COOKIE)
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/connexion")
}
