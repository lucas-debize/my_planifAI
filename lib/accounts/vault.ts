import { cookies } from "next/headers"
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/env"

export const ACCOUNTS_COOKIE = "planifia-accounts"
export const RT_COOKIE_PREFIX = "planifia-rt."
export const MAX_SAVED_ACCOUNTS = 5

export type AccountProvider = "google" | "email" | "dev"

export type SavedAccount = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  provider: AccountProvider
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400
const MAX_TOKEN_LENGTH = 3500

function cookieOptions() {
  return {
    ...AUTH_COOKIE_OPTIONS,
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
  }
}

export function refreshTokenCookieName(userId: string) {
  return `${RT_COOKIE_PREFIX}${userId.replace(/[^a-zA-Z0-9-]/g, "")}`
}

export function isAccountId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}

export function isEmailAddress(
  value: string | null | undefined
): value is string {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && value.length <= 500
  } catch {
    return false
  }
}

function sanitizeProvider(value: unknown): AccountProvider {
  if (value === "google" || value === "email" || value === "dev") return value
  return "email"
}

export function sanitizeAccount(raw: unknown): SavedAccount | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  if (typeof value.id !== "string" || !isAccountId(value.id)) return null
  if (typeof value.email !== "string" || !isEmailAddress(value.email)) {
    return null
  }
  const name =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim().slice(0, 80)
      : null
  const avatarUrl =
    typeof value.avatarUrl === "string" && isHttpsUrl(value.avatarUrl)
      ? value.avatarUrl
      : null
  return {
    id: value.id,
    email: value.email.trim(),
    name,
    avatarUrl,
    provider: sanitizeProvider(value.provider),
  }
}

function parseVault(raw: string | undefined): SavedAccount[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { v?: number; accounts?: unknown }
    if (!Array.isArray(parsed.accounts)) return []
    const accounts: SavedAccount[] = []
    for (const item of parsed.accounts) {
      const account = sanitizeAccount(item)
      if (account && !accounts.some((entry) => entry.id === account.id)) {
        accounts.push(account)
      }
      if (accounts.length >= MAX_SAVED_ACCOUNTS) break
    }
    return accounts
  } catch {
    return []
  }
}

function serializeVault(accounts: SavedAccount[]) {
  return JSON.stringify({
    v: 1,
    accounts: accounts.slice(0, MAX_SAVED_ACCOUNTS),
  })
}

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  const cookieStore = await cookies()
  return parseVault(cookieStore.get(ACCOUNTS_COOKIE)?.value)
}

export async function readRefreshToken(userId: string): Promise<string | null> {
  if (!isAccountId(userId)) return null
  const cookieStore = await cookies()
  const value = cookieStore.get(refreshTokenCookieName(userId))?.value?.trim()
  return value || null
}

export async function upsertSavedAccount(
  account: SavedAccount,
  refreshToken?: string | null
) {
  const clean = sanitizeAccount(account)
  if (!clean) return
  const cookieStore = await cookies()
  const current = parseVault(cookieStore.get(ACCOUNTS_COOKIE)?.value)
  const next = [
    clean,
    ...current.filter((entry) => entry.id !== clean.id),
  ].slice(0, MAX_SAVED_ACCOUNTS)
  cookieStore.set(ACCOUNTS_COOKIE, serializeVault(next), cookieOptions())
  if (
    refreshToken &&
    refreshToken.length > 0 &&
    refreshToken.length < MAX_TOKEN_LENGTH
  ) {
    cookieStore.set(
      refreshTokenCookieName(clean.id),
      refreshToken,
      cookieOptions()
    )
  }
}

export async function removeSavedAccount(userId: string) {
  const cookieStore = await cookies()
  const next = parseVault(cookieStore.get(ACCOUNTS_COOKIE)?.value).filter(
    (entry) => entry.id !== userId
  )
  if (next.length === 0) {
    cookieStore.delete(ACCOUNTS_COOKIE)
  } else {
    cookieStore.set(ACCOUNTS_COOKIE, serializeVault(next), cookieOptions())
  }
  cookieStore.delete(refreshTokenCookieName(userId))
}

export async function clearSavedAccounts() {
  const cookieStore = await cookies()
  const accounts = parseVault(cookieStore.get(ACCOUNTS_COOKIE)?.value)
  cookieStore.delete(ACCOUNTS_COOKIE)
  for (const account of accounts) {
    cookieStore.delete(refreshTokenCookieName(account.id))
  }
}
