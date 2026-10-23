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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line/70 bg-surface/90 p-6 sm:p-8 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2">
          <h1 className="font-fraunces text-3xl font-bold tracking-tight text-ink">PlanifIA</h1>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            2026
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground font-medium">
          Déjeuner et dîner, semaine après semaine.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {savedAccounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comptes sur cet appareil
              </p>
              {savedAccounts.map((account) => (
                <form key={account.id} action={switchAccount}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="tap-press w-full min-h-11 justify-start rounded-xl font-medium"
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-sm">
                      {account.email}
                    </span>
                  </Button>
                </form>
              ))}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line/80" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted-foreground text-[10px] font-bold">ou un autre compte</span></div>
              </div>
            </div>
          ) : null}

          {supabaseReady ? (
            <Button asChild className="tap-press w-full min-h-12 rounded-xl font-semibold shadow-xs">
              <a href="/auth/google">
                <GoogleMark />
                Continuer avec Google
              </a>
            </Button>
          ) : (
            <Button type="button" className="w-full min-h-12 rounded-xl" disabled>
              <GoogleMark />
              Continuer avec Google
            </Button>
          )}
          {!supabaseReady ? (
            <p className="text-xs text-muted-foreground">
              Ajoute l’URL et la clé publique Supabase dans `.env.local` pour activer Google.
            </p>
          ) : null}

          {devBypass ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="tap-press w-full min-h-11 rounded-xl font-medium">
                <a href="/auth/dev">Continuer en mode développement</a>
              </Button>
              <p className="text-[11px] text-muted-foreground">
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
