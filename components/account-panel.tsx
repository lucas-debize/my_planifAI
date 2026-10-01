"use client"

import { useEffect, useSyncExternalStore, useActionState, useRef } from "react"
import { useTheme } from "next-themes"
import {
  addGoogleAccount,
  rememberAccount,
  signOut,
  signOutAll,
  switchAccount,
} from "@/lib/actions/accounts"
import {
  createFamilyAction,
  joinFamilyAction,
  leaveFamilyAction,
  deleteFamilyAction,
} from "@/lib/actions/families"
import type { SavedAccount } from "@/lib/accounts/vault"
import type { FamilyRow, FamilyMemberRow } from "@/lib/database.types"
import { Button } from "@/components/ui/button"
import { GoogleMark } from "@/components/google-mark"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
] as const

function subscribe() {
  return () => {}
}

function useIosInstallHint() {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof navigator !== "undefined" &&
      /iPad|iPhone/.test(navigator.userAgent) &&
      !("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone),
    () => false
  )
}

function useHasMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

function initials(account: SavedAccount) {
  const name = account.name ?? account.email ?? ""
  const parts = name.split(/[\s.@]+/).filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function providerLabel(account: SavedAccount) {
  if (account.provider === "dev") return "Dev"
  if (account.provider === "google") return "Google"
  return account.provider
}

function AccountAvatar({ account }: { account: SavedAccount }) {
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        className="size-9 shrink-0 rounded-full bg-muted"
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
      {initials(account)}
    </span>
  )
}

function AccountDetails({ account }: { account: SavedAccount }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col leading-tight">
      {account.name ? (
        <span className="truncate text-sm font-medium text-ink">
          {account.name}
        </span>
      ) : null}
      <span className="truncate text-xs text-muted-foreground">
        {account.email ?? providerLabel(account)}
      </span>
    </span>
  )
}

/* ---------- Family section ---------- */

function FamilySection({
  family,
  members,
  isAdmin,
  authUid,
}: {
  family: FamilyRow | null
  members: FamilyMemberRow[]
  isAdmin: boolean
  authUid: string | null
}) {
  const [createState, createAction, createPending] = useActionState(
    createFamilyAction,
    null
  )
  const [joinState, joinAction, joinPending] = useActionState(
    joinFamilyAction,
    null
  )
  const codeRef = useRef<HTMLInputElement>(null)

  if (!family) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Groupe familial</h2>
        <p className="text-sm text-muted-foreground">
          Crée un groupe pour partager repas, planning et courses avec ta
          famille.
        </p>

        <form action={createAction} className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="family-name">
            Nom du groupe
          </label>
          <div className="flex gap-2">
            <input
              id="family-name"
              name="name"
              type="text"
              placeholder="ex: Famille Dupont"
              maxLength={40}
              required
              className="min-h-10 flex-1 rounded-[0.75rem] border border-line bg-surface px-3 text-sm"
            />
            <Button
              type="submit"
              disabled={createPending}
              className="min-h-10 shrink-0"
            >
              Créer
            </Button>
          </div>
          {createState?.error ? (
            <p className="text-sm text-destructive">{createState.error}</p>
          ) : null}
        </form>

        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={joinAction} className="flex flex-col gap-2">
          <label
            className="text-xs text-muted-foreground"
            htmlFor="invite-code"
          >
            Code d&apos;invitation
          </label>
          <div className="flex gap-2">
            <input
              id="invite-code"
              name="code"
              type="text"
              placeholder="ex: a1b2c3d4"
              maxLength={16}
              required
              className="min-h-10 flex-1 rounded-[0.75rem] border border-line bg-surface px-3 text-sm font-mono"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={joinPending}
              className="min-h-10 shrink-0"
            >
              Rejoindre
            </Button>
          </div>
          {joinState?.error ? (
            <p className="text-sm text-destructive">{joinState.error}</p>
          ) : null}
        </form>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">
        Groupe familial — {family.name}
      </h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Membres</span>
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-2 rounded-[0.75rem] border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {(m.display_name || "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate">
                {m.display_name || m.user_id.slice(0, 8)}
              </span>
              {m.role === "admin" ? (
                <span className="text-xs text-muted-foreground">admin</span>
              ) : null}
              {m.user_id === authUid ? (
                <span className="text-xs font-medium text-primary">toi</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Code d&apos;invitation — partage-le pour inviter ta famille
        </span>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-[0.75rem] border border-line bg-surface px-3 py-2 text-sm font-mono tracking-wider">
            {family.invite_code}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0"
            onClick={() => {
              void navigator.clipboard.writeText(family.invite_code)
              if (codeRef.current) codeRef.current.textContent = "Copié !"
              setTimeout(() => {
                if (codeRef.current) codeRef.current.textContent = "Copier"
              }, 2000)
            }}
          >
            <span ref={codeRef}>Copier</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!isAdmin ? (
          <form action={leaveFamilyAction}>
            <Button type="submit" variant="outline" className="min-h-10">
              Quitter le groupe
            </Button>
          </form>
        ) : null}
        {isAdmin ? (
          <form action={deleteFamilyAction}>
            <Button type="submit" variant="destructive" className="min-h-10">
              Supprimer le groupe
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  )
}

/* ---------- Main panel ---------- */

export function AccountPanel({
  current,
  accounts,
  supabaseReady = false,
  family = null,
  familyMembers = [],
  isFamilyAdmin = false,
  authUid = null,
}: {
  current: SavedAccount | null
  accounts: SavedAccount[]
  supabaseReady?: boolean
  family?: FamilyRow | null
  familyMembers?: FamilyMemberRow[]
  isFamilyAdmin?: boolean
  authUid?: string | null
}) {
  const { theme, setTheme } = useTheme()
  const mounted = useHasMounted()
  const iosHint = useIosInstallHint()
  const others = accounts.filter((account) => account.id !== current?.id)
  const showSignOutAll = accounts.length > 1
  useEffect(() => {
    void rememberAccount()
  }, [])

  return (
    <>
      <PageHeader
        title="Compte"
        backHref="/semaine"
        backLabel="Retour au planning"
      />
      <div className="flex flex-col gap-6 px-4 pb-8 md:max-w-lg md:px-8">
        {current ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm text-muted-foreground">Compte actuel</h2>
            <div className="flex items-center gap-3 rounded-[0.75rem] border border-primary bg-primary/10 px-3 py-3">
              <AccountAvatar account={current} />
              <AccountDetails account={current} />
            </div>
            {current.provider === "dev" ? (
              <p className="text-sm text-muted-foreground">
                Compte de développement local. Les données restent dans
                `.data/` et ne sont pas envoyées à Supabase.
              </p>
            ) : null}
          </section>
        ) : (
          <p className="text-base text-ink">Compte connecté</p>
        )}

        {others.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm text-muted-foreground">
              Autres comptes sur cet appareil
            </h2>
            <ul className="flex flex-col gap-2">
              {others.map((account) => (
                <li key={account.id}>
                  <form action={switchAccount}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <button
                      type="submit"
                      className="flex w-full min-h-12 items-center gap-3 rounded-[0.75rem] border border-line bg-surface px-3 py-2 text-left hover:bg-muted"
                    >
                      <AccountAvatar account={account} />
                      <AccountDetails account={account} />
                      <span className="shrink-0 text-sm text-muted-foreground">
                        Utiliser
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {supabaseReady ? (
          <form action={addGoogleAccount}>
            <Button type="submit" variant="outline" className="min-h-12">
              <GoogleMark />
              Ajouter un compte Google
            </Button>
          </form>
        ) : null}

        {supabaseReady && current?.provider !== "dev" ? (
          <FamilySection
            family={family}
            members={familyMembers}
            isAdmin={isFamilyAdmin}
            authUid={authUid}
          />
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">
            Apparence
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "min-h-12 rounded-[0.75rem] border px-3 text-sm",
                  mounted && theme === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-surface"
                )}
                onClick={() => setTheme(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        {iosHint ? (
          <p className="text-sm text-muted-foreground">
            Sur iPhone : Partager → Sur l&apos;écran d&apos;accueil
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={signOut}>
            <Button type="submit" variant="outline" className="min-h-12">
              Déconnexion
            </Button>
          </form>
          {showSignOutAll ? (
            <form action={signOutAll}>
              <Button type="submit" variant="ghost" className="min-h-12">
                Tout déconnecter
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  )
}
