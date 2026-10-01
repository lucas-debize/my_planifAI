"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleMark } from "@/components/google-mark"
import { switchAccount } from "@/lib/actions/accounts"
import type { SavedAccount } from "@/lib/accounts/vault"
import { createClient } from "@/lib/supabase/client"
import { isEmailRateLimited } from "@/lib/errors"

export function AuthScreen({
  error,
  devBypass = false,
  supabaseReady = false,
  savedAccounts = [],
}: {
  error?: boolean
  devBypass?: boolean
  supabaseReady?: boolean
  savedAccounts?: SavedAccount[]
}) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState<"email" | null>(null)

  useEffect(() => {
    if (error) {
      toast.error("Connexion impossible. Réessaie.")
    }
  }, [error])

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault()
    if (!supabaseReady) return
    setPending("email")
    try {
      const supabase = createClient()
      const origin = window.location.origin
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${origin}/auth/callback` },
      })
      if (otpError) {
        if (isEmailRateLimited(otpError)) {
          toast.error("E-mail momentanément indisponible. Utilise Google.")
        } else {
          toast.error("Connexion impossible. Réessaie.")
        }
        return
      }
      setSent(true)
    } catch {
      toast.error("Connexion impossible. Réessaie.")
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-fraunces text-4xl text-ink">MyPlanifAI</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Déjeuner et dîner, semaine après semaine.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {savedAccounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Comptes sur cet appareil
              </p>
              {savedAccounts.map((account) => (
                <form key={account.id} action={switchAccount}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full min-h-12 justify-start"
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {account.email}
                    </span>
                  </Button>
                </form>
              ))}
              <p className="text-sm text-muted-foreground">ou un autre compte</p>
            </div>
          ) : null}

          {supabaseReady ? (
            <Button asChild className="w-full min-h-12">
              <a href="/auth/google">
                <GoogleMark />
                Continuer avec Google
              </a>
            </Button>
          ) : (
            <Button type="button" className="w-full min-h-12" disabled>
              <GoogleMark />
              Continuer avec Google
            </Button>
          )}
          {!supabaseReady ? (
            <p className="text-sm text-muted-foreground">
              Ajoute l’URL et la clé publique Supabase dans `.env.local` pour
              activer Google.
            </p>
          ) : null}

          {devBypass ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full min-h-12">
                <a href="/auth/dev">Continuer en mode développement</a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Compte local : dev@planifia.local — hors de ton espace Google.
              </p>
            </div>
          ) : null}

          {supabaseReady ? (
            <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Ou par e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setSent(false)
                  }}
                  placeholder="toi@exemple.fr"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full min-h-12"
                disabled={pending !== null || email.trim().length === 0}
              >
                Recevoir un lien de connexion
              </Button>
            </form>
          ) : null}

          {sent ? (
            <p className="text-sm text-muted-foreground" role="status">
              Lien envoyé. Ouvre-le sur cet appareil.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
