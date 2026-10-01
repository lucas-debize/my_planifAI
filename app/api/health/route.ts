import { NextResponse } from "next/server"
import { getSupabasePublicConfig } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = getSupabasePublicConfig()
  let database = "not_configured"

  if (config) {
    try {
      const res = await fetch(`${baseUrl}/rest/v1/meals?select=count`, {
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      })
      database = res.ok ? "connected" : `error_${res.status}`
    } catch {
      database = "unreachable"
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database,
  })
}
