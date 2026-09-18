import { CardSkeleton } from "@/components/empty-state"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-8">
      <div className="h-10 w-48 animate-pulse rounded-md bg-surface" />
      <CardSkeleton className="h-40" />
      <CardSkeleton className="h-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
      </div>
    </div>
  )
}
