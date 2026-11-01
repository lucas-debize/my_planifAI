"use server"

import { cache } from "react"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getMyFamily } from "@/lib/domain/families"
import {
  SCOPE_COOKIE,
  WEEK_START_DAY_COOKIE,
  type PlanningScope,
  type WeekStartDay,
} from "@/lib/domain/session"
import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function revalidateApp(): Promise<void> {
  revalidatePath("/", "layout")
}

const getPlanningScopeCached = cache(async (): Promise<PlanningScope> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const authUid = data?.claims?.sub
  if (!authUid || typeof authUid !== "string") {
    return {
      type: "personal",
      familyId: null,
      familyName: null,
      memberCount: 1,
      displayName: "Mon planning perso",
    }
  }

  const familyInfo = await getMyFamily(supabase, authUid)
  const cookieStore = await cookies()
  const cookieScope = cookieStore.get(SCOPE_COOKIE)?.value

  if (familyInfo?.family) {
    const isPersonal = cookieScope === "personal"
    if (isPersonal) {
      return {
        type: "personal",
        familyId: null,
        familyName: familyInfo.family.name,
        memberCount: familyInfo.members.length,
        displayName: "Mon planning perso",
      }
    }
    return {
      type: "family",
      familyId: familyInfo.family.id,
      familyName: familyInfo.family.name,
      memberCount: familyInfo.members.length,
      displayName: familyInfo.family.name,
    }
  }

  return {
    type: "personal",
    familyId: null,
    familyName: null,
    memberCount: 1,
    displayName: "Mon planning perso",
  }
})

/**
 * Returns the current active planning scope (personal or family)
 * based on user's family membership and the `planifia_scope` cookie.
 * Request-memoized via React cache.
 */
export async function getPlanningScope(): Promise<PlanningScope> {
  return getPlanningScopeCached()
}

/**
 * Switch between personal and family planning scope.
 */
export async function switchPlanningScopeAction(
  scope: "personal" | "family"
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SCOPE_COOKIE, scope, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  await revalidateApp()
}

export async function getWeekStartDay(): Promise<WeekStartDay> {
  const cookieStore = await cookies()
  const val = cookieStore.get(WEEK_START_DAY_COOKIE)?.value
  if (val !== undefined && val !== "") {
    const parsed = Number(val)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
      return parsed as WeekStartDay
    }
  }
  return 1
}

export async function setWeekStartDayAction(day: WeekStartDay): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(WEEK_START_DAY_COOKIE, String(day), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  await revalidateApp()
}

const requireScopedContextCached = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const authUid = data?.claims?.sub
  if (!authUid || typeof authUid !== "string") {
    throw new Error("UNAUTHENTICATED")
  }
  const scope = await getPlanningScopeCached()
  return { supabase, authUid, scope }
})

/**
 * Returns authenticated client, real authUid, and active planning scope.
 * Request-memoized via React cache.
 */
export async function requireScopedContext(): Promise<{
  supabase: SupabaseClient<Database>
  authUid: string
  scope: PlanningScope
}> {
  return requireScopedContextCached()
}

/**
 * Compatibility helper for existing callers.
 */
export async function requireUser(): Promise<{
  supabase: SupabaseClient<Database>
  userId: string
  authUid: string
}> {
  const { supabase, authUid, scope } = await requireScopedContext()
  return {
    supabase,
    userId: scope.type === "family" && scope.familyId ? scope.familyId : authUid,
    authUid,
  }
}
