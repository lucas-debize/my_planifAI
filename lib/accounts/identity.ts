import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"
import {
  sanitizeAccount,
  upsertSavedAccount,
  type AccountProvider,
  type SavedAccount,
} from "@/lib/accounts/vault"
import {
  DEV_COOKIE,
  DEV_USER_EMAIL,
  DEV_USER_ID,
  isDevBypassAllowed,
  isDevSessionValue,
} from "@/lib/dev/config"
import { createClient, createHostedServerClient } from "@/lib/supabase/server"

export const DEV_ACCOUNT: SavedAccount = {
  id: DEV_USER_ID,
  email: DEV_USER_EMAIL,
  name: "Développement local",
  avatarUrl: null,
  provider: "dev",
}

function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function providerFromMetadata(
  appMetadata: Record<string, unknown> | undefined
): AccountProvider {
  const provider = textField(appMetadata?.provider)
  const providers = appMetadata?.providers
  if (provider === "google") return "google"
  if (Array.isArray(providers) && providers.includes("google")) return "google"
  if (provider === "dev") return "dev"
  return "email"
}

export function accountFromUser(user: User): SavedAccount | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const email = textField(user.email) ?? textField(meta.email)
  if (!email) return null
  return sanitizeAccount({
    id: user.id,
    email,
    name: textField(meta.full_name) ?? textField(meta.name),
    avatarUrl: textField(meta.avatar_url) ?? textField(meta.picture),
    provider: providerFromMetadata(
      user.app_metadata as Record<string, unknown>
    ),
  })
}

function accountFromClaims(
  claims: Record<string, unknown> | null | undefined
) {
  if (!claims) return null
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const email = textField(claims.email) ?? textField(meta.email)
  const id = textField(claims.sub)
  if (!email || !id) return null
  return sanitizeAccount({
    id,
    email,
    name: textField(meta.full_name) ?? textField(meta.name),
    avatarUrl: textField(meta.avatar_url) ?? textField(meta.picture),
    provider: providerFromMetadata(
      claims.app_metadata as Record<string, unknown>
    ),
  })
}

export async function getCurrentIdentity(): Promise<SavedAccount | null> {
  const cookieStore = await cookies()
  if (isDevSessionValue(cookieStore.get(DEV_COOKIE)?.value)) {
    return DEV_ACCOUNT
  }

  const supabase = await createClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const fromUser = sessionData.session?.user
    ? accountFromUser(sessionData.session.user)
    : null
  if (fromUser) return fromUser

  const { data } = await supabase.auth.getClaims()
  return accountFromClaims(data?.claims as Record<string, unknown> | undefined)
}

export async function rememberCurrentAccount() {
  const cookieStore = await cookies()
  if (
    isDevSessionValue(cookieStore.get(DEV_COOKIE)?.value) &&
    isDevBypassAllowed()
  ) {
    await upsertSavedAccount(DEV_ACCOUNT)
  }

  const hosted = await createHostedServerClient()
  if (!hosted) return
  const { data } = await hosted.auth.getSession()
  const session = data.session
  if (!session?.user) return
  const account = accountFromUser(session.user)
  if (!account) return
  await upsertSavedAccount(account, session.refresh_token)
}
