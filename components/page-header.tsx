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
    <header className="flex items-center justify-between gap-2 px-4 py-3 md:px-8 border-b border-line/40 bg-bg/50">
      <div className="flex min-w-0 items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            className="tap-press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-surface text-ink hover:bg-muted shadow-2xs transition-colors"
            aria-label={backLabel}
          >
            <ArrowLeft className="size-4.5" />
          </Link>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-fraunces text-xl font-bold tracking-tight text-ink sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {isRootPage ? (
            <WorkspaceSwitcher compact className="md:hidden shrink-0" />
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
