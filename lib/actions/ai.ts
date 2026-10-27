"use server"

import Tesseract from "tesseract.js"
import {
  extractRecipeFromHtml,
  extractMealsFromText,
  type ExtractedRecipe,
  type ExtractedMealBatch,
} from "@/lib/ai/recipe-extractor"

export type ExtractedImageResult = {
  transcribedText: string
  result: ExtractedMealBatch
  recipe: ExtractedRecipe
}

const VISION_PROMPT = `Tu es un assistant culinaire expert. Analyse attentivement cette photo et identifie sa nature :

Cas A : La photo montre une RECETTE UNIQUE détaillée avec des ingrédients (ex: livre de cuisine, fiche recette).
-> Retranscris fidèlement le titre exact et la TOTALITÉ des ingrédients avec leurs quantités sans rien résumer, modifier ni tronquer.
Format :
[Titre de la recette]
Ingrédients :
- [quantité] [nom]

Cas B : La photo montre un PLANNING DE REPAS ou une LISTE DE PLATS (ex: semainier, tableau de repas, menu manuscrit ou imprimé).
-> 1. Liste d'abord tous les repas par créneaux au format strict suivant (une ligne par créneau, sans gras ** ni puces) :
Lundi midi : [Nom du plat]
Lundi soir : [Nom du plat]
Mardi midi : [Nom du plat]
Mardi soir : [Nom du plat]
Mercredi midi : [Nom du plat]
Mercredi soir : [Nom du plat]
Jeudi midi : [Nom du plat]
Jeudi soir : [Nom du plat]
Vendredi midi : [Nom du plat]
Vendredi soir : [Nom du plat]
Samedi midi : [Nom du plat]
Samedi soir : [Nom du plat]
Dimanche midi : [Nom du plat]
Dimanche soir : [Nom du plat]

(Si les créneaux midi/soir ne sont pas explicitement notés, classe les repas dans l'ordre chronologique midi puis soir. Si un repas est un reste, écris simplement "Reste" ou "Reste de [nom]". Ignore les listes de courses annexes ou tâches ménagères).

-> 2. Ensuite, pour chaque plat distinct du planning (sauf les restes simples ou sorties restaurant), fournis sa recette :
=== PLAT : [Nom du plat 1] ===
Ingrédients :
- [quantité] [nom]
=== PLAT : [Nom du plat 2] ===
Ingrédients :
- [quantité] [nom]
(Génère 3 à 5 ingrédients essentiels et équilibrés avec quantités pour chaque plat).

Cas C : PLAT UNIQUE sans ingrédients.
-> Extrais le titre et génère 3 à 5 ingrédients essentiels avec quantités.
Format :
[Titre]
Ingrédients :
- [quantité] [nom]

Réponds directement avec le texte au format indiqué sans bla-bla.`

async function transcribeImage(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // 1. Mode Gemini Vision si configuré
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const models = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-flash-latest",
      ]
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
                        text: VISION_PROMPT,
                      },
                    ],
                  },
                ],
              }),
              signal: AbortSignal.timeout(60000),
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
      // En cas d'erreur de clé ou réseau Gemini, repli vers les autres fournisseurs
    }
  }

  // 2. Mode OpenAI Vision si configuré
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const models = ["gpt-4o-mini", "gpt-4o"]
      for (const model of models) {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: VISION_PROMPT,
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
              max_tokens: 3500,
            }),
            signal: AbortSignal.timeout(60000),
          })

          if (response.ok) {
            const data = await response.json()
            const text = data?.choices?.[0]?.message?.content
            if (typeof text === "string" && text.trim().length > 0) {
              return text.trim()
            }
          }
        } catch {
          // Essayer le modèle suivant
        }
      }
    } catch {
      // Repli vers les autres fournisseurs
    }
  }

  // 3. Mode Zhipu / GLM Vision si configuré
  const glmKey =
    process.env.GLM_API_KEY ||
    process.env.ZHIPU_API_KEY ||
    process.env.ZAI_API_KEY
  if (glmKey) {
    try {
      const models = ["glm-4.5v", "glm-4v-plus", "glm-4v"]
      for (const model of models) {
        try {
          const response = await fetch(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${glmKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: VISION_PROMPT,
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
                max_tokens: 4096,
              }),
              signal: AbortSignal.timeout(75000),
            }
          )

          if (response.ok) {
            const data = await response.json()
            const rawContent = data?.choices?.[0]?.message?.content
            const reasoningContent = data?.choices?.[0]?.message?.reasoning_content
            const text =
              typeof rawContent === "string" && rawContent.trim().length > 0
                ? rawContent.trim()
                : typeof reasoningContent === "string" && reasoningContent.trim().length > 0
                  ? reasoningContent.trim()
                  : undefined
            if (text) {
              return text
            }
          }
        } catch {
          // Essayer le modèle suivant
        }
      }
    } catch {
      // Repli vers Tesseract
    }
  }

  // 4. Mode OCR local (Tesseract.js)
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
      "Aucun texte n'a pu être déchiffré sur cette image. Vérifiez la netteté et l'éclairage de la photo, ou configurez une clé d'API Vision (GEMINI_API_KEY, OPENAI_API_KEY ou GLM_API_KEY) pour les semainiers manuscrits."
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
