import type { ExtractedImageResult } from "@/lib/actions/ai"
import { extractRecipeFromImageAction } from "@/lib/actions/ai"
import { extractMealsFromText } from "@/lib/ai/recipe-extractor"
import { createWorker } from "tesseract.js"

export async function performClientOcr(
  file: File,
  onProgress?: (percent: number, label: string) => void
): Promise<string> {
  const worker = await createWorker("fra", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100), "Déchiffrement gratuit...")
      } else if (typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100), "Préparation de l'OCR...")
      }
    },
  })

  try {
    const res = await worker.recognize(file)
    return res.data.text ?? ""
  } finally {
    await worker.terminate()
  }
}

export async function scanImageClient(
  formData: FormData,
  onProgress?: (percent: number, label: string) => void
): Promise<ExtractedImageResult & { usedClientOcr?: boolean }> {

  const file = formData.get("image") as File | null

  // 1. Tenter via l'API Route avec les modèles Vision IA (maxDuration = 60s sur Vercel)
  try {
    onProgress?.(10, "Envoi au déchiffreur IA...")
    const res = await fetch("/api/ai/scan-image", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(52000),
    })

    const data = await res.json()
    if (res.ok) {
      return data as ExtractedImageResult
    }

    // Si aucune clé IA configurée, basculer immédiatement et gratuitement sur l'OCR local
    if (data.code === "NO_VISION_KEY" || data.error?.includes("Aucune clé Vision IA")) {
      if (file) {
        onProgress?.(20, "Déchiffrement 100% gratuit en local...")
        const ocrText = await performClientOcr(file, onProgress)
        if (!ocrText || ocrText.trim().length < 5) {
          throw new Error(
            "L'écriture manuscrite sur cette photo n'a pas pu être déchiffrée par l'OCR local. Vous pouvez utiliser l'onglet Texte pour dicter vos repas au micro en 10 secondes ou saisir le texte directement."
          )
        }
        const result = extractMealsFromText(ocrText, "image", "list")
        const recipe = result.meals[0] || {
          title: "Nouvelle recette",
          ingredients: [],
          detailedIngredients: [],
          source: "image" as const,
        }
        return {
          transcribedText: ocrText,
          result,
          recipe,
          usedClientOcr: true,
        }
      }
    }

    throw new Error(data.error || `Erreur d'analyse (${res.status})`)
  } catch (apiErr) {
    if (apiErr instanceof Error && apiErr.name === "TimeoutError") {
      throw new Error(
        "L'analyse par l'IA a pris trop de temps (délai dépassé). Réessayez avec une photo plus nette ou utilisez l'onglet Texte / Dictée."
      )
    }

    // Si l'erreur signale l'absence de clé, basculer sur l'OCR local gratuit
    if (
      file &&
      apiErr instanceof Error &&
      (apiErr.message.includes("Aucune clé Vision IA") || apiErr.message.includes("NO_VISION_KEY"))
    ) {
      onProgress?.(20, "Déchiffrement 100% gratuit en local...")
      const ocrText = await performClientOcr(file, onProgress)
      if (ocrText && ocrText.trim().length >= 5) {
        const result = extractMealsFromText(ocrText, "image", "list")
        const recipe = result.meals[0] || {
          title: "Nouvelle recette",
          ingredients: [],
          detailedIngredients: [],
          source: "image" as const,
        }
        return {
          transcribedText: ocrText,
          result,
          recipe,
          usedClientOcr: true,
        }
      }
    }

    // 2. Dernier repli : Server Action
    return extractRecipeFromImageAction(formData)
  }
}
