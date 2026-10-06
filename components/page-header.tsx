import Link from "next/link"
import { ArrowLeft, UserRound } from "lucide-react"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
export function PageHeader({
  title,
  actions,
  backHref,
  backLabel = "Retour",
  hideAccount = false,
}: {
  title: string
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  hideAccount?: boolean
}) {
  const showAccount = !hideAccount && title !== "Compte"

  return (
    <header className="flex items-center gap-2 px-4 py-4 sm:gap-3 md:px-8">
      {backHref ? (
        <Link
          href={backHref}
          className="tap-press inline-flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] text-ink hover:bg-muted"
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate font-fraunces text-xl text-ink sm:text-2xl md:text-3xl">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <WorkspaceSwitcher compact className="md:hidden" />
        {showAccount ? (
          <Link
            href="/compte"
            className="tap-press inline-flex size-10 items-center justify-center rounded-[0.75rem] text-ink hover:bg-muted sm:size-12 md:hidden"
            aria-label="Compte"
          >
            <UserRound className="size-5" />
          </Link>
        ) : null}
      </div>
    </header>
  )
}
