import Link from "next/link"
import { Button } from "@/components/ui/button"

export function EmptyState({
  message,
  actionLabel,
  actionHref,
  onAction,
}: {
  message: string
  actionLabel: string
  actionHref?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-4 px-4 py-8 md:px-8">
      <p className="max-w-md text-base text-muted-foreground">{message}</p>
      {actionHref ? (
        <Button asChild className="min-h-12">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : (
        <Button type="button" className="min-h-12" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[1rem] bg-surface shadow-card ${className}`}
      aria-hidden
    />
  )
}
