"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { signOut } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
] as const

function subscribe() {
  return () => {}
}

function useIosInstallHint() {
  return useSyncExternalStore(
    subscribe,
    () => {
      const iOS = /iPad|iPhone|iPod/i.test(window.navigator.userAgent)
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      return iOS && !standalone
    },
    () => false
  )
}

function useHasMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

export function AccountPanel({
  email,
  devAccount = false,
}: {
  email: string | null
  devAccount?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const mounted = useHasMounted()
  const iosHint = useIosInstallHint()

  return (
    <>
      <PageHeader title="Compte" />
      <div className="flex flex-col gap-6 px-4 pb-8 md:max-w-lg md:px-8">
        <p className="text-base text-ink">{email ?? "Compte connecté"}</p>
        {devAccount ? (
          <p className="text-sm text-muted-foreground">
            Compte de développement local. Les données restent dans `.data/` et
            ne sont pas envoyées à Supabase.
          </p>
        ) : null}
        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">Apparence</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "min-h-12 rounded-[0.75rem] border px-3 text-sm",
                  mounted && theme === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-surface"
                )}
                onClick={() => setTheme(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        {iosHint ? (
          <p className="text-sm text-muted-foreground">
            Sur iPhone : Partager → Sur l’écran d’accueil
          </p>
        ) : null}
        <form action={signOut}>
          <Button type="submit" variant="outline" className="min-h-12">
            Déconnexion
          </Button>
        </form>
      </div>
    </>
  )
}
