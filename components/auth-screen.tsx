"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { isEmailRateLimited } from "@/lib/errors"

export function AuthScreen({
  error,
  devBypass = false,
}: {
  error?: boolean
  devBypass?: boolean
}) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState<"google" | "email" | null>(null)

  useEffect(() => {
    if (error) {
      toast.error("Connexion impossible. Réessaie.")
    }
  }, [error])

  async function continueWithGoogle() {
    setPending("google")
    try {
      const supabase = createClient()
      const origin = window.location.origin
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      })
      if (oauthError) throw oauthError
    } catch {
      toast.error("Connexion impossible. Réessaie.")
      setPending(null)
    }
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault()
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
        <h1 className="font-fraunces text-4xl text-ink">PlanifIA</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Déjeuner et dîner, semaine après semaine.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {devBypass ? (
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full min-h-12">
                <a href="/auth/dev">Continuer en mode développement</a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Compte local : dev@planifia.local
              </p>
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full min-h-12"
            onClick={continueWithGoogle}
            disabled={pending !== null}
          >
            Continuer avec Google
          </Button>

          <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
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
