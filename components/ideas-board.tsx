"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ingredientCountLabel } from "@/components/meal-picker"
import type { MealWithIngredients } from "@/lib/domain/meals"

export function IdeasBoard({ meals }: { meals: MealWithIngredients[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...meals].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    if (!q) return list
    return list.filter((meal) => {
      if (meal.name.toLowerCase().includes(q)) return true
      return meal.ingredients.some((ingredient) =>
        ingredient.name.toLowerCase().includes(q)
      )
    })
  }, [meals, query])

  return (
    <>
      <PageHeader
        title="Idées"
        actions={
          <Button asChild className="min-h-12">
            <Link href="/idees/nouvelle">Nouvelle idée</Link>
          </Button>
        }
      />
      <div className="px-4 md:px-8">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un plat ou un ingrédient"
          aria-label="Rechercher un plat ou un ingrédient"
        />
      </div>
      {meals.length === 0 ? (
        <EmptyState
          message="Tes plats restent ici. Tu les reposes sur n’importe quelle semaine."
          actionLabel="Nouvelle idée"
          actionHref="/idees/nouvelle"
        />
      ) : filtered.length === 0 ? (
        <div className="mx-4 mt-6 flex flex-col items-center justify-center rounded-[1rem] border border-dashed border-border bg-surface/50 p-8 text-center md:mx-8">
          <p className="font-fraunces text-lg text-ink">
            Aucun plat ne correspond à «&nbsp;{query.trim()}&nbsp;»
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Vérifie l’orthographe ou ajoute une nouvelle idée dans ton carnet.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuery("")}
            >
              Effacer la recherche
            </Button>
            <Button asChild size="sm">
              <Link
                href={`/idees/nouvelle?nom=${encodeURIComponent(query.trim())}`}
              >
                Créer «&nbsp;{query.trim()}&nbsp;»
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 px-4 pb-8 md:grid-cols-2 md:px-8">
          {filtered.map((meal) => (
            <li key={meal.id}>
              <Link
                href={`/idees/${meal.id}`}
                className="tap-press block min-h-20 rounded-[1rem] bg-surface p-4 shadow-card"
              >
                <p className="font-fraunces text-xl break-words line-clamp-2">
                  {meal.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ingredientCountLabel(meal.ingredients.length)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
