import Link from "next/link"
import { UserRound } from "lucide-react"

export function PageHeader({
  title,
  actions,
}: {
  title: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-3 px-4 py-4 md:px-8">
      <h1 className="min-w-0 flex-1 font-fraunces text-2xl text-ink md:text-3xl">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Link
          href="/compte"
          className="inline-flex size-12 items-center justify-center rounded-[0.75rem] text-ink hover:bg-muted md:hidden"
          aria-label="Compte"
        >
          <UserRound className="size-5" />
        </Link>
      </div>
    </header>
  )
}
