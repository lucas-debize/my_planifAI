export const SCOPE_COOKIE = "planifia_scope"
export const WEEK_START_DAY_COOKIE = "planifia_week_start"
export type WeekStartDay = 1 | 6 // 1 = Lundi, 6 = Samedi


export type PlanningScope = {
  type: "personal" | "family"
  familyId: string | null
  familyName: string | null
  memberCount: number
  displayName: string
}
