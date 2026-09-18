import { AccountPanel } from "@/components/account-panel"
import { createClient } from "@/lib/supabase/server"
import { DEV_USER_EMAIL, isDevBypassAllowed } from "@/lib/dev/config"

export const dynamic = "force-dynamic"

export default async function ComptePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null
  return (
    <AccountPanel
      email={email}
      devAccount={isDevBypassAllowed() && email === DEV_USER_EMAIL}
    />
  )
}
