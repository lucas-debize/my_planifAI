export const SCOPE_COOKIE = "planifia_scope"

export type PlanningScope = {
  type: "personal" | "family"
  familyId: string | null
  familyName: string | null
  memberCount: number
  displayName: string
}
