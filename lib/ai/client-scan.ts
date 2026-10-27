import type { ExtractedImageResult } from "@/lib/actions/ai"
import { extractRecipeFromImageAction } from "@/lib/actions/ai"
import { extractMealsFromText } from "@/lib/ai/recipe-extractor"
import { createWorker } from "tesseract.js"
export const USER_AI_KEY_STORAGE = "planifia_user_ai_key"

export function getStoredUserAiKey(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(USER_AI_KEY_STORAGE) ?? ""
}

export function setStoredUserAiKey(key: string): void {
  if (typeof window === "undefined") return
  const clean = key.trim()
  if (clean) {
    localStorage.setItem(USER_AI_KEY_STORAGE, clean)
  } else {
    localStorage.removeItem(USER_AI_KEY_STORAGE)
  }
}

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
  // Injecter la clé personnalisée si stockée dans le navigateur et non encore fournie
  if (!formData.has("customApiKey")) {
    const saved = getStoredUserAiKey()
    if (saved) {
      formData.append("customApiKey", saved)
    }
  }

  const file = formData.get("image") as File | null

  // 1. Tenter via l'API Route avec les modèles Vision IA (maxDuration = 60s sur Vercel)
  try {
    onProgress?.(10, "Envoi au déchiffreur IA...")
    const res = await fetch("/api/ai/scan-image", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(40000),
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
            "Le déchiffrement local gratuit n'a trouvé aucun texte lisible. Pour des notes manuscrites complexes, vous pouvez utiliser une clé gratuite Google Gemini (sur aistudio.google.com sans carte bancaire) ou saisir le texte directement."
          )
        }
        const result = extractMealsFromText(ocrText, "image")
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
      // Si l'IA en ligne a mis trop de temps, repli local gratuit
      if (file) {
        onProgress?.(30, "Repli sur l'OCR local gratuit...")
        const ocrText = await performClientOcr(file, onProgress)
        if (ocrText && ocrText.trim().length >= 5) {
          const result = extractMealsFromText(ocrText, "image")
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
      throw new Error(
        "L'analyse en ligne a pris trop de temps. Vérifiez votre connexion ou saisissez le texte directement."
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
        const result = extractMealsFromText(ocrText, "image")
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
