"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  ShoppingBasket,
  UserRound,
} from "lucide-react"
import { currentMondayIso } from "@/lib/dates"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { WorkspaceProvider } from "@/components/workspace-context"
import type { PlanningScope } from "@/lib/domain/session"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/semaine", label: "Semaine", icon: CalendarDays },
  { href: "/idees", label: "Idées", icon: BookOpen },
  { href: "/courses", label: "Courses", icon: ShoppingBasket },
  { href: "/compte", label: "Compte", icon: UserRound },
] as const

function isActive(pathname: string, href: string) {
  if (href === "/semaine") return pathname.startsWith("/semaine")
  if (href === "/idees") return pathname.startsWith("/idees")
  if (href === "/compte") return pathname.startsWith("/compte")
  if (href === "/courses") return pathname.startsWith("/courses")
  return pathname === href
}

export function AppShell({
  children,
  scope,
}: {
  children: React.ReactNode
  scope: PlanningScope
}) {
  const pathname = usePathname()
  const weekHref = `/semaine/${currentMondayIso()}`
  return (
    <WorkspaceProvider scope={scope}>
      <div className="min-h-dvh bg-bg md:flex">
        <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-surface">
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <Link href={weekHref} prefetch={true} className="flex items-center gap-2 group">
              <span className="font-fraunces text-2xl tracking-tight text-ink group-hover:text-primary transition-colors">
                MyPlanifAI
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                2026
              </span>
            </Link>
          </div>
          <div className="px-3 pb-3">
            <WorkspaceSwitcher />
          </div>
          <nav className="flex flex-1 flex-col gap-1.5 px-3" aria-label="Principal">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href === "/semaine" ? weekHref : item.href}
                  prefetch={true}
                  className={cn(
                    "tap-press flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-ink/80 hover:bg-muted hover:text-ink"
                  )}
                >
                  <Icon className={cn("size-4.5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </div>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg"
        >
          <ul className="grid grid-cols-4 py-1.5 px-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    className={cn(
                      "tap-press flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium leading-none transition-all",
                      active
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-ink"
                    )}
                  >
                    <div className={cn(
                      "flex size-7 items-center justify-center rounded-full transition-all",
                      active ? "bg-primary/15 text-primary scale-110" : ""
                    )}>
                      <Icon className="size-4.5" aria-hidden />
                    </div>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  </WorkspaceProvider>
)
}
