import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { WeekDocument } from "@/components/pdf/week-document"
import { createClient } from "@/lib/supabase/server"
import { getWeekSlots } from "@/lib/domain/slots"
import { isMonday, parseISODate, weekLabel } from "@/lib/dates"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ weekStart: string }> }
) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId || typeof userId !== "string") {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { weekStart } = await context.params
  const parsed = parseISODate(weekStart)
  if (!parsed || !isMonday(parsed)) {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const slots = await getWeekSlots(supabase, userId, weekStart)

  const buffer = await renderToBuffer(
    <WeekDocument weekLabel={weekLabel(parsed)} slots={slots} />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="planifia-${weekStart}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
