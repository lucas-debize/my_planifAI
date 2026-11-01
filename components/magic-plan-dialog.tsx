"use client"

import { useRef, useState, useTransition } from "react"
import { addDays } from "date-fns"
import {
  Camera,
  Check,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  TextQuote,
  Trash2,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { currentWeekStartIso, isPastDay, parseISODate, slotTitleDate } from "@/lib/dates"
import type { WeekStartDay } from "@/lib/domain/session"
import { SLOT_LABEL, type SlotKind } from "@/lib/week"
import {
  generateWeekPlanProposal,
  rerollSlot,
  type AutoPlanOptions,
  type PlanProposal,
} from "@/lib/ai/auto-planner"
import {
  extractMealsFromText,
  parsePlanningToWeekSlots,
  getDefaultRecipeForDish,
  type ExtractedRecipe,
} from "@/lib/ai/recipe-extractor"
import { scanImageClient } from "@/lib/ai/client-scan"
import { applyAutoPlanAction } from "@/lib/actions/auto-plan"
import { optimizeImageForOcr } from "@/lib/images/optimize"
import { actionErrorMessage } from "@/lib/errors"
import type { MealWithIngredients } from "@/lib/domain/meals"
import type { WeekSlot } from "@/lib/domain/slots"
import { cn } from "@/lib/utils"

export function MagicPlanDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slots: WeekSlot[]
  meals: MealWithIngredients[]
  weekStart?: string
  onApplied: (
    appliedSlots: {
      date: string
      kind: SlotKind
      meal: { id: string; name: string }
    }[]
  ) => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <MagicPlanModalContent {...props} /> : null}
    </Dialog>
  )
}

function MagicPlanModalContent({
  onOpenChange,
  slots,
  meals,
  weekStart,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void
  slots: WeekSlot[]
  meals: MealWithIngredients[]
  weekStart?: string
  onApplied: (
    appliedSlots: {
      date: string
      kind: SlotKind
      meal: { id: string; name: string }
    }[]
  ) => void
}) {
  const [activeTab, setActiveTab] = useState<"generator" | "scan">("generator")

  // --- État Générateur automatique ---
  const [onlyCatalog, setOnlyCatalog] = useState(true)
  const [stockOrCravings, setStockOrCravings] = useState("")
  const [proposals, setProposals] = useState<PlanProposal[]>(() =>
    generateWeekPlanProposal({
      slots,
      catalogMeals: meals,
      options: { mode: "balanced", onlyCatalog: true },
    })
  )
  const [isApplying, startApplyTransition] = useTransition()

  // --- État Scanner / Photo / Texte ---
  const [scanSource, setScanSource] = useState<"photo" | "text">("photo")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [textInput, setTextInput] = useState("")
  const [isAnalyzing, startAnalyzeTransition] = useTransition()
  const [detectedSlots, setDetectedSlots] = useState<
    {
      date: string
      kind: SlotKind
      mealName: string
      selected: boolean
      isPast?: boolean
      hasExistingMeal?: boolean
    }[]
  >([])
  const [extractedBatchMeals, setExtractedBatchMeals] = useState<ExtractedRecipe[]>([])
  const [scanStatus, setScanStatus] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const emptySlotsCount = slots.filter((s) => s.meal === null).length
  const baseWeekStart = weekStart ?? slots[0]?.slot_date ?? ""
  const baseWeekDate = parseISODate(baseWeekStart)
  // Une semaine est entièrement passée si son dernier jour (baseWeekDate + 6 jours) est antérieur à aujourd'hui
  const isEntireWeekPast = Boolean(
    baseWeekDate && isPastDay(addDays(baseWeekDate, 6))
  )
  const currentStartDay = (baseWeekDate?.getDay() ?? 1) as WeekStartDay
  const effectiveWeekStart = isEntireWeekPast
    ? currentWeekStartIso(new Date(), currentStartDay)
    : baseWeekStart

  const selectedScanSlots = detectedSlots.filter((slot) => slot.selected && slot.mealName.trim())
  const firstScanDate = selectedScanSlots[0] ? parseISODate(selectedScanSlots[0].date) : null
  const lastScanSlot = selectedScanSlots.at(-1)
  const lastScanDate = lastScanSlot ? parseISODate(lastScanSlot.date) : null

  function generate(catalog = onlyCatalog, text = stockOrCravings) {
    const opts: AutoPlanOptions = {
      mode: "balanced",
      onlyCatalog: catalog,
      stockOrCravings: text,
    }
    const generated = generateWeekPlanProposal({
      slots,
      catalogMeals: meals,
      options: opts,
    })
    setProposals(generated)
  }

  function handleRerollSlot(index: number) {
    const target = proposals[index]
    if (!target) return

    const replacement = rerollSlot({
      slot: { date: target.date, kind: target.kind },
      currentMealName: target.meal.name,
      proposals,
      catalogMeals: meals,
      existingSlots: slots,
      options: {
        mode: "balanced",
        onlyCatalog,
        stockOrCravings,
      },
    })

    if (!replacement) {
      toast.info(
        onlyCatalog
          ? "Aucun autre plat disponible dans votre carnet pour ce créneau."
          : "Aucune autre alternative disponible pour ce créneau."
      )
      return
    }

    setProposals((current) => {
      const next = [...current]
      next[index] = {
        ...target,
        meal: replacement,
      }
      return next
    })
    toast.success(`Créneau remplacé : « ${replacement.name} »`)
  }

  function handleApplyGenerator() {
    if (proposals.length === 0) return

    startApplyTransition(async () => {
      try {
        const result = await applyAutoPlanAction(
          proposals.map((p) => ({
            date: p.date,
            kind: p.kind,
            meal: {
              id: p.meal.id,
              name: p.meal.name,
              ingredients: p.meal.ingredients,
              origin: p.meal.origin,
            },
          }))
        )
        onApplied(result.slots)
        toast.success(
          `${result.count} repas planifié${result.count > 1 ? "s" : ""} ! Les ingrédients sont ajoutés aux courses.`
        )
        onOpenChange(false)
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  // --- Handlers Scanner / Photo ---
  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide.")
      return
    }

    const optimized = await optimizeImageForOcr(file)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(optimized)
    setPhotoPreviewUrl(URL.createObjectURL(optimized))
    setDetectedSlots([])
  }

  function handleAnalyze() {
    if (scanSource === "photo") {
      if (!photoFile) {
        toast.error("Veuillez d'abord prendre ou choisir une photo.")
        return
      }

      startAnalyzeTransition(async () => {
        try {
          setScanStatus("Préparation de l'image...")
          const formData = new FormData()
          formData.append("image", photoFile)
          const result = await scanImageClient(formData, (percent, label) => {
            setScanStatus(`${label} (${percent}%)`)
          })
          processTranscribedText(result.transcribedText)
        } catch (err) {
          toast.error(actionErrorMessage(err))
        } finally {
          setScanStatus(null)
        }
      })
      return
    }

    if (!textInput.trim()) {
      toast.error("Veuillez entrer du texte pour votre planning.")
      return
    }

    processTranscribedText(textInput)
  }

  function processTranscribedText(text: string) {
    if (isEntireWeekPast) {
      toast.info(
        "Cette semaine étant déjà terminée, le planning scanné a été attribué à la semaine actuelle.",
        { duration: 4000 }
      )
    }

    const parsedSlots = parsePlanningToWeekSlots(text, effectiveWeekStart)
    const batch = extractMealsFromText(text, "image")
    setExtractedBatchMeals(batch.meals)

    if (parsedSlots.length > 0) {
      setDetectedSlots(
        parsedSlots.map((s) => {
          const sDate = parseISODate(s.date)
          const isPast = sDate ? isPastDay(sDate) : false
          const existing = slots.find(
            (slot) => slot.slot_date === s.date && slot.slot_kind === s.kind
          )
          const hasExistingMeal = Boolean(existing?.meal)
          return {
            date: s.date,
            kind: s.kind,
            mealName: s.mealName,
            // Ne pas écraser ni présélectionner les jours passés de la semaine déjà faite
            selected: !isPast,
            isPast,
            hasExistingMeal,
          }
        })
      )
      toast.success(`${parsedSlots.length} repas détectés avec leurs jours !`)
      return
    }

    // Repli : extraction de plats simples sans jours identifiés
    if (batch.meals.length > 0) {
      // Prioriser les créneaux futurs ou d'aujourd'hui pour ne pas toucher aux jours passés
      const nonPastSlots = slots.filter((s) => {
        const d = parseISODate(s.slot_date)
        return !d || !isPastDay(d)
      })
      const emptySlots = nonPastSlots.filter((s) => s.meal === null)
      const targetSlots =
        emptySlots.length > 0
          ? emptySlots
          : nonPastSlots.length > 0
            ? nonPastSlots
            : slots

      const mapped = batch.meals.slice(0, targetSlots.length).map((m, idx) => {
        const target = targetSlots[idx]
        const d = parseISODate(target.slot_date)
        const isPast = d ? isPastDay(d) : false
        return {
          date: target.slot_date,
          kind: target.slot_kind,
          mealName: m.title,
          selected: !isPast,
          isPast,
          hasExistingMeal: Boolean(target.meal),
        }
      })

      if (mapped.length > 0) {
        setDetectedSlots(mapped)
        toast.success(
          `${mapped.length} plats identifiés et pré-assignés aux créneaux.`
        )
        return
      }
    }

    toast.error(
      "Aucun plat ou planning n'a pu être reconnu dans cette source. Vérifiez la netteté de la photo."
    )
  }

  function handleApplyScan() {
    const selected = selectedScanSlots
    if (selected.length === 0) {
      toast.error("Veuillez cocher au moins un créneau à appliquer.")
      return
    }

    startApplyTransition(async () => {
      try {
        const payload = selected.map((s) => {
          // Vérifier si le plat existe déjà dans le catalogue
          const existing = meals.find(
            (m) => m.name.toLowerCase() === s.mealName.trim().toLowerCase()
          )
          const isLeftover = /^reste\b/i.test(s.mealName.trim())
          const batchMatch = !isLeftover
            ? extractedBatchMeals.find(
                (m) => m.title.toLowerCase() === s.mealName.trim().toLowerCase()
              )
            : undefined
          const defaultIngredients = isLeftover
            ? []
            : batchMatch && batchMatch.ingredients.length > 0
              ? batchMatch.ingredients
              : getDefaultRecipeForDish(s.mealName.trim()).map((i) => i.name)

          return {
            date: s.date,
            kind: s.kind,
            meal: {
              id: existing?.id,
              name: s.mealName.trim(),
              ingredients: existing
                ? existing.ingredients.map((i) => i.name)
                : defaultIngredients,
              origin: existing ? ("catalog" as const) : ("ai" as const),
            },
          }
        })
        const result = await applyAutoPlanAction(payload)
        onApplied(result.slots)
        toast.success(
          `${result.count} créneau${result.count > 1 ? "x" : ""} rempli${result.count > 1 ? "s" : ""} dans votre planning !`
        )
        onOpenChange(false)
      } catch (err) {
        toast.error(actionErrorMessage(err))
      }
    })
  }

  const categoryEmoji: Record<string, string> = {
    poisson: "🐟 Poisson",
    viande: "🥩 Viande",
    vege: "🥬 Végé",
    feculent: "🍝 Féculent",
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-xl flex flex-col p-4 sm:p-6 transition-all">
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {activeTab === "generator" ? (
              <Sparkles className="size-5" />
            ) : (
              <Camera className="size-5" />
            )}
          </div>
          <div>
            <DialogTitle className="font-fraunces text-lg sm:text-xl text-ink">
              {activeTab === "generator"
                ? "Générer la semaine avec l'IA"
                : "Scanner un planning (Photo / Semainier)"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {activeTab === "generator"
                ? "Complète intelligemment les créneaux vides en respectant l'équilibre alimentaire."
                : "Photographiez votre planning ou collez vos repas, même sur plusieurs semaines."}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Onglets Générateur vs Scanner */}
      <div className="grid grid-cols-2 rounded-xl bg-muted/70 p-1 text-xs font-medium">
        <button
          type="button"
          className={cn(
            "tap-press flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 transition-all",
            activeTab === "generator"
              ? "bg-card text-ink shadow-xs font-bold"
              : "text-muted-foreground hover:text-ink"
          )}
          onClick={() => setActiveTab("generator")}
        >
          <Sparkles className="size-3.5 text-primary" />
          <span>Générateur IA</span>
        </button>
        <button
          type="button"
          className={cn(
            "tap-press flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 transition-all",
            activeTab === "scan"
              ? "bg-card text-ink shadow-xs font-bold"
              : "text-muted-foreground hover:text-ink"
          )}
          onClick={() => setActiveTab("scan")}
        >
          <Camera className="size-3.5 text-primary" />
          <span>Scanner un planning</span>
        </button>
      </div>

      {activeTab === "generator" ? (
        /* ================= VUE 1 : GÉNÉRATEUR AUTOMATIQUE ================= */
        emptySlotsCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Utensils className="size-8 text-muted-foreground/60" />
            <p className="font-fraunces text-base text-ink">
              Tous les créneaux de cette semaine sont déjà remplis !
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Videz quelques créneaux pour laisser l&apos;IA vous faire des propositions équilibrées.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0 gap-3">
            {/* Options et personnalisation */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-muted/30 p-2.5 text-xs">
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>🥫 En stock ou envie de manger (facultatif)</span>
                  {stockOrCravings.trim() ? (
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline font-normal"
                      onClick={() => setStockOrCravings("")}
                    >
                      Effacer
                    </button>
                  ) : null}
                </div>
                <Input
                  value={stockOrCravings}
                  onChange={(e) => setStockOrCravings(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      generate(onlyCatalog, stockOrCravings)
                    }
                  }}
                  placeholder="ex: finir les courgettes, envie de pâtes, poulet..."
                  className="h-8.5 rounded-lg text-xs bg-surface border-line"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id="catalog-only"
                    checked={onlyCatalog}
                    onCheckedChange={(checked) => setOnlyCatalog(checked)}
                  />
                  <Label htmlFor="catalog-only" className="cursor-pointer font-medium text-xs">
                    Mon carnet uniquement
                  </Label>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="tap-press h-8 gap-1.5 px-3 text-xs font-semibold text-primary border-primary/30 bg-primary/5 hover:bg-primary/15 shadow-2xs"
                  onClick={() => generate(onlyCatalog, stockOrCravings)}
                  disabled={isApplying}
                >
                  <RefreshCw className="size-3.5" />
                  <span>Tout régénérer</span>
                </Button>
              </div>

              {stockOrCravings.trim() ? (
                <p className="text-[10px] text-muted-foreground">
                  💡 Vos envies s&apos;appliquent aussi lorsque vous cliquez sur <strong>Changer</strong> pour un plat unique.
                </p>
              ) : null}
            </div>

            {/* Liste des propositions créneau par créneau (défilement tactile fluide) */}
            <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto overscroll-contain pr-1 touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex flex-col gap-2 py-1">
                {proposals.map((proposal, index) => {
                  const parsed = parseISODate(proposal.date)
                  const dateLabel = parsed ? slotTitleDate(parsed) : proposal.date

                  return (
                    <div
                      key={`${proposal.date}:${proposal.kind}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/80 p-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {dateLabel} · {SLOT_LABEL[proposal.kind]}
                        </span>
                        <span className="truncate font-fraunces text-sm font-semibold text-ink">
                          {proposal.meal.name}
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                            {categoryEmoji[proposal.meal.category] ?? "Équilibré"}
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-medium",
                              proposal.meal.origin === "catalog"
                                ? "bg-primary/10 text-primary"
                                : "bg-accent/15 text-accent-fg"
                            )}
                          >
                            {proposal.meal.origin === "catalog" ? "📖 Mon carnet" : "✨ Idée IA"}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="tap-press h-8 gap-1.5 shrink-0 px-2.5 text-xs border-line text-muted-foreground hover:text-ink hover:border-line-active"
                        title="Régénérer ce créneau"
                        onClick={() => handleRerollSlot(index)}
                        disabled={isApplying}
                      >
                        <RefreshCw className="size-3 text-primary" />
                        <span className="hidden sm:inline">Changer</span>
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-xs text-muted-foreground self-center">
                {proposals.length} créneau{proposals.length > 1 ? "s" : ""} à compléter
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isApplying}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyGenerator}
                  disabled={proposals.length === 0 || isApplying}
                  className="gap-2"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Application...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Appliquer au planning</span>
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )
      ) : (
        /* ================= VUE 2 : SCANNER UN PLANNING ================= */
        <div className="flex flex-1 flex-col min-h-0 gap-3">
          {detectedSlots.length === 0 ? (
            <>
              {/* Choix mode photo vs texte */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scanSource === "photo" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs flex-1"
                  onClick={() => setScanSource("photo")}
                >
                  <Camera className="size-3.5" />
                  <span>Photo / Image</span>
                </Button>
                <Button
                  type="button"
                  variant={scanSource === "text" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs flex-1"
                  onClick={() => setScanSource("text")}
                >
                  <TextQuote className="size-3.5" />
                  <span>Texte / Liste</span>
                </Button>
              </div>

              {scanSource === "photo" ? (
                <div className="flex flex-col gap-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void handlePhotoSelected(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handlePhotoSelected(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />

                  {photoPreviewUrl ? (
                    <div className="relative flex flex-col items-center gap-2 rounded-xl border border-line bg-muted/30 p-3">
                      <img
                        src={photoPreviewUrl}
                        alt="Aperçu du planning"
                        className="max-h-48 w-auto rounded-lg object-contain shadow-2xs"
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{photoFile?.name}</span>
                        <span>·</span>
                        <span>{photoFile ? `${Math.round(photoFile.size / 1024)} Ko` : ""}</span>
                      </div>
                      <div className="mt-1 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isAnalyzing}
                        >
                          Changer d&apos;image
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setPhotoFile(null)
                            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
                            setPhotoPreviewUrl(null)
                          }}
                          disabled={isAnalyzing}
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-muted/20 p-6 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Camera className="size-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          Prenez en photo votre semainier
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tableau de repas frigo, planning familial manuscrit ou menu imprimé.
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
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={`Collez votre planning, même sur plusieurs semaines...\n\nExemple :\nSamedi midi : Poulet rôti et pommes de terre\nDimanche soir : Salade composée\nLundi midi : Quiche lorraine`}
                    rows={7}
                    className="resize-none font-sans text-xs"
                    disabled={isAnalyzing}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Les jours sont lus dans l&apos;ordre du planning, y compris sur les semaines suivantes.
                  </p>
                </div>
              )}

              <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isAnalyzing}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={
                    (scanSource === "photo" && !photoFile) ||
                    (scanSource === "text" && !textInput.trim()) ||
                    isAnalyzing
                  }
                  className="gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{scanStatus || "Analyse en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Analyser le planning</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Aperçu des créneaux détectés avec checkboxes */
            <div className="flex flex-1 flex-col min-h-0 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-line bg-muted/40 p-2.5">
                <span className="text-xs font-semibold text-ink">
                  {selectedScanSlots.length} créneau{selectedScanSlots.length > 1 ? "x" : ""} sélectionné
                  {selectedScanSlots.length > 1 ? "s" : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-ink"
                  onClick={() => setDetectedSlots([])}
                >
                  <RefreshCw className="mr-1 size-3" />
                  Scanner à nouveau
                </Button>
              </div>
              {firstScanDate && lastScanDate ? (
                <p className="text-[11px] text-muted-foreground">
                  Du {slotTitleDate(firstScanDate)} au {slotTitleDate(lastScanDate)}
                </p>
              ) : null}
              <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto overscroll-contain pr-1 touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="flex flex-col gap-2 py-1">
                  {detectedSlots.map((slot, idx) => {
                    const parsed = parseISODate(slot.date)
                    const dateLabel = parsed ? slotTitleDate(parsed) : slot.date

                    return (
                      <div
                        key={`${slot.date}:${slot.kind}:${idx}`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-2.5 transition-all",
                          slot.selected
                            ? "border-line bg-surface shadow-2xs"
                            : "border-line/40 bg-muted/20 opacity-60"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setDetectedSlots((prev) => {
                              const next = [...prev]
                              next[idx] = { ...slot, selected: !slot.selected }
                              return next
                            })
                          }}
                          className={cn(
                            "tap-press flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                            slot.selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-line bg-background text-transparent"
                          )}
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </button>

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {dateLabel} · {SLOT_LABEL[slot.kind]}
                            </span>
                            {slot.isPast ? (
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                Déjà passé (non modifié)
                              </span>
                            ) : slot.hasExistingMeal ? (
                              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                Remplacer le plat actuel
                              </span>
                            ) : null}
                          </div>
                          <Input
                            value={slot.mealName}
                            onChange={(e) => {
                              const val = e.target.value
                              setDetectedSlots((prev) => {
                                const next = [...prev]
                                next[idx] = { ...slot, mealName: val }
                                return next
                              })
                            }}
                            className="h-8 font-fraunces text-sm font-semibold"
                            placeholder="Nom du plat"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetectedSlots([])}
                  disabled={isApplying}
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyScan}
                  disabled={
                    selectedScanSlots.length === 0 || isApplying
                  }
                  className="gap-2"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Application...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      <span>Appliquer au planning</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  )
}
