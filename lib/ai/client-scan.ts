import type { ExtractedImageResult } from "@/lib/actions/ai"

function isSource(value: unknown): value is ExtractedImageResult["recipe"]["source"] {
  return value === undefined || value === "url" || value === "text" ||
    value === "json-ld" || value === "image"
}

function isRecipe(value: unknown): value is ExtractedImageResult["recipe"] {
  return typeof value === "object" && value !== null &&
    "title" in value && typeof value.title === "string" && value.title.trim().length > 0 &&
    "ingredients" in value && Array.isArray(value.ingredients) &&
    value.ingredients.every((ingredient) => typeof ingredient === "string") &&
    "detailedIngredients" in value && Array.isArray(value.detailedIngredients) &&
    value.detailedIngredients.every((ingredient: unknown) =>
      typeof ingredient === "object" && ingredient !== null &&
      "name" in ingredient && typeof ingredient.name === "string" &&
      "raw" in ingredient && typeof ingredient.raw === "string" &&
      (!("quantity" in ingredient) || ingredient.quantity === undefined ||
        typeof ingredient.quantity === "string")
    ) &&
    (!("source" in value) || isSource(value.source)) &&
    (!("isDefaultRecipe" in value) || value.isDefaultRecipe === undefined ||
      typeof value.isDefaultRecipe === "boolean")
}

function isImageResult(value: unknown): value is ExtractedImageResult {
  return typeof value === "object" && value !== null &&
    "transcribedText" in value && typeof value.transcribedText === "string" &&
    value.transcribedText.trim().length > 0 &&
    "result" in value && typeof value.result === "object" && value.result !== null &&
    "kind" in value.result && (value.result.kind === "single" || value.result.kind === "list") &&
    "meals" in value.result && Array.isArray(value.result.meals) &&
    value.result.meals.length > 0 && value.result.meals.every(isRecipe) &&
    (!("source" in value.result) || isSource(value.result.source)) &&
    "recipe" in value && isRecipe(value.recipe) &&
    (!("noVisionKey" in value) || value.noVisionKey === undefined || value.noVisionKey === false) &&
    (!("error" in value) || value.error === undefined || value.error === "")
}

export async function scanImageClient(
  formData: FormData,
  onProgress?: (percent: number, label: string) => void
): Promise<ExtractedImageResult & { usedClientOcr?: boolean }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 58000)
  const timeoutMessage =
    "L'analyse de la photo a dépassé le délai du serveur. Réessayez avec une photo plus nette ou utilisez l'onglet Texte / Dictée."

  try {
    onProgress?.(10, "Envoi au déchiffreur IA...")
    const response = await fetch("/api/ai/scan-image", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    })

    if (response.status === 504 || response.status === 408) {
      throw new Error(timeoutMessage)
    }

    const responseError = response.ok
      ? "Le serveur a renvoyé une analyse de photo invalide. Réessayez ou utilisez l'onglet Texte / Dictée."
      : `L'analyse de la photo a échoué (HTTP ${response.status}). Réessayez ou utilisez l'onglet Texte / Dictée.`

    const contentType = response.headers.get("content-type")?.toLowerCase() || ""
    if (!contentType.includes("application/json") && !contentType.includes("+json")) {
      throw new Error(responseError)
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new Error(responseError)
    }

    if (typeof data === "object" && data !== null &&
      (("code" in data && data.code === "NO_VISION_KEY") ||
        ("noVisionKey" in data && data.noVisionKey === true))) {
      throw new Error(
        "Aucune clé Vision IA n'est configurée. L'OCR local ne reconnaît pas assez fiablement les plannings manuscrits et n'est pas lancé automatiquement. Configurez une clé Vision IA ou utilisez l'onglet Texte / Dictée."
      )
    }

    if (typeof data === "object" && data !== null && "error" in data &&
      typeof data.error === "string" && data.error.trim()) {
      throw new Error(data.error.trim())
    }

    if (!response.ok || !isImageResult(data)) {
      throw new Error(responseError)
    }

    return data
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutMessage)
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Impossible de joindre le service d'analyse de photos. Vérifiez votre connexion et réessayez, ou utilisez l'onglet Texte / Dictée."
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
