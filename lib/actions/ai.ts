"use server"

import Tesseract from "tesseract.js"
import {
  extractRecipeFromHtml,
  extractRecipeFromText,
  extractMealsFromText,
  type ExtractedRecipe,
  type ExtractedMealBatch,
} from "@/lib/ai/recipe-extractor"

export type ExtractedImageResult = {
  transcribedText: string
  result: ExtractedMealBatch
  recipe: ExtractedRecipe
}

async function transcribeImage(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // 1. Mode Gemini Vision si configuré
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"]
      let text: string | undefined
      for (const model of models) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        inlineData: {
                          mimeType,
                          data: buffer.toString("base64"),
                        },
                      },
                      {
                        text:
                          "Tu es un assistant culinaire expert. Analyse attentivement cette photo et identifie sa nature :\n\nCas A : La photo montre une RECETTE UNIQUE détaillée avec des ingrédients (ex: livre de cuisine, fiche recette).\n-> Retranscris fidèlement le titre exact et la TOTALITÉ des ingrédients avec leurs quantités sans rien résumer, modifier ni tronquer.\nFormat :\n[Titre de la recette]\nIngrédients :\n- [quantité] [nom]\n\nCas B : La photo montre un PLANNING DE REPAS ou une LISTE DE PLATS (ex: semainier, tableau de repas, menu).\n-> Extrais tous les plats distincts sous ce format :\nLundi midi : [Nom du plat]\nLundi soir : [Nom du plat]\nou\n=== PLAT : [Nom du plat 1] ===\nIngrédients :\n- [quantité] [nom]\n=== PLAT : [Nom du plat 2] ===\nIngrédients :\n- [quantité] [nom]\nPour chaque plat sans ingrédients, génère une recette par défaut équilibrée (3 à 5 ingrédients avec quantités).\n\nCas C : PLAT UNIQUE sans ingrédients.\n-> Extrais le titre et génère 3 à 5 ingrédients essentiels avec quantités.",
                      },
                    ],
                  },
                ],
              }),
              signal: AbortSignal.timeout(20000),
            }
          )
          if (response.ok) {
            const data = await response.json()
            const candText = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (typeof candText === "string" && candText.trim().length > 0) {
              text = candText.trim()
              break
            }
          }
        } catch {
          // Essayer le modèle suivant
        }
      }
      if (text) return text
    } catch {
      // En cas d'erreur de clé ou réseau Gemini, repli vers OpenAI ou Tesseract
    }
  }

  // 2. Mode OpenAI Vision si configuré
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Tu es un assistant culinaire expert. Analyse attentivement cette photo et identifie sa nature :\n\nCas A : RECETTE UNIQUE détaillée avec des ingrédients.\n-> Retranscris fidèlement le titre exact et la TOTALITÉ des ingrédients avec leurs quantités sans rien résumer ni modifier.\nFormat :\n[Titre de la recette]\nIngrédients :\n- [quantité] [nom]\n\nCas B : PLANNING DE REPAS ou LISTE DE PLATS.\n-> Extrais tous les plats distincts sous ce format :\n=== PLAT : [Nom du plat 1] ===\nIngrédients :\n- [quantité] [nom]\n=== PLAT : [Nom du plat 2] ===\nIngrédients :\n- [quantité] [nom]\nPour chaque plat sans ingrédients, génère une recette par défaut équilibrée (3 à 5 ingrédients avec quantités).\n\nCas C : PLAT UNIQUE sans ingrédients.\n-> Extrais le titre et génère 3 à 5 ingrédients avec quantités.\nFormat :\n[Titre]\nIngrédients :\n- [quantité] [nom]\n\nÉcris uniquement le texte au format indiqué sans bla-bla.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${buffer.toString("base64")}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content
        if (typeof text === "string" && text.trim().length > 0) {
          return text.trim()
        }
      }
    } catch {
      // Repli vers Tesseract
    }
  }

  // 3. Mode OCR local (Tesseract.js)
  try {
    const result = await Tesseract.recognize(buffer, "fra")
    const text = result?.data?.text?.trim()
    if (text && text.length > 0) return text
  } catch {
    // Repli vers anglais si le dictionnaire français a échoué
    try {
      const result = await Tesseract.recognize(buffer, "eng")
      return result?.data?.text?.trim() ?? ""
    } catch (ocrErr) {
      throw new Error(
        ocrErr instanceof Error
          ? `Échec de l'OCR local : ${ocrErr.message}`
          : "Impossible d'analyser l'image en local."
      )
    }
  }
  return ""
}

export async function extractRecipeFromImageAction(
  formData: FormData
): Promise<ExtractedImageResult> {
  const file = formData.get("image")
  if (!file || !(file instanceof File)) {
    throw new Error("Veuillez sélectionner ou prendre une photo de recette.")
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("L'image est trop volumineuse (maximum 12 Mo).")
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = file.type || "image/jpeg"

  let transcribedText: string
  try {
    transcribedText = await transcribeImage(buffer, mimeType)
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Erreur lors de la lecture de l'image : ${err.message}`
        : "Impossible de lire le texte sur cette photo."
    )
  }

  if (!transcribedText || transcribedText.length < 5) {
    throw new Error(
      "Aucun texte n'a pu être déchiffré sur cette image. Vérifiez la netteté et l'éclairage de la photo."
    )
  }

  const result = extractMealsFromText(transcribedText, "image")
  const recipe = result.meals[0] || {
    title: "Nouvelle recette",
    ingredients: [],
    detailedIngredients: [],
    source: "image" as const,
  }

  return {
    transcribedText,
    result,
    recipe,
  }
}

export async function extractRecipeAction(input: {
  mode: "text" | "url"
  content: string
}): Promise<ExtractedMealBatch> {
  const content = input.content.trim()
  if (!content) {
    throw new Error("Veuillez saisir un texte ou une URL de recette.")
  }

  if (input.mode === "url") {
    let targetUrl: URL
    try {
      targetUrl = new URL(content.startsWith("http") ? content : `https://${content}`)
    } catch {
      throw new Error("L'URL fournie est invalide.")
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      throw new Error("Seules les adresses web HTTP et HTTPS sont acceptées.")
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) {
        throw new Error(`Impossible de charger la page (code ${response.status}).`)
      }

      const html = await response.text()
      const extracted = extractRecipeFromHtml(html)

      if (extracted.ingredients.length === 0) {
        throw new Error(
          "Aucun ingrédient n'a pu être extrait automatiquement de cette page. Vous pouvez copier-coller le texte directement."
        )
      }

      return {
        kind: "single",
        meals: [extracted],
        source: "url",
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error("Le site met trop de temps à répondre (délai dépassé).")
      }
      throw new Error(
        err instanceof Error
          ? err.message
          : "Erreur lors de la récupération de la recette."
      )
    }
  }

  // Mode texte libre
  const batch = extractMealsFromText(content, "text")
  if (
    batch.meals.length === 0 ||
    (batch.meals.length === 1 &&
      batch.meals[0].ingredients.length === 0 &&
      !batch.meals[0].title)
  ) {
    throw new Error(
      "Aucun plat ou ingrédient détecté. Assurez-vous d'inclure des noms de plats ou une liste d'ingrédients."
    )
  }

  return batch
}
