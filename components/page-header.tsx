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
    <header className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8 border-b border-line/40 bg-bg">
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
        <div className="flex min-w-0 items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              prefetch={true}
              className="tap-press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-surface text-ink hover:bg-muted shadow-2xs transition-colors"
              aria-label={backLabel}
            >
              <ArrowLeft className="size-4.5" />
            </Link>
          ) : null}
          <h1 className="truncate font-fraunces text-xl font-bold tracking-tight text-ink sm:text-2xl md:text-3xl subpixel-antialiased">
            {title}
          </h1>
        </div>
        {isRootPage ? (
          <WorkspaceSwitcher compact className="sm:hidden shrink-0" />
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
