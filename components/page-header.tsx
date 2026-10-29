import Link from "next/link"
import { ArrowLeft, UserRound } from "lucide-react"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
export function PageHeader({
  title,
  actions,
  backHref,
  backLabel = "Retour",
  showWorkspace = true,
}: {
  title: string
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  hideAccount?: boolean
  showWorkspace?: boolean
}) {
  const isRootPage = !backHref && showWorkspace && title !== "Compte"

  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-8 border-b border-line bg-bg">
      <div className="flex min-w-0 items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            prefetch={true}
            className="tap-press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:bg-muted shadow-2xs transition-colors"
            aria-label={backLabel}
          >
            <ArrowLeft className="size-4.5" />
          </Link>
        ) : null}
        <h1 className="truncate font-sans text-xl font-bold tracking-tight text-ink sm:text-2xl md:text-3xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isRootPage ? (
          <WorkspaceSwitcher compact className="shrink-0" />
        ) : null}
        {actions ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
