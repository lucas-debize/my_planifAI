import { AccountPanel } from "@/components/account-panel"
import { getCurrentIdentity } from "@/lib/accounts/identity"
import { listSavedAccounts, type SavedAccount } from "@/lib/accounts/vault"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { getMyFamily } from "@/lib/domain/families"

export const dynamic = "force-dynamic"

function mergeAccounts(
  current: SavedAccount | null,
  saved: SavedAccount[]
): SavedAccount[] {
  const byId = new Map<string, SavedAccount>()
  for (const account of saved) byId.set(account.id, account)
  if (current) {
    const previous = byId.get(current.id)
    byId.set(current.id, previous ? { ...previous, ...current } : current)
  }
  const merged = [...byId.values()]
  if (!current) return merged
  return [
    merged.find((account) => account.id === current.id)!,
    ...merged.filter((account) => account.id !== current.id),
  ]
}

export default async function ComptePage({
  searchParams,
}: {
  searchParams?: Promise<{ join?: string }>
}) {
  const resolvedParams = searchParams ? await searchParams : undefined
  const initialJoinCode = resolvedParams?.join?.trim() || null
  const current = await getCurrentIdentity()
  const accounts = mergeAccounts(current, await listSavedAccounts())

  let familyInfo: Awaited<ReturnType<typeof getMyFamily>> = null
  let authUid: string | null = null
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getClaims()
      authUid = (data?.claims?.sub as string) ?? null
      if (authUid) {
        familyInfo = await getMyFamily(supabase, authUid)
      }
    } catch {
      // Dev mode or not authenticated — skip family
    }
  }

  return (
    <AccountPanel
      current={current}
      accounts={accounts}
      supabaseReady={isSupabaseConfigured()}
      family={familyInfo?.family ?? null}
      familyMembers={familyInfo?.members ?? []}
      isFamilyAdmin={familyInfo?.isAdmin ?? false}
      authUid={authUid}
      initialJoinCode={initialJoinCode}
    />
  )
}
