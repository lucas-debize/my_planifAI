"use client"

import { useState, useTransition } from "react"
import { Globe, Loader2, Sparkles, TextQuote } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { extractRecipeAction } from "@/lib/actions/ai"
import { actionErrorMessage } from "@/lib/errors"
import type { ExtractedRecipe } from "@/lib/ai/recipe-extractor"
import { cn } from "@/lib/utils"

export function MagicRecipeDialog({
  onRecipeExtracted,
  trigger,
}: {
  onRecipeExtracted: (recipe: ExtractedRecipe) => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"text" | "url">("text")
  const [textContent, setTextContent] = useState("")
  const [urlContent, setUrlContent] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleExtract() {
    const content = tab === "text" ? textContent.trim() : urlContent.trim()
    if (!content) {
      toast.error(
        tab === "text"
          ? "Veuillez coller le texte ou les ingrédients d'une recette."
          : "Veuillez entrer une adresse URL."
      )
      return
    }

    startTransition(async () => {
      try {
        const recipe = await extractRecipeAction({
          mode: tab,
          content,
        })
        onRecipeExtracted(recipe)
        toast.success(
          `Recette extraite : « ${recipe.title} » (${recipe.ingredients.length} ingrédients)`
        )
        setOpen(false)
        setTextContent("")
        setUrlContent("")
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-medium text-primary hover:text-primary"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Import magique IA</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-fraunces text-lg">
                Import magique de recette
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Collez un texte brut ou un lien web : l&apos;IA extrait instantanément le titre
                et la liste des ingrédients nettoyés.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Onglets Texte vs URL */}
        <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "text"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("text")}
          >
            <TextQuote className="size-3.5" />
            <span>Texte ou mémo</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              tab === "url"
                ? "bg-card text-ink shadow-xs font-semibold"
                : "text-muted-foreground hover:text-ink"
            )}
            onClick={() => setTab("url")}
          >
            <Globe className="size-3.5" />
            <span>Lien Web (URL)</span>
          </button>
        </div>

        {tab === "text" ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={`Collez ici une recette complète ou une liste d'ingrédients...\n\nExemple :\nTarte aux poireaux et chèvre\n- 3 poireaux émincés\n- 200g de chèvre\n- 3 oeufs\n- 20cl de crème fraîche\n- 1 pâte feuilletée`}
              rows={8}
              className="resize-none font-sans text-xs"
              disabled={isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              ⚡ Détection locale instantanée : quantités, unités et découpes sont nettoyées
              automatiquement.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              type="url"
              value={urlContent}
              onChange={(e) => setUrlContent(e.target.value)}
              placeholder="https://www.marmiton.org/recettes/..."
              disabled={isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Compatible avec la majorité des sites culinaires (Marmiton, 750g, CuisineAZ,
              blogs avec métadonnées Recipe...).
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleExtract}
            disabled={isPending || (tab === "text" ? !textContent.trim() : !urlContent.trim())}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Extraction en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                <span>Extraire les ingrédients</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
