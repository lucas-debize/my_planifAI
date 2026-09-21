"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  DEV_ACCOUNT,
  accountFromUser,
  getCurrentIdentity,
  rememberCurrentAccount,
} from "@/lib/accounts/identity"
import {
  clearSavedAccounts,
  isAccountId,
  isEmailAddress,
  listSavedAccounts,
  readRefreshToken,
  removeSavedAccount,
  upsertSavedAccount,
} from "@/lib/accounts/vault"
import { revalidateApp } from "@/lib/actions/session"
import {
  DEV_COOKIE,
  DEV_USER_ID,
  isDevBypassAllowed,
} from "@/lib/dev/config"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createHostedServerClient } from "@/lib/supabase/server"

function googleLoginPath(email?: string | null, next = "/semaine") {
  const params = new URLSearchParams()
  params.set("next", next)
  if (email && isEmailAddress(email)) params.set("hint", email)
  return `/auth/google?${params.toString()}`
}

async function activateDevAccount() {
  if (!isDevBypassAllowed()) {
    await removeSavedAccount(DEV_USER_ID)
    return false
  }
  const cookieStore = await cookies()
  cookieStore.set(DEV_COOKIE, DEV_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
  })
  await upsertSavedAccount(DEV_ACCOUNT)
  return true
}

async function activateHostedAccount(accountId: string, email: string) {
  const refreshToken = await readRefreshToken(accountId)
  if (!refreshToken) {
    redirect(googleLoginPath(email))
  }

  const cookieStore = await cookies()
  cookieStore.delete(DEV_COOKIE)

  const supabase = await createHostedServerClient()
  if (!supabase) {
    redirect(googleLoginPath(email))
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  })
  if (error || !data.session) {
    await removeSavedAccount(accountId)
    redirect(googleLoginPath(email))
  }

  const updated = accountFromUser(data.session.user)
  if (updated) {
    await upsertSavedAccount(updated, data.session.refresh_token)
  }
}

export async function switchAccount(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "")
  if (!isAccountId(accountId)) {
    redirect("/connexion?erreur=1")
  }

  const current = await getCurrentIdentity()
  if (current?.id === accountId) {
    redirect("/semaine")
  }

  await rememberCurrentAccount()
  const saved = await listSavedAccounts()
  const target = saved.find((account) => account.id === accountId)
  if (!target) {
    redirect("/connexion?erreur=1")
  }

  if (target.provider === "dev") {
    const ok = await activateDevAccount()
    if (!ok) redirect("/connexion?erreur=1")
  } else {
    await activateHostedAccount(target.id, target.email)
  }

  revalidateApp()
  redirect("/semaine")
}

export async function addGoogleAccount() {
  await rememberCurrentAccount()
  if (!isSupabaseConfigured()) {
    redirect("/compte")
  }
  redirect(googleLoginPath(null, "/compte"))
}

export async function rememberAccount() {
  await rememberCurrentAccount()
}


export async function signOut() {
  const current = await getCurrentIdentity()
  await rememberCurrentAccount()
  const others = (await listSavedAccounts()).filter(
    (account) => account.id !== current?.id
  )

  const cookieStore = await cookies()
  const hosted = await createHostedServerClient()

  if (current?.provider === "dev") {
    cookieStore.delete(DEV_COOKIE)
  } else if (hosted) {
    await hosted.auth.signOut({
      scope: others.length > 0 ? "local" : "global",
    })
  }

  if (current) await removeSavedAccount(current.id)

  const next = others[0]
  if (next) {
    if (next.provider === "dev") {
      const ok = await activateDevAccount()
      if (!ok) redirect("/connexion")
    } else {
      await activateHostedAccount(next.id, next.email)
    }
    revalidateApp()
    redirect("/semaine")
  }

  redirect("/connexion")
}

export async function signOutAll() {
  const hosted = await createHostedServerClient()
  if (hosted) {
    await hosted.auth.signOut({ scope: "global" })
  }
  const cookieStore = await cookies()
  cookieStore.delete(DEV_COOKIE)
  await clearSavedAccounts()
  revalidateApp()
  redirect("/connexion")
}
