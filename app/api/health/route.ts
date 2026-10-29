import { NextResponse } from "next/server"
import { getSupabasePublicConfig } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = getSupabasePublicConfig()
  let database = "not_configured"

  if (config) {
    try {
      const baseUrl = config.url.replace(/\/+$/, "")
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
  let geminiModels: string[] = []
  if (process.env.GEMINI_API_KEY) {
    try {
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (gRes.ok) {
        const gData = await gRes.json()
        geminiModels = (gData?.models || [])
          .map((m: { name?: string }) => (m.name || "").replace("models/", ""))
          .filter((n: string) => n.includes("flash") || n.includes("gemini"))
      } else {
        const errTxt = await gRes.text()
        geminiModels = [`Error ${gRes.status}: ${errTxt.slice(0, 200)}`]
      }
    } catch (gErr) {
      geminiModels = [gErr instanceof Error ? gErr.message : String(gErr)]
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database,
    aiVision: {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      geminiModels,
      glmConfigured: Boolean(process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
  })
}
