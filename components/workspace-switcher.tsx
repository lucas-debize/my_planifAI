"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Check, ChevronDown, Plus, User, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { switchPlanningScopeAction } from "@/lib/actions/session"
import type { PlanningScope } from "@/lib/domain/session"
import { useWorkspace } from "@/components/workspace-context"
import { cn } from "@/lib/utils"

export function WorkspaceSwitcher({
  scope: propScope,
  compact = false,
  className,
}: {
  scope?: PlanningScope
  compact?: boolean
  className?: string
}) {
  const contextScope = useWorkspace()
  const scope = propScope ?? contextScope
  const [isPending, startTransition] = useTransition()

  function handleSwitch(target: "personal" | "family") {
    if (scope.type === target) return
    startTransition(async () => {
      await switchPlanningScopeAction(target)
    })
  }

  const isFamily = scope.type === "family"
  const hasFamily = Boolean(scope.familyName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "tap-press inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact
            ? "h-8 px-2.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 shadow-2xs"
            : "w-full justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm hover:bg-muted text-ink shadow-2xs",
          className
        )}
        aria-label="Changer d'espace de travail"
        disabled={isPending}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {isFamily ? (
            <Users className="size-3.5 shrink-0 text-primary" />
          ) : (
            <User className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {compact ? (
            <span className="truncate max-w-[90px] text-[11px] font-bold">
              {isFamily ? scope.displayName : "Perso"}
            </span>
          ) : (
            <div className="flex min-w-0 flex-col text-left leading-tight">
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                Espace actif
              </span>
              <span className="truncate text-sm font-semibold">
                {isFamily
                  ? `${scope.displayName} (${scope.memberCount}/10)`
                  : "Mon planning perso"}
              </span>
            </div>
          )}
        </div>
        <ChevronDown className="size-3 shrink-0 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={compact ? "end" : "start"}
        className="w-64 p-1 shadow-lg"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Espaces de planification
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => handleSwitch("personal")}
          className="flex cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm"
        >
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">Mon planning perso</span>
              <span className="text-xs text-muted-foreground">
                Mes repas &amp; courses privés
              </span>
            </div>
          </div>
          {!isFamily ? <Check className="size-4 text-primary" /> : null}
        </DropdownMenuItem>

        {hasFamily ? (
          <DropdownMenuItem
            onClick={() => handleSwitch("family")}
            className="flex cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="font-medium">{scope.familyName}</span>
                <span className="text-xs text-muted-foreground">
                  Groupe partagé · {scope.memberCount}/10 membres
                </span>
              </div>
            </div>
            {isFamily ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {!hasFamily ? (
          <DropdownMenuItem asChild className="cursor-pointer text-xs">
            <Link
              href="/compte"
              className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground hover:text-ink"
            >
              <Plus className="size-3.5" />
              <span>Créer un groupe familial</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild className="cursor-pointer text-xs">
            <Link
              href="/compte"
              className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground hover:text-ink"
            >
              <Users className="size-3.5" />
              <span>Gérer le groupe ({scope.memberCount}/10)</span>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
