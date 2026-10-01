"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getWeekSlots } from "@/lib/actions/slots"
import { parseISODate, weekLabel } from "@/lib/dates"

export function DownloadPdfButton({ weekStart }: { weekStart: string }) {
  const [busy, setBusy] = useState(false)
  const href = `/api/pdf/semaine/${weekStart}`
  const filename = `planifia-${weekStart}.pdf`

  async function downloadFromResponse(response: Response) {
    if (!response.ok) throw new Error("PDF_FAILED")
    const blob = await response.blob()
    if (blob.size === 0 || blob.type.includes("text/html")) {
      throw new Error("PDF_FAILED")
    }
    saveBlob(blob, filename)
  }

  async function downloadClientSide() {
    const monday = parseISODate(weekStart)
    if (!monday) throw new Error("PDF_FAILED")
    const [{ pdf }, { WeekDocument }, slots] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/week-document"),
      getWeekSlots(weekStart),
    ])
    const blob = await pdf(
      <WeekDocument weekLabel={weekLabel(monday)} slots={slots} />
    ).toBlob()
    saveBlob(blob, filename)
  }

  async function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(href)
      await downloadFromResponse(response)
    } catch {
      try {
        await downloadClientSide()
      } catch {
        toast.error("Impossible de créer le PDF. Réessaie.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <a
      href={href}
      download={filename}
      onClick={onClick}
      aria-busy={busy}
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[0.75rem] border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted sm:min-h-12 sm:gap-2 sm:px-4 sm:text-sm"
    >
      {busy ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span className="hidden sm:inline">Préparation…</span>
          <span className="sm:hidden">…</span>
        </>
      ) : (
        <>
          <FileDown className="size-4 shrink-0" />
          <span className="hidden sm:inline">Télécharger le PDF</span>
          <span className="sm:hidden">PDF</span>
        </>
      )}
    </a>
  )
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
