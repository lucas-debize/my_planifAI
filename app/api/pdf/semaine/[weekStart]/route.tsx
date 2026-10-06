import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { WeekDocument } from "@/components/pdf/week-document"
import { createClient } from "@/lib/supabase/server"
import { getWeekSlots } from "@/lib/domain/slots"
import { getPlanningScope } from "@/lib/actions/session"
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
  const scope = await getPlanningScope()
  const slotScope =
    scope.type === "family" && scope.familyId
      ? { type: "family" as const, familyId: scope.familyId, userId }
      : { type: "personal" as const, userId }
  const slots = await getWeekSlots(supabase, slotScope, weekStart)
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
