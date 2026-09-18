"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { WeekSwitcher } from "@/components/week-switcher"
import { DownloadPdfButton } from "@/components/download-pdf-button"
import {
  addWeekItem,
  removeWeekItem,
  renameShopItem,
  toggleShopCheck,
} from "@/lib/actions/shopping"
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

  return (
    <>
      <PageHeader
        title="Courses"
        actions={<DownloadPdfButton weekStart={weekStart} />}
      />
      <div className="px-4 md:px-8">
        <WeekSwitcher
          weekStart={weekStart}
          hrefFor={(iso) => `/courses?semaine=${iso}`}
        />
        <div className="mt-4 flex min-h-12 items-center gap-3">
          <Switch
            id="hide-checked"
            checked={hideChecked}
            onCheckedChange={setHideChecked}
          />
          <Label htmlFor="hide-checked">Masquer les cochés</Label>
        </div>
      </div>
      {lines.length === 0 ? (
        <EmptyState
          message="Pose des plats dans la semaine pour voir les courses."
          actionLabel="Voir la semaine"
          actionHref={`/semaine/${weekStart}`}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-1 px-4 md:px-8">
          {visible.map((line) => {
            const editing = editingId === line.ingredientId
            return (
              <li key={line.ingredientId}>
                <div className="flex min-h-12 items-center gap-2 rounded-[0.75rem] px-2 hover:bg-surface">
                  <Checkbox
                    checked={line.checked}
                    onCheckedChange={(value) =>
                      void onToggle(line, value === true)
                    }
                    aria-label={line.name}
                  />
                  {editing ? (
                    <Input
                      value={editValue}
                      autoFocus
                      maxLength={80}
                      aria-label={`Modifier ${line.name}`}
                      className="min-h-10 flex-1"
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
                        "tap-press min-h-10 flex-1 truncate rounded-[0.5rem] px-1 text-left",
                        line.checked && "text-muted-foreground line-through"
                      )}
                      onClick={() => startEdit(line)}
                    >
                      {line.name}
                    </button>
                  )}
                  <button
                    type="button"
                    className="tap-press inline-flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] hover:bg-muted"
                    aria-label={`Modifier ${line.name}`}
                    onClick={() => startEdit(line)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  {line.extra ? (
                    <button
                      type="button"
                      className="tap-press inline-flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] text-destructive hover:bg-muted"
                      aria-label={`Retirer ${line.name}`}
                      onClick={() => void onRemove(line)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="mt-4 flex items-center gap-2 px-4 pb-8 md:px-8"
        onSubmit={(event) => void onAdd(event)}
      >
        <Input
          value={draft}
          maxLength={80}
          placeholder="Ajouter un article"
          aria-label="Ajouter un article"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={pending}
          className="tap-press inline-flex size-12 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          aria-label="Ajouter"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </form>
    </>
  )
}
