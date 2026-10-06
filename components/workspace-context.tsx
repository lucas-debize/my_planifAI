"use client"

import { createContext, useContext } from "react"
import type { PlanningScope } from "@/lib/domain/session"

const WorkspaceContext = createContext<PlanningScope | null>(null)

export function WorkspaceProvider({
  scope,
  children,
}: {
  scope: PlanningScope
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={scope}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): PlanningScope {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    return {
      type: "personal",
      familyId: null,
      familyName: null,
      memberCount: 1,
      displayName: "Mon planning perso",
    }
  }
  return ctx
}
