"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  ShoppingBasket,
  UserRound,
} from "lucide-react"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { WorkspaceProvider } from "@/components/workspace-context"
import type { PlanningScope } from "@/lib/domain/session"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/semaine", label: "Semaine", icon: CalendarDays },
  { href: "/idees", label: "Idées", icon: BookOpen },
  { href: "/courses", label: "Courses", icon: ShoppingBasket },
] as const

function isActive(pathname: string, href: string) {
  if (href === "/semaine") return pathname.startsWith("/semaine")
  if (href === "/idees") return pathname.startsWith("/idees")
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

  return (
    <WorkspaceProvider scope={scope}>
      <div className="min-h-dvh bg-bg md:flex">
        <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-surface">
          <div className="px-5 pt-6 pb-4">
            <Link href="/semaine" className="font-fraunces text-2xl text-ink">
              MyPlanifAI
            </Link>
          </div>
          <div className="px-3 pb-3">
            <WorkspaceSwitcher />
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Principal">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "tap-press flex min-h-12 items-center gap-3 rounded-[0.75rem] px-3 text-base",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-ink hover:bg-muted"
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-4">
          <Link
            href="/compte"
            className={cn(
              "tap-press flex min-h-12 items-center gap-3 rounded-[0.75rem] px-3 text-base",
              pathname === "/compte"
                ? "bg-primary text-primary-foreground"
                : "text-ink hover:bg-muted"
            )}
          >
            <UserRound className="size-5" aria-hidden />
            Compte
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex-1 min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid grid-cols-3 py-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "tap-press flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
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
