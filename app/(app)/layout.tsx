import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/connexion")
  return <AppShell>{children}</AppShell>
}
