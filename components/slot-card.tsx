"use client"

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
        "tap-press flex w-full flex-col items-start rounded-[1rem] text-left",
        past ? "slot-past" : filled ? (isReste ? "slot-filled border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10" : "slot-filled") : "slot-empty",
        selected && "slot-selected",
        flash && "slot-flash",
        size === "xl"
          ? "min-h-40 justify-center gap-3 p-6"
          : "min-h-20 gap-1 p-4"
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {isReste ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            🍲 Reste
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "font-fraunces break-words line-clamp-2 leading-snug",
          size === "xl" ? "text-2xl" : "text-base sm:text-lg",
          filled ? "text-ink" : "text-muted-foreground"
        )}
      >
        {mealName ?? "Ajouter"}
      </span>
    </button>
  )
}
