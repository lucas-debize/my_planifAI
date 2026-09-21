export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""
  if (!url || !key) return null
  return { url, key }
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null
}

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
}

export function getPublicAppOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // ignore malformed env and fall back to the request origin
    }
  }
  return new URL(request.url).origin
}

export function safeAppPath(value: string | null, fallback = "/semaine"): string {
  if (!value) return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback
  }
  return value
}
