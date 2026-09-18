import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { DEV_COOKIE, isDevSessionValue } from "@/lib/dev/config"

const PUBLIC_PATHS = new Set(["/", "/connexion"])

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith("/auth/callback")) return true
  if (pathname.startsWith("/auth/confirm")) return true
  if (pathname.startsWith("/auth/dev")) return true
  return false
}

function copySession(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie)
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
  return to
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { pathname } = request.nextUrl
  if (pathname === "/aujourdhui" || pathname.startsWith("/aujourdhui/")) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/semaine"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  const devUser = isDevSessionValue(request.cookies.get(DEV_COOKIE)?.value)

  if (devUser) {
    if (pathname === "/connexion") {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/semaine"
      redirectUrl.search = ""
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    if (!isPublicPath(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/connexion"
      redirectUrl.search = ""
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([headerKey, value]) =>
          supabaseResponse.headers.set(headerKey, value)
        )
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/connexion"
    redirectUrl.search = ""
    return copySession(supabaseResponse, NextResponse.redirect(redirectUrl))
  }

  if (user && pathname === "/connexion") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/semaine"
    redirectUrl.search = ""
    return copySession(supabaseResponse, NextResponse.redirect(redirectUrl))
  }

  return supabaseResponse
}
