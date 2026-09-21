import { redirect } from "next/navigation"
import { AuthScreen } from "@/components/auth-screen"
import { listSavedAccounts } from "@/lib/accounts/vault"
import { createClient } from "@/lib/supabase/server"
import { isDevBypassAllowed } from "@/lib/dev/config"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    if (data?.claims) redirect("/semaine")
  } catch {
    // Missing env or expired session: show the auth screen.
  }
  return (
    <AuthScreen
      supabaseReady={isSupabaseConfigured()}
      devBypass={isDevBypassAllowed()}
      savedAccounts={await listSavedAccounts()}
    />
  )
}
