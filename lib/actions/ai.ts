"use server"

import Tesseract from "tesseract.js"
import {
  extractRecipeFromHtml,
  extractRecipeFromText,
  type ExtractedRecipe,
} from "@/lib/ai/recipe-extractor"

export type ExtractedImageResult = {
  transcribedText: string
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
                      "Tu es un assistant culinaire. Retranscris fidèlement le titre de la recette et la liste exacte des ingrédients avec leurs quantités (ex: 200g de farine, 3 oeufs, 1 c. à soupe d'huile) à partir de cette photo. Écris uniquement en texte brut au format :\n[Titre de la recette]\nIngrédients :\n- [quantité] [nom]\n...",
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (typeof text === "string" && text.trim().length > 0) {
          return text.trim()
        }
      }
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
                    "Tu es un assistant culinaire. Retranscris fidèlement le titre de la recette et la liste des ingrédients avec quantités à partir de cette photo. Format :\n[Titre de la recette]\nIngrédients :\n- [quantité] [nom]\n...",
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

  // 3. Mode OCR local (Tesseract.js) sans configuration
  const result = await Tesseract.recognize(buffer, "fra")
  return result.data.text.trim()
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

  const recipe = extractRecipeFromText(transcribedText)
  recipe.source = "image"

  return {
    transcribedText,
    recipe,
  }
}

export async function extractRecipeAction(input: {
  mode: "text" | "url"
  content: string
}): Promise<ExtractedRecipe> {
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

      return extracted
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
  const extracted = extractRecipeFromText(content)
  if (extracted.ingredients.length === 0) {
    throw new Error(
      "Aucun ingrédient détecté. Assurez-vous d'inclure une liste d'ingrédients (un par ligne ou séparés par des virgules)."
    )
  }

  return extracted
}
