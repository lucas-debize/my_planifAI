"use client"

import { useEffect, useSyncExternalStore, useActionState, useState } from "react"
import { useTheme } from "next-themes"
import {
  Check,
  Copy,
  Link2,
  Mail,
  Smartphone,
} from "lucide-react"
import { toast } from "sonner"
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
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
] as const

function subscribe() {
  return () => {}
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
  initialJoinCode,
}: {
  family: FamilyRow | null
  members: FamilyMemberRow[]
  isAdmin: boolean
  authUid: string | null
  initialJoinCode?: string | null
}) {
  const [createState, createAction, createPending] = useActionState(
    createFamilyAction,
    null
  )
  const [joinState, joinAction, joinPending] = useActionState(
    joinFamilyAction,
    null
  )

  const [joinCodeInput, setJoinCodeInput] = useState(initialJoinCode ?? "")
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (initialJoinCode && !family) {
      toast.info(`Code d'invitation « ${initialJoinCode} » détecté. Cliquez sur « Rejoindre ».`)
    }
  }, [initialJoinCode, family])

  if (!family) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Groupe familial</h2>
        <p className="text-sm text-muted-foreground">
          Créez un groupe pour partager vos repas, planning et courses avec vos proches.
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
            Rejoindre avec un code d&apos;invitation
          </label>
          <div className="flex gap-2">
            <input
              id="invite-code"
              name="code"
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="ex: a1b2c3d4"
              maxLength={16}
              required
              className="min-h-10 flex-1 rounded-[0.75rem] border border-line bg-surface px-3 text-sm font-mono tracking-wider uppercase"
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

  const isFull = members.length >= 10

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/compte?join=${family.invite_code}`
      : `https://myplanifai.vercel.app/compte?join=${family.invite_code}`

  const mailSubject = `Rejoins notre groupe ${family.name} sur MyPlanifAI`
  const mailBody = `Salut !\n\nRejoins notre planning de repas familial "${family.name}" sur MyPlanifAI pour partager menus, idées de recettes et listes de courses en un clic :\n\n👉 Clique ici pour nous rejoindre : ${inviteUrl}\n\n(Ou entre directement le code d'invitation : ${family.invite_code})\n\nÀ tout de suite !`
  const mailtoHref = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">
        Groupe familial — {family.name}
      </h2>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Membres ({members.length}/10)
          </span>
          {isFull ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Groupe complet (10/10)
            </span>
          ) : null}
        </div>
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

      {isFull ? (
        <div className="flex flex-col gap-1 rounded-[0.75rem] border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-semibold">La limite maximale de 10 personnes est atteinte</p>
          <p className="text-muted-foreground dark:text-amber-300/80">
            Le partage du code d&apos;invitation est désactivé. Supprimez des membres ou quittez le groupe pour libérer des places.
          </p>
        </div>
      ) : (
        /* Volet d'invitation avec e-mail en priorité */
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink">
              1. Inviter par e-mail (recommandé)
            </span>
            <p className="text-xs text-muted-foreground">
              Ouvre votre boîte mail avec un message pré-rempli et le lien d&apos;adhésion directe.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-1.5 text-xs">
                <a href={mailtoHref}>
                  <Mail className="size-3.5" />
                  <span>Envoyer par e-mail</span>
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl)
                  setCopiedLink(true)
                  toast.success("Lien d'invitation copié dans le presse-papier !")
                  setTimeout(() => setCopiedLink(false), 2000)
                }}
              >
                {copiedLink ? (
                  <Check className="size-3.5 text-accent" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                <span>{copiedLink ? "Lien copié !" : "Copier le lien"}</span>
              </Button>
            </div>
          </div>

          <div className="h-px bg-line/80" />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink">
              2. Ou partager le code d&apos;invitation
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-[0.75rem] border border-line bg-muted/40 px-3 py-2 text-sm font-mono tracking-wider font-semibold">
                {family.invite_code}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 shrink-0 gap-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(family.invite_code)
                  setCopiedCode(true)
                  toast.success("Code copié dans le presse-papier !")
                  setTimeout(() => setCopiedCode(false), 2000)
                }}
              >
                {copiedCode ? (
                  <Check className="size-3.5 text-accent" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copiedCode ? "Copié !" : "Copier le code"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

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
  initialJoinCode = null,
}: {
  current: SavedAccount | null
  accounts: SavedAccount[]
  supabaseReady?: boolean
  family?: FamilyRow | null
  familyMembers?: FamilyMemberRow[]
  isFamilyAdmin?: boolean
  authUid?: string | null
  initialJoinCode?: string | null
}) {
  const { theme, setTheme } = useTheme()
  const mounted = useHasMounted()
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
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-3 shadow-2xs">
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
                      className="tap-press flex w-full min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-muted shadow-2xs transition-colors"
                    >
                      <AccountAvatar account={account} />
                      <AccountDetails account={account} />
                      <span className="shrink-0 text-xs font-semibold text-primary">
                        Basculer
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
            <Button type="submit" variant="outline" className="tap-press min-h-12 w-full rounded-xl font-semibold shadow-2xs">
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
            initialJoinCode={initialJoinCode}
          />
        ) : null}

        {/* Section Apparence : uniquement Clair et Sombre */}
        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">
            Apparence
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "tap-press min-h-11 rounded-xl border px-3 text-sm font-semibold transition-all shadow-2xs",
                  mounted && theme === item.value
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-line bg-surface hover:bg-muted text-ink"
                )}
                onClick={() => setTheme(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Guide d'installation iPhone / iOS */}
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Smartphone className="size-4 shrink-0" />
            <span>Installer PlanifIA sur iPhone</span>
          </div>
          <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
            <li>
              Dans Safari sur votre iPhone, touchez le bouton <strong>Partager</strong> ⎋ (carré avec flèche vers le haut).
            </li>
            <li>
              Faites défiler vers le bas et sélectionnez <strong>Sur l&apos;écran d&apos;accueil</strong> ➕.
            </li>
            <li>
              Appuyez sur <strong>Ajouter</strong> en haut à droite.
            </li>
          </ol>
          <p className="text-[11px] text-muted-foreground/90 pt-0.5">
            ✨ L&apos;application s&apos;ouvre en plein écran sans barre Safari, rapide et réactive.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={signOut}>
            <Button type="submit" variant="outline" className="tap-press min-h-11 rounded-xl font-medium">
              Déconnexion
            </Button>
          </form>
          {showSignOutAll ? (
            <form action={signOutAll}>
              <Button type="submit" variant="ghost" className="tap-press min-h-11 rounded-xl font-medium text-destructive hover:bg-destructive/10">
                Tout déconnecter
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  )
}
