"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownAZ, FileDown, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { WeekSwitcher } from "@/components/week-switcher"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  addWeekItem,
  removeWeekItem,
  renameShopItem,
  toggleShopCheck,
} from "@/lib/actions/shopping"
import { groupItemsByAisle } from "@/lib/ai/aisles"
import { actionErrorMessage } from "@/lib/errors"
import type { ShopLine } from "@/lib/domain/shopping"
import { cn } from "@/lib/utils"

export function ShoppingBoard({
  weekStart,
  initialLines,
}: {
  weekStart: string
  initialLines: ShopLine[]
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"aisles" | "alpha">("aisles")
  const [hideChecked, setHideChecked] = useState(false)
  const [lines, setLines] = useState(initialLines)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [pending, setPending] = useState(false)
  const [, startTransition] = useTransition()

  const visible = useMemo(
    () => (hideChecked ? lines.filter((line) => !line.checked) : lines),
    [hideChecked, lines]
  )

  const totalCount = lines.length
  const checkedCount = lines.filter((l) => l.checked).length
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  const aisleGroups = useMemo(() => groupItemsByAisle(visible), [visible])
  function refresh() {
    startTransition(() => router.refresh())
  }

  async function onToggle(line: ShopLine, checked: boolean) {
    const previous = lines
    setLines((current) =>
      current.map((item) =>
        item.ingredientId === line.ingredientId ? { ...item, checked } : item
      )
    )
    try {
      await toggleShopCheck({
        weekStart,
        ingredientId: line.ingredientId,
        checked,
      })
      refresh()
    } catch (error) {
      setLines(previous)
      toast.error(actionErrorMessage(error))
    }
  }

  function startEdit(line: ShopLine) {
    setEditingId(line.ingredientId)
    setEditValue(line.name)
  }

  async function saveEdit(line: ShopLine) {
    const name = editValue.trim()
    if (!name) {
      toast.error("Donne un nom à l’ingrédient.")
      return
    }
    if (name === line.name) {
      setEditingId(null)
      return
    }
    const previous = lines
    setLines((current) =>
      current.map((item) =>
        item.ingredientId === line.ingredientId ? { ...item, name } : item
      )
    )
    setEditingId(null)
    try {
      const saved = await renameShopItem({
        ingredientId: line.ingredientId,
        name,
      })
      setLines((current) =>
        current.map((item) =>
          item.ingredientId === line.ingredientId
            ? { ...item, name: saved.name }
            : item
        )
      )
      toast.success("Ingrédient modifié")
      refresh()
    } catch (error) {
      setLines(previous)
      setEditingId(line.ingredientId)
      toast.error(actionErrorMessage(error))
    }
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) {
      toast.error("Donne un nom à l’ingrédient.")
      return
    }
    if (lines.some((line) => line.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Déjà sur la liste.")
      setDraft("")
      return
    }
    setPending(true)
    try {
      const line = await addWeekItem({ weekStart, name })
      setLines((current) => {
        if (current.some((item) => item.ingredientId === line.ingredientId)) {
          return current
        }
        return [...current, line].sort((a, b) =>
          a.name.localeCompare(b.name, "fr")
        )
      })
      setDraft("")
      toast.success("Article ajouté")
      refresh()
    } catch (error) {
      toast.error(actionErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function onRemove(line: ShopLine) {
    const previous = lines
    setLines((current) =>
      current.filter((item) => item.ingredientId !== line.ingredientId)
    )
    if (editingId === line.ingredientId) setEditingId(null)
    try {
      await removeWeekItem({
        weekStart,
        ingredientId: line.ingredientId,
      })
      toast.success("Article retiré")
      refresh()
    } catch (error) {
      setLines(previous)
      toast.error(actionErrorMessage(error))
    }
  }

  function renderLineItem(line: ShopLine) {
    const editing = editingId === line.ingredientId
    return (
      <li key={line.ingredientId}>
        <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1 transition-colors hover:bg-muted/50 group">
          <div className="flex size-7 shrink-0 items-center justify-center">
            <Checkbox
              checked={line.checked}
              onCheckedChange={(value) => void onToggle(line, value === true)}
              aria-label={line.name}
              className="size-5 rounded-md border-line/90 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
          {editing ? (
            <Input
              value={editValue}
              autoFocus
              maxLength={80}
              aria-label={`Modifier ${line.name}`}
              className="min-h-9 flex-1 text-sm rounded-lg"
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void saveEdit(line)
                }
                if (event.key === "Escape") setEditingId(null)
              }}
              onBlur={() => void saveEdit(line)}
            />
          ) : (
            <button
              type="button"
              className={cn(
                "tap-press min-h-9 flex-1 min-w-0 rounded-md px-1 text-left break-words line-clamp-2 text-sm sm:text-base leading-snug font-medium transition-all",
                line.checked ? "text-muted-foreground line-through opacity-60" : "text-ink"
              )}
              onClick={() => startEdit(line)}
            >
              {line.name}
            </button>
          )}
          <button
            type="button"
            className="tap-press inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-ink hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
            aria-label={`Modifier ${line.name}`}
            onClick={() => startEdit(line)}
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
          {line.extra ? (
            <button
              type="button"
              className="tap-press inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Retirer ${line.name}`}
              onClick={() => void onRemove(line)}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title="Courses"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="tap-press min-h-10 px-2.5 gap-1.5 rounded-xl border-line bg-surface text-xs font-semibold shadow-2xs hover:bg-muted"
                aria-label="Actions de la liste de courses"
              >
                <MoreHorizontal className="size-4" />
                <span className="hidden sm:inline">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-lg border border-line bg-surface">
              <DropdownMenuItem asChild>
                <a
                  href={`/api/pdf/semaine/${weekStart}`}
                  download={`myplanifia-courses-${weekStart}.pdf`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer"
                >
                  <FileDown className="size-4 text-muted-foreground" />
                  <span>Télécharger le PDF</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="px-4 md:px-8">
        <WeekSwitcher
          weekStart={weekStart}
          hrefFor={(iso) => `/courses?semaine=${iso}`}
        />

        <div className="mt-4 flex flex-col gap-3">
          {/* Barre de progression des courses */}
          {totalCount > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-line/60 bg-surface p-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Articles cochés</span>
                <span className="text-primary font-bold">{checkedCount} / {totalCount} ({progressPercent}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Formulaire d'ajout rapide au sommet */}
          <form
            className="flex w-full items-center gap-2"
            onSubmit={(event) => void onAdd(event)}
          >
            <Input
              value={draft}
              maxLength={80}
              placeholder="Ajouter un article rapide (ex: Café, Lait...)"
              aria-label="Ajouter un article"
              className="flex-1 min-w-0 min-h-11 rounded-xl border-line/80 bg-surface shadow-2xs text-sm"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="tap-press inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shadow-2xs transition-all font-semibold"
              aria-label="Ajouter"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </form>

          {/* Filtres et modes d'affichage */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex min-h-10 items-center gap-2.5">
              <Switch
                id="hide-checked"
                checked={hideChecked}
                onCheckedChange={setHideChecked}
              />
              <Label htmlFor="hide-checked" className="cursor-pointer text-xs sm:text-sm font-medium">
                Masquer les cochés ({checkedCount})
              </Label>
            </div>

            <div className="inline-flex rounded-xl bg-muted/70 p-1 text-xs font-medium">
              <button
                type="button"
                className={cn(
                  "tap-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
                  viewMode === "aisles"
                    ? "bg-card text-ink shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-ink"
                )}
                onClick={() => setViewMode("aisles")}
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>Par rayon</span>
              </button>
              <button
                type="button"
                className={cn(
                  "tap-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
                  viewMode === "alpha"
                    ? "bg-card text-ink shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-ink"
                )}
                onClick={() => setViewMode("alpha")}
              >
                <ArrowDownAZ className="size-3.5" />
                <span>A à Z</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          message="Pose des plats dans la semaine pour voir les courses."
          actionLabel="Voir la semaine"
          actionHref={`/semaine/${weekStart}`}
        />
      ) : viewMode === "aisles" ? (
        <div className="mt-4 flex flex-col gap-4 px-4 md:px-8">
          {aisleGroups.map(({ aisle, items }) => {
            const checkedCount = items.filter((i) => i.checked).length
            return (
              <section
                key={aisle.key}
                className="rounded-2xl border border-line/60 bg-surface/80 p-3.5 shadow-2xs transition-all"
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {aisle.icon}
                    </span>
                    <h2 className="font-fraunces text-base font-bold text-ink">
                      {aisle.label}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold rounded-full bg-muted px-2 py-0.5">
                    {checkedCount} / {items.length}
                  </span>
                </header>
                <ul className="flex flex-col divide-y divide-line/30">
                  {items.map((line) => renderLineItem(line))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-1 px-4 md:px-8">
          {visible.map((line) => renderLineItem(line))}
        </ul>
      )}

      {/* Espace bas pour assurer le scroll au-dessus de la nav mobile */}
      <div className="h-6" />
    </>
  )
}
