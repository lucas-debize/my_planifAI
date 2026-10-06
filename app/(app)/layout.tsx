import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/server"
import { getPlanningScope } from "@/lib/actions/session"
export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/connexion")
  const scope = await getPlanningScope()
  return <AppShell scope={scope}>{children}</AppShell>
}
