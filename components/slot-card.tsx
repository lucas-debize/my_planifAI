"use client"

import { Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePress } from "@/hooks/use-press"
export function SlotCard({
  label,
  mealName,
  onClick,
  size = "md",
  past = false,
  selected = false,
  flash = false,
}: {
  label: string
  mealName: string | null
  onClick: () => void
  size?: "md" | "xl"
  past?: boolean
  selected?: boolean
  flash?: boolean
}) {
  const filled = Boolean(mealName)
  const isReste = mealName ? /^reste\b/i.test(mealName.trim()) : false
  const { pressProps } = usePress()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      {...pressProps}
      className={cn(
        "tap-press flex w-full flex-col items-start rounded-2xl text-left transition-all group",
        past ? "slot-past opacity-75" : filled ? (isReste ? "slot-filled border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs" : "slot-filled shadow-xs") : "slot-empty hover:border-primary/60",
        selected && "slot-selected ring-2 ring-mark",
        flash && "slot-flash",
        size === "xl"
          ? "min-h-40 justify-center gap-3 p-6"
          : "min-h-[4.75rem] gap-1.5 p-3.5 sm:p-4"
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">{label}</span>
        {isReste ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            🍲 Reste
          </span>
        ) : null}
      </div>
      {filled ? (
        <span
          className={cn(
            "font-fraunces font-bold tracking-tight text-ink break-words line-clamp-2 leading-snug",
            size === "xl" ? "text-2xl" : "text-base sm:text-lg"
          )}
        >
          {mealName}
        </span>
      ) : (
        <div className="flex items-center gap-2 py-1 text-muted-foreground/80 font-medium text-xs sm:text-sm group-hover:text-primary transition-colors">
          <div className="flex size-5.5 items-center justify-center rounded-full border border-dashed border-line-active bg-primary/5 text-primary group-hover:border-primary group-hover:scale-110 transition-all">
            <Plus className="size-3" />
          </div>
          <span>Ajouter</span>
        </div>
      )}
    </button>
  )
}
