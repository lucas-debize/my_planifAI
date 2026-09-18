import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ""

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirectTo.pathname = "/semaine"
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = "/connexion"
  redirectTo.searchParams.set("erreur", "1")
  return NextResponse.redirect(redirectTo)
}
