import { NextResponse } from "next/server"
import { isEmailAddress } from "@/lib/accounts/vault"
import { getPublicAppOrigin, safeAppPath } from "@/lib/supabase/env"
import { createHostedServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const origin = getPublicAppOrigin(request)
  const { searchParams } = new URL(request.url)
  const next = safeAppPath(searchParams.get("next"))
  const hintRaw = searchParams.get("hint")
  const hint = isEmailAddress(hintRaw) ? hintRaw : null
  const fail = NextResponse.redirect(`${origin}/connexion?erreur=1`)
  fail.headers.set("Cache-Control", "no-store")

  const supabase = await createHostedServerClient()
  if (!supabase) return fail

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "openid email profile",
      queryParams: {
        prompt: "select_account",
        ...(hint ? { login_hint: hint } : {}),
      },
    },
  })

  if (error || !data.url) return fail

  const response = NextResponse.redirect(data.url)
  response.headers.set("Cache-Control", "no-store")
  return response
}
