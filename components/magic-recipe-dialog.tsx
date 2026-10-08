"use client"

import { useRef, useState, useTransition } from "react"
import {
  Camera,
  Check,
  Globe,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  TextQuote,
  Trash2,
  X,
} from "lucide-react"
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
import { extractRecipeAction, extractRecipeFromImageAction } from "@/lib/actions/ai"
import { extractRecipeFromText } from "@/lib/ai/recipe-extractor"
import { actionErrorMessage } from "@/lib/errors"
import type { ExtractedRecipe, ExtractedIngredient } from "@/lib/ai/recipe-extractor"
import { cn } from "@/lib/utils"

export function MagicRecipeDialog({
  onRecipeExtracted,
  trigger,
}: {
  onRecipeExtracted: (recipe: ExtractedRecipe) => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"text" | "url" | "photo">("text")
  const [textContent, setTextContent] = useState("")
  const [urlContent, setUrlContent] = useState("")

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [transcribedText, setTranscribedText] = useState("")
  const [showTranscribedText, setShowTranscribedText] = useState(false)

  // Aperçu et ajustement des ingrédients extraits
  const [previewRecipe, setPreviewRecipe] = useState<ExtractedRecipe | null>(null)
  const [newIngName, setNewIngName] = useState("")
  const [newIngQty, setNewIngQty] = useState("")

  const [isPending, startTransition] = useTransition()

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetAll() {
    setTab("text")
    setTextContent("")
    setUrlContent("")
    setPhotoFile(null)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl(null)
    setTranscribedText("")
    setShowTranscribedText(false)
    setPreviewRecipe(null)
    setNewIngName("")
    setNewIngQty("")
  }

  function handleFileSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide.")
      return
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    const url = URL.createObjectURL(file)
    setPhotoFile(file)
    setPhotoPreviewUrl(url)
    setPreviewRecipe(null)
    setTranscribedText("")
    setShowTranscribedText(false)
  }

  function handleExtract() {
    if (tab === "photo") {
      if (!photoFile) {
        toast.error("Veuillez d'abord prendre ou choisir une photo.")
        return
      }

      startTransition(async () => {
        try {
          const formData = new FormData()
          formData.append("image", photoFile)
          const result = await extractRecipeFromImageAction(formData)
          setTranscribedText(result.transcribedText)
          setPreviewRecipe(result.recipe)
          toast.success(
            `Photo déchiffrée : ${result.recipe.detailedIngredients.length} ingrédients détectés`
          )
        } catch (err) {
          toast.error(actionErrorMessage(err))
        }
      })
      return
    }

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
        setPreviewRecipe(recipe)
        toast.success(
          `Recette extraite : ${recipe.detailedIngredients.length} ingrédients détectés`
        )
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  function handleReExtractFromTranscribedText() {
    if (!transcribedText.trim()) return
    const reExtracted = extractRecipeFromText(transcribedText)
    reExtracted.source = "image"
    setPreviewRecipe(reExtracted)
    toast.success("Recette ré-extraite depuis le texte corrigé")
  }

  function handleConfirmImport() {
    if (!previewRecipe) return
    const finalRecipe: ExtractedRecipe = {
      title: previewRecipe.title.trim() || "Nouvelle recette",
      ingredients: previewRecipe.detailedIngredients.map((i) => i.name),
      detailedIngredients: previewRecipe.detailedIngredients,
      source: previewRecipe.source ?? (tab === "photo" ? "image" : tab),
    }

    onRecipeExtracted(finalRecipe)
    toast.success(
      `Recette « ${finalRecipe.title} » ajoutée (${finalRecipe.detailedIngredients.length} ingrédients)`
    )
    setOpen(false)
    resetAll()
  }

  function updateIngredient(index: number, patch: Partial<ExtractedIngredient>) {
    if (!previewRecipe) return
    const updated = [...previewRecipe.detailedIngredients]
    updated[index] = { ...updated[index], ...patch }
    setPreviewRecipe({
      ...previewRecipe,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    })
  }

  function removeIngredient(index: number) {
    if (!previewRecipe) return
    const updated = previewRecipe.detailedIngredients.filter((_, i) => i !== index)
    setPreviewRecipe({
      ...previewRecipe,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    })
  }

  function addIngredient() {
    if (!previewRecipe || !newIngName.trim()) return
    const newEntry: ExtractedIngredient = {
      name: newIngName.trim(),
      quantity: newIngQty.trim() || undefined,
      raw: `${newIngQty.trim()} ${newIngName.trim()}`.trim(),
    }
    const updated = [...previewRecipe.detailedIngredients, newEntry]
    setPreviewRecipe({
      ...previewRecipe,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    })
    setNewIngName("")
    setNewIngQty("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetAll()
      }}
    >
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

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-fraunces text-lg">
                Import magique de recette
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Photographiez une page de livre, collez un texte ou entrez un lien :
                l&apos;IA extrait automatiquement le titre et les ingrédients avec quantités.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Étape 1 : Saisie de la source (si aucune prévisualisation active) */}
        {!previewRecipe ? (
          <>
            {/* Onglets Texte vs URL vs Photo */}
            <div className="grid grid-cols-3 rounded-xl bg-muted/60 p-1 text-xs font-medium">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all",
                  tab === "text"
                    ? "bg-card text-ink shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-ink"
                )}
                onClick={() => setTab("text")}
              >
                <TextQuote className="size-3.5" />
                <span>Texte</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all",
                  tab === "url"
                    ? "bg-card text-ink shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-ink"
                )}
                onClick={() => setTab("url")}
              >
                <Globe className="size-3.5" />
                <span>Lien Web</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-all",
                  tab === "photo"
                    ? "bg-card text-ink shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-ink"
                )}
                onClick={() => setTab("photo")}
              >
                <Camera className="size-3.5" />
                <span>Photo (OCR)</span>
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
                  ⚡ Détection intelligente des quantités, des unités et des noms d&apos;ingrédients.
                </p>
              </div>
            ) : tab === "url" ? (
              <div className="flex flex-col gap-2">
                <Input
                  type="url"
                  value={urlContent}
                  onChange={(e) => setUrlContent(e.target.value)}
                  placeholder="https://www.marmiton.org/recettes/..."
                  disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Compatible Marmiton, 750g, CuisineAZ, et les blogs culinaires avec données de recettes.
                </p>
              </div>
            ) : (
              /* Onglet Photo / OCR */
              <div className="flex flex-col gap-3">
                {/* Inputs de fichiers cachés */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelected(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelected(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />

                {photoPreviewUrl ? (
                  <div className="relative flex flex-col items-center gap-2 rounded-xl border border-line bg-muted/30 p-3">
                    <img
                      src={photoPreviewUrl}
                      alt="Aperçu de la recette"
                      className="max-h-52 w-auto rounded-lg object-contain shadow-xs"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{photoFile?.name}</span>
                      <span>·</span>
                      <span>
                        {photoFile
                          ? `${Math.round(photoFile.size / 1024)} Ko`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isPending}
                      >
                        Changer d&apos;image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setPhotoFile(null)
                          if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
                          setPhotoPreviewUrl(null)
                        }}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Supprimer</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-muted/20 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Camera className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Photographiez votre recette
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Page de livre de cuisine, fiche recette ou note manuscrite.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="size-4" />
                        <span>Prendre une photo</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="size-4" />
                        <span>Choisir une image</span>
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  📷 <strong>Sur iPhone</strong> : le bouton « Prendre une photo » ouvre directement votre appareil photo dorsal.
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
                disabled={
                  isPending ||
                  (tab === "text" && !textContent.trim()) ||
                  (tab === "url" && !urlContent.trim()) ||
                  (tab === "photo" && !photoFile)
                }
                className="gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>
                      {tab === "photo" ? "Lecture de la photo..." : "Extraction..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>
                      {tab === "photo" ? "Scanner la photo" : "Extraire les ingrédients"}
                    </span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Étape 2 : Vérification et ajustement des quantités et ingrédients extraits */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  ✓
                </span>
                <span className="text-sm font-semibold text-ink">
                  Recette détectée ({previewRecipe.detailedIngredients.length} ingrédients)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-ink"
                onClick={() => setPreviewRecipe(null)}
              >
                <RotateCcw className="mr-1 size-3" />
                Recommencer
              </Button>
            </div>

            {/* Titre éditable */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="preview-recipe-title" className="text-xs font-medium text-muted-foreground">
                Titre de la recette
              </label>
              <Input
                id="preview-recipe-title"
                value={previewRecipe.title}
                onChange={(e) =>
                  setPreviewRecipe({ ...previewRecipe, title: e.target.value })
                }
                className="font-fraunces text-base font-semibold"
                placeholder="Nom de la recette"
              />
            </div>

            {/* Liste des ingrédients avec quantités modulables */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Ingrédients &amp; Quantités modulables
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Ajustez les quantités ci-dessous
                </span>
              </div>

              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                {previewRecipe.detailedIngredients.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Aucun ingrédient dans la liste. Ajoutez-en un ci-dessous.
                  </p>
                ) : (
                  previewRecipe.detailedIngredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-md border border-line/60 bg-background px-2 py-1.5 text-xs transition-colors hover:border-line"
                    >
                      {/* Champ Quantité */}
                      <Input
                        value={ing.quantity ?? ""}
                        placeholder="Qté (ex: 200g)"
                        aria-label={`Quantité de ${ing.name}`}
                        onChange={(e) =>
                          updateIngredient(idx, { quantity: e.target.value || undefined })
                        }
                        className="h-8 w-24 shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium"
                      />
                      {/* Champ Nom */}
                      <Input
                        value={ing.name}
                        placeholder="Nom de l'ingrédient"
                        aria-label={`Nom de l'ingrédient ${idx + 1}`}
                        onChange={(e) =>
                          updateIngredient(idx, { name: e.target.value })
                        }
                        className="h-8 min-w-0 flex-1 rounded px-2 py-0.5 text-xs"
                      />
                      {/* Bouton Supprimer */}
                      <button
                        type="button"
                        onClick={() => removeIngredient(idx)}
                        aria-label={`Supprimer ${ing.name}`}
                        className="tap-press inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Formulaire rapide pour ajouter un ingrédient */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newIngQty}
                  onChange={(e) => setNewIngQty(e.target.value)}
                  placeholder="Qté (ex: 3)"
                  className="h-8 w-24 shrink-0 text-xs"
                />
                <Input
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Ajouter un ingrédient..."
                  className="h-8 min-w-0 flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addIngredient()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2.5 text-xs"
                  onClick={addIngredient}
                  disabled={!newIngName.trim()}
                >
                  <Plus className="size-3.5" />
                  <span>Ajouter</span>
                </Button>
              </div>
            </div>

            {/* Volet texte transcrit éditable (si OCR photo) */}
            {transcribedText ? (
              <div className="rounded-lg border border-line bg-muted/30 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowTranscribedText(!showTranscribedText)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink hover:underline"
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                    <span>
                      {showTranscribedText
                        ? "Masquer le texte retranscrit"
                        : "Corriger le texte brut reconnu (OCR)"}
                    </span>
                  </button>
                </div>
                {showTranscribedText ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <Textarea
                      value={transcribedText}
                      onChange={(e) => setTranscribedText(e.target.value)}
                      rows={5}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit text-xs"
                      onClick={handleReExtractFromTranscribedText}
                    >
                      <RotateCcw className="mr-1.5 size-3" />
                      Ré-extraire depuis le texte corrigé
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewRecipe(null)}
              >
                Retour
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={previewRecipe.detailedIngredients.length === 0}
                className="gap-2"
              >
                <Check className="size-4" />
                <span>Valider et importer</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
