import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { rememberCurrentAccount } from "@/lib/accounts/identity"
import { DEV_COOKIE } from "@/lib/dev/config"
import { getPublicAppOrigin, safeAppPath } from "@/lib/supabase/env"
import { createHostedServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getPublicAppOrigin(request)
  const fail = NextResponse.redirect(`${origin}/connexion?erreur=1`)
  fail.headers.set("Cache-Control", "no-store")

  const code = searchParams.get("code")
  if (!code || searchParams.get("error")) return fail

  const supabase = await createHostedServerClient()
  if (!supabase) return fail

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return fail

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return fail

  const cookieStore = await cookies()
  cookieStore.delete(DEV_COOKIE)
  await rememberCurrentAccount()

  const next = safeAppPath(searchParams.get("next"))
  const response = NextResponse.redirect(`${origin}${next}`)
  response.headers.set("Cache-Control", "no-store")
  return response
}
