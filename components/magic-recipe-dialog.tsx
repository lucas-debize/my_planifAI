"use client"

import { useRef, useState, useTransition } from "react"
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Image as ImageIcon,
  Layers,
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
import { extractRecipeAction } from "@/lib/actions/ai"
import { scanImageClient } from "@/lib/ai/client-scan"
import { batchCreateMealsAction, upsertMeal } from "@/lib/actions/meals"
import {
  extractRecipeFromText,
  extractMealsFromText,
  type ExtractedRecipe,
  type ExtractedIngredient,
  type ExtractedMealBatch,
} from "@/lib/ai/recipe-extractor"
import type { MealWithIngredients } from "@/lib/domain/meals"
import { actionErrorMessage } from "@/lib/errors"
import { optimizeImageForOcr } from "@/lib/images/optimize"
import { cn } from "@/lib/utils"

export function MagicRecipeDialog({
  onRecipeExtracted,
  onBatchImported,
  trigger,
}: {
  onRecipeExtracted?: (recipe: ExtractedRecipe) => void
  onBatchImported?: (meals: MealWithIngredients[]) => void
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

  // Aperçu du lot extrait (plat unique ou liste/planning)
  const [previewBatch, setPreviewBatch] = useState<ExtractedMealBatch | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())
  const [batchNewIng, setBatchNewIng] = useState<Record<number, { name: string; qty: string }>>({})
  const [newIngName, setNewIngName] = useState("")
  const [newIngQty, setNewIngQty] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [importMode, setImportMode] = useState<"planning" | "recipe">("planning")
  const [scanStatus, setScanStatus] = useState<string | null>(null)
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
    setPreviewBatch(null)
    setSelectedIndices(new Set())
    setExpandedIndices(new Set())
    setBatchNewIng({})
    setNewIngName("")
    setNewIngQty("")
    setIsSaving(false)
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide.")
      return
    }
    const optimized = await optimizeImageForOcr(file)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    const url = URL.createObjectURL(optimized)
    setPhotoFile(optimized)
    setPhotoPreviewUrl(url)
    setPreviewBatch(null)
    setSelectedIndices(new Set())
    setExpandedIndices(new Set())
    setBatchNewIng({})
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
          setScanStatus("Analyse de la photo...")
          const formData = new FormData()
          formData.append("image", photoFile)
          formData.append("importMode", importMode)
          const result = await scanImageClient(formData, (percent, label) => {
            setScanStatus(`${label} (${percent}%)`)
          })
          setTranscribedText(result.transcribedText)
          setPreviewBatch(result.result)
          setSelectedIndices(new Set(result.result.meals.map((_, i) => i)))
          setExpandedIndices(new Set())
          if (result.usedClientOcr) {
            toast.success("Déchiffré gratuitement avec l'OCR local !")
          } else if (result.result.kind === "list") {
            toast.success(
              `Planning détecté : ${result.result.meals.length} plats identifiés`
            )
          } else {
            toast.success(
              `Photo déchiffrée : ${result.result.meals[0]?.detailedIngredients.length ?? 0} ingrédients détectés`
            )
          }
        } catch (err) {
          toast.error(actionErrorMessage(err))
        } finally {
          setScanStatus(null)
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
        const batch = await extractRecipeAction({
          mode: tab,
          content,
          importMode,
        })
        setSelectedIndices(new Set(batch.meals.map((_, i) => i)))
        setExpandedIndices(new Set())
        if (batch.kind === "list") {
          toast.success(`Planning détecté : ${batch.meals.length} plats identifiés`)
        } else {
          toast.success(
            `Recette extraite : ${batch.meals[0]?.detailedIngredients.length ?? 0} ingrédients détectés`
          )
        }
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  function handleReExtractFromTranscribedText() {
    if (!transcribedText.trim()) return
    const batch = extractMealsFromText(
      transcribedText,
      "image",
      importMode === "planning" ? "list" : undefined
    )
    setSelectedIndices(new Set(batch.meals.map((_, i) => i)))
    setExpandedIndices(new Set())
    toast.success(
      batch.kind === "list"
        ? `Planning ré-extrait : ${batch.meals.length} plats identifiés`
        : "Recette ré-extraite depuis le texte corrigé"
    )
  }

  function toggleSelected(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function selectAll() {
    if (!previewBatch) return
    setSelectedIndices(new Set(previewBatch.meals.map((_, i) => i)))
  }

  function deselectAll() {
    setSelectedIndices(new Set())
  }

  function toggleExpanded(idx: number) {
    setExpandedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function updateSingleMealTitle(title: string) {
    if (!previewBatch || previewBatch.meals.length === 0) return
    const updated = [...previewBatch.meals]
    updated[0] = { ...updated[0], title }
    setPreviewBatch({ ...previewBatch, meals: updated })
  }

  function updateSingleIngredient(index: number, patch: Partial<ExtractedIngredient>) {
    if (!previewBatch || previewBatch.meals.length === 0) return
    const meal = previewBatch.meals[0]
    const updated = [...meal.detailedIngredients]
    updated[index] = { ...updated[index], ...patch }
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[0] = {
      ...meal,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
  }

  function removeSingleIngredient(index: number) {
    if (!previewBatch || previewBatch.meals.length === 0) return
    const meal = previewBatch.meals[0]
    const updated = meal.detailedIngredients.filter((_, i) => i !== index)
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[0] = {
      ...meal,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
  }

  function addSingleIngredient() {
    if (!previewBatch || previewBatch.meals.length === 0 || !newIngName.trim()) return
    const meal = previewBatch.meals[0]
    const newEntry: ExtractedIngredient = {
      name: newIngName.trim(),
      quantity: newIngQty.trim() || undefined,
      raw: `${newIngQty.trim()} ${newIngName.trim()}`.trim(),
    }
    const updated = [...meal.detailedIngredients, newEntry]
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[0] = {
      ...meal,
      detailedIngredients: updated,
      ingredients: updated.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
    setNewIngName("")
    setNewIngQty("")
  }

  async function handleConfirmSingleImport() {
    if (!previewBatch || previewBatch.meals.length === 0) return
    const meal = previewBatch.meals[0]
    const finalRecipe: ExtractedRecipe = {
      title: meal.title.trim() || "Nouvelle recette",
      ingredients: meal.detailedIngredients.map((i) => i.name),
      detailedIngredients: meal.detailedIngredients,
      source: meal.source ?? (tab === "photo" ? "image" : tab),
      isDefaultRecipe: meal.isDefaultRecipe,
    }

    if (onRecipeExtracted) {
      onRecipeExtracted(finalRecipe)
      toast.success(
        `Recette « ${finalRecipe.title} » ajoutée (${finalRecipe.detailedIngredients.length} ingrédients)`
      )
      setOpen(false)
      resetAll()
      return
    }

    setIsSaving(true)
    try {
      const created = await upsertMeal({
        name: finalRecipe.title,
        ingredientNames: finalRecipe.detailedIngredients.map((i) => ({
          name: i.name,
          quantity: i.quantity,
        })),
      })
      onBatchImported?.([created])
      toast.success(`Idée « ${created.name} » enregistrée dans vos idées`)
      setOpen(false)
      resetAll()
    } catch (err) {
      toast.error(actionErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  function updateBatchMealTitle(mealIdx: number, title: string) {
    if (!previewBatch) return
    const updated = [...previewBatch.meals]
    updated[mealIdx] = { ...updated[mealIdx], title }
    setPreviewBatch({ ...previewBatch, meals: updated })
  }

  function updateBatchIngredient(
    mealIdx: number,
    ingIdx: number,
    patch: Partial<ExtractedIngredient>
  ) {
    if (!previewBatch) return
    const meal = previewBatch.meals[mealIdx]
    const updatedDetailed = [...meal.detailedIngredients]
    updatedDetailed[ingIdx] = { ...updatedDetailed[ingIdx], ...patch }
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[mealIdx] = {
      ...meal,
      detailedIngredients: updatedDetailed,
      ingredients: updatedDetailed.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
  }

  function removeBatchIngredient(mealIdx: number, ingIdx: number) {
    if (!previewBatch) return
    const meal = previewBatch.meals[mealIdx]
    const updatedDetailed = meal.detailedIngredients.filter((_, i) => i !== ingIdx)
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[mealIdx] = {
      ...meal,
      detailedIngredients: updatedDetailed,
      ingredients: updatedDetailed.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
  }

  function addBatchIngredient(mealIdx: number) {
    const current = batchNewIng[mealIdx]
    if (!previewBatch || !current?.name?.trim()) return
    const meal = previewBatch.meals[mealIdx]
    const newEntry: ExtractedIngredient = {
      name: current.name.trim(),
      quantity: current.qty.trim() || undefined,
      raw: `${current.qty.trim()} ${current.name.trim()}`.trim(),
    }
    const updatedDetailed = [...meal.detailedIngredients, newEntry]
    const updatedMeals = [...previewBatch.meals]
    updatedMeals[mealIdx] = {
      ...meal,
      detailedIngredients: updatedDetailed,
      ingredients: updatedDetailed.map((i) => i.name),
    }
    setPreviewBatch({ ...previewBatch, meals: updatedMeals })
    setBatchNewIng((prev) => ({ ...prev, [mealIdx]: { name: "", qty: "" } }))
  }

  function handleUseSingleMealFromBatch(mealIdx: number) {
    if (!previewBatch || !previewBatch.meals[mealIdx] || !onRecipeExtracted) return
    const meal = previewBatch.meals[mealIdx]
    onRecipeExtracted(meal)
    toast.success(`Plat « ${meal.title} » sélectionné pour le formulaire`)
    setOpen(false)
    resetAll()
  }

  async function handleConfirmBatchImport() {
    if (!previewBatch || previewBatch.kind !== "list") return
    const selectedMeals = previewBatch.meals.filter((_, idx) => selectedIndices.has(idx))
    if (selectedMeals.length === 0) {
      toast.error("Veuillez sélectionner au moins un plat à importer.")
      return
    }

    setIsSaving(true)
    try {
      const payload = selectedMeals.map((m) => ({
        name: m.title.trim() || "Plat sans nom",
        ingredientNames: m.detailedIngredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
        })),
      }))
      const created = await batchCreateMealsAction(payload)
      onBatchImported?.(created)
      toast.success(
        `${created.length} plat${created.length > 1 ? "s" : ""} importé${created.length > 1 ? "s" : ""} dans vos idées !`
      )
      setOpen(false)
      resetAll()
    } catch (err) {
      toast.error(actionErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
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
            className="tap-press min-h-10 gap-1.5 rounded-xl border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 shadow-2xs transition-all sm:min-h-11 sm:text-sm"
          >
            <Sparkles className="size-4 text-primary" />
            <span>Import magique IA</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto sm:max-w-lg transition-all",
          previewBatch?.kind === "list" && "sm:max-w-2xl"
        )}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {previewBatch?.kind === "list" ? (
                <Layers className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </div>
            <div>
              <DialogTitle className="font-fraunces text-lg">
                {previewBatch
                  ? previewBatch.kind === "list"
                    ? `Planning détecté · ${previewBatch.meals.length} plats identifiés`
                    : "Recette détectée"
                  : importMode === "planning"
                    ? "Import d'un planning de repas"
                    : "Import d'une recette"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {previewBatch
                  ? previewBatch.kind === "list"
                    ? "Une recette par défaut a été automatiquement attribuée à chaque plat. Ajustez les ingrédients avant d'importer."
                    : "Vérifiez le titre et ajustez les quantités des ingrédients avant de valider."
                  : importMode === "planning"
                    ? "Photographiez ou collez votre semainier pour extraire tous les plats et les ajouter en bloc à vos idées."
                    : "Photographiez une recette, collez un texte ou entrez un lien pour extraire ses ingrédients avec quantités."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Étape 1 : Saisie de la source (si aucune prévisualisation active) */}
        {!previewBatch ? (
          <>
            {/* Sélecteur de type d'import */}
            <div className="flex flex-col gap-1 rounded-xl border border-line/60 bg-muted/20 p-1.5 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Type de document à importer
              </span>
              <div className="grid grid-cols-2 gap-1 font-medium">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-all",
                    importMode === "planning"
                      ? "bg-card text-primary shadow-xs font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-ink"
                  )}
                  onClick={() => setImportMode("planning")}
                >
                  <Layers className="size-3.5" />
                  <span>Planning (idées multiples)</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-all",
                    importMode === "recipe"
                      ? "bg-card text-primary shadow-xs font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-ink"
                  )}
                  onClick={() => setImportMode("recipe")}
                >
                  <Sparkles className="size-3.5" />
                  <span>Recette unique</span>
                </button>
              </div>
            </div>

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
                  placeholder={
                    importMode === "planning"
                      ? `Collez ou dictez vos repas de la semaine...\n\nExemple :\nSamedi : Haricot vert / Poisson\n- Panini\nDimanche : Steak patate\n- Nems / Riz cantonais\nLundi : Reste\n- Tartiflette\nMardi : Steak frites...`
                      : `Collez ici une recette complète ou une liste d'ingrédients...\n\nExemple :\nTarte aux poireaux et chèvre\n- 3 poireaux émincés\n- 200g de chèvre\n- 3 oeufs\n- 20cl de crème fraîche`
                  }
                  rows={7}
                  className="resize-none font-sans text-xs"
                  disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  💡 <strong>Astuce</strong> : Touchez l&apos;icône micro du clavier de votre smartphone pour dicter votre liste en 10 secondes !
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
                      {tab === "photo"
                        ? scanStatus || "Lecture de la photo..."
                        : "Extraction..."}
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
        ) : previewBatch.kind === "list" ? (
          /* Étape 2A : Aperçu et ajustement d'une liste de plats / planning */
          <div className="flex flex-col gap-4">
            {/* Barre d'outils et statistiques de sélection */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/60 bg-muted/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  ✓
                </span>
                <span className="text-xs font-medium text-ink">
                  {selectedIndices.size} sur {previewBatch.meals.length} plat{previewBatch.meals.length > 1 ? "s" : ""} sélectionné{selectedIndices.size > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-ink"
                  onClick={selectAll}
                >
                  Tout sélectionner
                </Button>
                <span className="text-muted-foreground/40">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-ink"
                  onClick={deselectAll}
                >
                  Tout désélectionner
                </Button>
                <span className="text-muted-foreground/40">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-ink"
                  onClick={() => setPreviewBatch(null)}
                >
                  <RotateCcw className="mr-1 size-3" />
                  Recommencer
                </Button>
              </div>
            </div>

            {/* Note d'information */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-primary">
              <Sparkles className="size-3.5 shrink-0" />
              <span>
                Une recette par défaut a été automatiquement attribuée à chaque plat. Vous pouvez ajuster les ingrédients maintenant ou plus tard dans vos idées.
              </span>
            </div>

            {/* Liste scrollable des cartes de plats */}
            <div className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto pr-1">
              {previewBatch.meals.map((meal, mealIdx) => {
                const isSelected = selectedIndices.has(mealIdx)
                const isExpanded = expandedIndices.has(mealIdx)
                const currentNew = batchNewIng[mealIdx] ?? { name: "", qty: "" }

                return (
                  <div
                    key={mealIdx}
                    className={cn(
                      "flex flex-col rounded-xl border transition-all",
                      isSelected
                        ? "border-line bg-card shadow-xs"
                        : "border-line/40 bg-muted/20 opacity-70"
                    )}
                  >
                    {/* Ligne principale du plat */}
                    <div className="flex items-center gap-2 p-2.5 sm:gap-3">
                      {/* Checkbox de sélection */}
                      <button
                        type="button"
                        onClick={() => toggleSelected(mealIdx)}
                        aria-label={isSelected ? `Désélectionner ${meal.title}` : `Sélectionner ${meal.title}`}
                        className={cn(
                          "tap-press flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-line bg-background text-transparent hover:border-line-hover"
                        )}
                      >
                        <Check className="size-3.5 stroke-[3]" />
                      </button>

                      {/* Titre éditable */}
                      <Input
                        value={meal.title}
                        onChange={(e) => updateBatchMealTitle(mealIdx, e.target.value)}
                        placeholder="Nom du plat"
                        className="h-8 min-w-0 flex-1 font-fraunces text-sm font-semibold"
                      />

                      {/* Badge type de recette */}
                      <span
                        className={cn(
                          "hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
                          meal.isDefaultRecipe
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {meal.isDefaultRecipe
                          ? `Recette par défaut (${meal.detailedIngredients.length})`
                          : `${meal.detailedIngredients.length} ingr.`}
                      </span>

                      {/* Option pour MealForm : Utiliser ce plat */}
                      {onRecipeExtracted ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleUseSingleMealFromBatch(mealIdx)}
                          title="Utiliser ce plat pour le formulaire en cours"
                        >
                          Utiliser
                        </Button>
                      ) : null}

                      {/* Bouton accordéon pour voir/modifier les ingrédients */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => toggleExpanded(mealIdx)}
                        aria-label={isExpanded ? "Masquer les ingrédients" : "Voir les ingrédients"}
                      >
                        <span className="hidden sm:inline">
                          {isExpanded ? "Masquer" : "Ingrédients"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </Button>
                    </div>

                    {/* Accordéon déroulé : Ingrédients du plat */}
                    {isExpanded ? (
                      <div className="border-t border-line/60 bg-surface/60 p-3 pt-2 text-xs">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            Ingrédients de la recette ({meal.detailedIngredients.length})
                          </span>
                          <span>Modifiables ci-dessous</span>
                        </div>

                        <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
                          {meal.detailedIngredients.length === 0 ? (
                            <p className="py-2 text-center text-xs text-muted-foreground">
                              Aucun ingrédient. Ajoutez-en un ci-dessous.
                            </p>
                          ) : (
                            meal.detailedIngredients.map((ing, ingIdx) => (
                              <div
                                key={ingIdx}
                                className="flex items-center gap-1.5 rounded-md border border-line/50 bg-background px-2 py-1"
                              >
                                <Input
                                  value={ing.quantity ?? ""}
                                  placeholder="Qté"
                                  onChange={(e) =>
                                    updateBatchIngredient(mealIdx, ingIdx, {
                                      quantity: e.target.value || undefined,
                                    })
                                  }
                                  className="h-7 w-20 shrink-0 font-mono text-[11px]"
                                />
                                <Input
                                  value={ing.name}
                                  placeholder="Nom"
                                  onChange={(e) =>
                                    updateBatchIngredient(mealIdx, ingIdx, {
                                      name: e.target.value,
                                    })
                                  }
                                  className="h-7 min-w-0 flex-1 text-[11px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeBatchIngredient(mealIdx, ingIdx)}
                                  className="tap-press inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Ajout rapide d'ingrédient */}
                        <div className="mt-2 flex items-center gap-1.5 pt-1">
                          <Input
                            value={currentNew.qty}
                            onChange={(e) =>
                              setBatchNewIng((prev) => ({
                                ...prev,
                                [mealIdx]: { ...currentNew, qty: e.target.value },
                              }))
                            }
                            placeholder="Qté"
                            className="h-7 w-20 shrink-0 text-[11px]"
                          />
                          <Input
                            value={currentNew.name}
                            onChange={(e) =>
                              setBatchNewIng((prev) => ({
                                ...prev,
                                [mealIdx]: { ...currentNew, name: e.target.value },
                              }))
                            }
                            placeholder="Ajouter un ingrédient..."
                            className="h-7 min-w-0 flex-1 text-[11px]"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addBatchIngredient(mealIdx)
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => addBatchIngredient(mealIdx)}
                            disabled={!currentNew.name.trim()}
                          >
                            <Plus className="mr-1 size-3" />
                            Ajouter
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
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
                      rows={4}
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

            {/* Pied de page du mode liste */}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewBatch(null)}
                disabled={isSaving}
              >
                Retour
              </Button>
              <Button
                type="button"
                onClick={handleConfirmBatchImport}
                disabled={selectedIndices.size === 0 || isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                <span>
                  Importer les {selectedIndices.size} plat{selectedIndices.size > 1 ? "s" : ""} sélectionné{selectedIndices.size > 1 ? "s" : ""}
                </span>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Étape 2B : Plat unique - Vérification et ajustement des quantités et ingrédients */
          (() => {
            const singleRecipe = previewBatch.meals[0] || {
              title: "Nouvelle recette",
              ingredients: [],
              detailedIngredients: [],
            }

            return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      ✓
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      Recette détectée ({singleRecipe.detailedIngredients.length} ingrédients)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-ink"
                    onClick={() => setPreviewBatch(null)}
                  >
                    <RotateCcw className="mr-1 size-3" />
                    Recommencer
                  </Button>
                </div>

                {/* Badge d'information si recette par défaut */}
                {singleRecipe.isDefaultRecipe ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-primary">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span>
                      <strong>Recette par défaut attribuée :</strong> Ce plat n&apos;avait pas d&apos;ingrédients listés dans la source. Une recette équilibrée a été générée automatiquement et reste modifiable ci-dessous.
                    </span>
                  </div>
                ) : null}

                {/* Titre éditable */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="preview-recipe-title" className="text-xs font-medium text-muted-foreground">
                    Titre de la recette
                  </label>
                  <Input
                    id="preview-recipe-title"
                    value={singleRecipe.title}
                    onChange={(e) => updateSingleMealTitle(e.target.value)}
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
                    {singleRecipe.detailedIngredients.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Aucun ingrédient dans la liste. Ajoutez-en un ci-dessous.
                      </p>
                    ) : (
                      singleRecipe.detailedIngredients.map((ing, idx) => (
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
                              updateSingleIngredient(idx, { quantity: e.target.value || undefined })
                            }
                            className="h-8 w-24 shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium"
                          />
                          {/* Champ Nom */}
                          <Input
                            value={ing.name}
                            placeholder="Nom de l'ingrédient"
                            aria-label={`Nom de l'ingrédient ${idx + 1}`}
                            onChange={(e) =>
                              updateSingleIngredient(idx, { name: e.target.value })
                            }
                            className="h-8 min-w-0 flex-1 rounded px-2 py-0.5 text-xs"
                          />
                          {/* Bouton Supprimer */}
                          <button
                            type="button"
                            onClick={() => removeSingleIngredient(idx)}
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
                          addSingleIngredient()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={addSingleIngredient}
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
                    onClick={() => setPreviewBatch(null)}
                    disabled={isSaving}
                  >
                    Retour
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmSingleImport}
                    disabled={singleRecipe.detailedIngredients.length === 0 || isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    <span>
                      {onRecipeExtracted ? "Valider et importer" : "Enregistrer dans mes idées"}
                    </span>
                  </Button>
                </DialogFooter>
              </div>
            )
          })()
        )}
      </DialogContent>
    </Dialog>
  )
}
