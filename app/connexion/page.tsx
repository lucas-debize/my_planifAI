import { AuthScreen } from "@/components/auth-screen"
import { isDevBypassAllowed } from "@/lib/dev/config"

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const { erreur } = await searchParams
  return (
    <AuthScreen error={erreur === "1"} devBypass={isDevBypassAllowed()} />
  )
}
