import { AuthScreen } from "@/components/auth-screen"
import { listSavedAccounts } from "@/lib/accounts/vault"
import { isDevBypassAllowed } from "@/lib/dev/config"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const { erreur } = await searchParams
  return (
    <AuthScreen
      error={erreur === "1"}
      supabaseReady={isSupabaseConfigured()}
      devBypass={isDevBypassAllowed()}
      savedAccounts={await listSavedAccounts()}
    />
  )
}
