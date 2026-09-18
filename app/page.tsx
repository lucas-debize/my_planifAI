import { redirect } from "next/navigation"
import { AuthScreen } from "@/components/auth-screen"
import { createClient } from "@/lib/supabase/server"
import { isDevBypassAllowed } from "@/lib/dev/config"

export default async function HomePage() {
  if (isDevBypassAllowed()) {
    redirect("/auth/dev")
  }
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    if (data?.claims) redirect("/semaine")
  } catch {
    // Missing env or expired session: show the auth screen.
  }
  return <AuthScreen />
}
