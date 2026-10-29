"use server"

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
  noVisionKey?: boolean
  error?: string
}

const VISION_PROMPT = `Tu es un assistant culinaire expert. Analyse attentivement cette photo de planning de repas ou semainier (menu de la semaine, tableau de repas, semainier imprimé ou cahier manuscrit).

Retranscris tous les repas du planning par créneaux au format strict suivant (une ligne par créneau, sans astérisques ** ni puces) :
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

Réponds directement avec les lignes du planning sans aucun commentaire avant ni après.`

export async function transcribeImageBuffer(
  buffer: Buffer,
  mimeType: string,
  customApiKey?: string
): Promise<string> {
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (customApiKey?.startsWith("AIza") ? customApiKey : undefined)

  const openaiKey =
    process.env.OPENAI_API_KEY ||
    (customApiKey?.startsWith("sk-") ? customApiKey : undefined)

  const glmKey =
    process.env.GLM_API_KEY ||
    process.env.ZHIPU_API_KEY ||
    process.env.ZAI_API_KEY ||
    (customApiKey && !customApiKey.startsWith("AIza") && !customApiKey.startsWith("sk-")
      ? customApiKey
      : undefined)

  if (!geminiKey && !openaiKey && !glmKey) {
    throw new Error("NO_VISION_KEY")
  }
  let lastProviderError = ""

  // 1. Mode Gemini Vision si configuré
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`
      const geminiPayload = JSON.stringify({
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
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.1,
        },
      })

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiPayload,
        signal: AbortSignal.timeout(35000),
      })

      if (response.ok) {
        const data = await response.json()
        const candText = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (typeof candText === "string" && candText.trim().length > 0) {
          return candText.trim()
        }
      } else {
        const errText = await response.text()
        lastProviderError = `[Gemini ${response.status}] ${errText}`
      }
    } catch (err) {
      lastProviderError = err instanceof Error ? err.message : String(err)
    }
  }

  // 2. Mode Zhipu / GLM Vision si configuré
  if (glmKey) {
    try {
      const models = ["glm-4.5v", "glm-5.3-flash"]
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
                max_tokens: 3500,
              }),
              signal: AbortSignal.timeout(35000),
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
      // Repli vers les autres fournisseurs
    }
  }

  // 3. Mode OpenAI Vision si configuré
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
              max_tokens: 2500,
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
          // Essayer le modèle suivant
        }
      }
    } catch {
      // Repli
    }
  }

  throw new Error(
    lastProviderError
      ? `Échec de l'analyse : ${lastProviderError}`
      : "Impossible de déchiffrer l'image avec les clés configurées. Vérifiez la validité de votre clé ou la netteté de la photo."
  )
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
  let mimeType = file.type
  if (!mimeType || mimeType === "application/octet-stream") {
    const ext = file.name?.toLowerCase().split(".").pop()
    if (ext === "png") mimeType = "image/png"
    else if (ext === "webp") mimeType = "image/webp"
    else mimeType = "image/jpeg"
  }

  const customApiKey = formData.get("customApiKey")?.toString()?.trim() || undefined
  let transcribedText: string
  try {
    transcribedText = await transcribeImageBuffer(buffer, mimeType, customApiKey)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NO_VISION_KEY")) {
      return {
        transcribedText: "",
        result: { kind: "single", meals: [], source: "image" },
        recipe: { title: "", ingredients: [], detailedIngredients: [], source: "image" },
        noVisionKey: true,
      }
    }
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
  const result = extractMealsFromText(transcribedText, "image", "list")
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
  importMode?: "planning" | "recipe"
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
  const batch = extractMealsFromText(content, "text", "list")
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
