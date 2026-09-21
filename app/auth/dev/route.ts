import { NextResponse } from "next/server"
import { upsertSavedAccount } from "@/lib/accounts/vault"
import { DEV_ACCOUNT } from "@/lib/accounts/identity"
import {
  DEV_COOKIE,
  DEV_USER_ID,
  isDevBypassAllowed,
} from "@/lib/dev/config"

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  if (!isDevBypassAllowed()) {
    return NextResponse.redirect(`${origin}/connexion`)
  }

  const response = NextResponse.redirect(`${origin}/semaine`)
  response.cookies.set(DEV_COOKIE, DEV_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
  })
  await upsertSavedAccount(DEV_ACCOUNT)
  return response
}
