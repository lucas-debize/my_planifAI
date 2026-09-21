import { type EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { rememberCurrentAccount } from "@/lib/accounts/identity"
import { DEV_COOKIE } from "@/lib/dev/config"
import { createHostedServerClient } from "@/lib/supabase/server"
import { getPublicAppOrigin } from "@/lib/supabase/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = getPublicAppOrigin(request)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  const fail = NextResponse.redirect(`${origin}/connexion?erreur=1`)
  fail.headers.set("Cache-Control", "no-store")

  if (token_hash && type) {
    const supabase = await createHostedServerClient()
    if (!supabase) return fail
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const cookieStore = await cookies()
      cookieStore.delete(DEV_COOKIE)
      await rememberCurrentAccount()
      const ok = NextResponse.redirect(`${origin}/semaine`)
      ok.headers.set("Cache-Control", "no-store")
      return ok
    }
  }

  return fail
}
