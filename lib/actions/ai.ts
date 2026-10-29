"use server"

import {
  extractRecipeFromHtml,
  extractMealsFromText,
  type ExtractedRecipe,
  type ExtractedMealBatch,
} from "@/lib/ai/recipe-extractor"
import { transcribeCloudflareImage } from "@/lib/ai/cloudflare-vision"

export type ExtractedImageResult = {
  transcribedText: string
  result: ExtractedMealBatch
  recipe: ExtractedRecipe
  noVisionKey?: boolean
  error?: string
}

function readGeminiTranscription(data: unknown): string {
  if (typeof data !== "object" || data === null || !("candidates" in data) || !Array.isArray(data.candidates)) {
    throw new Error("Gemini n'a retourné aucune transcription.")
  }
  const candidate: unknown = data.candidates[0]
  if (typeof candidate !== "object" || candidate === null || !("finishReason" in candidate)) {
    throw new Error("La réponse de Gemini ne confirme pas la fin de la transcription.")
  }
  if (candidate.finishReason !== "STOP") {
    throw new Error("Transcription incomplète : Gemini a interrompu la lecture. Aucun repas n'a été importé.")
  }
  if (!("content" in candidate) || typeof candidate.content !== "object" || candidate.content === null ||
      !("parts" in candidate.content) || !Array.isArray(candidate.content.parts)) {
    throw new Error("Gemini n'a retourné aucune transcription.")
  }
  const text: string[] = []
  const parts: unknown[] = candidate.content.parts
  for (const part of parts) {
    if (typeof part !== "object" || part === null || ("thought" in part && part.thought === true)) continue
    if ("text" in part && typeof part.text === "string") text.push(part.text)
  }
  const transcription = text.join("").trim()
  if (!transcription) throw new Error("Gemini n'a retourné aucune transcription finale.")
  return transcription
}

const VISION_PROMPT = `Retranscris uniquement les repas réellement lisibles sur ce planning, en français, dans l'ordre de la photo.
Une ligne par créneau, sans introduction, réflexion, markdown ni liste d'ingrédients.
Format strict :
Samedi midi : Haricots verts / Poisson
Samedi soir : Panini
Dimanche midi : Steak / Pommes de terre

Lis toute la photo jusqu'en bas, pas seulement les premiers jours.
Sous chaque jour, la première ligne est le midi et la seconde le soir, sauf indication contraire.
Une ligne manuscrite précédée d'un nouveau tiret est un AUTRE créneau, même sans jour répété : ne fusionne jamais le midi et le soir.
Conserve les accompagnements sur la même ligne que le plat.
Transcris les restes comme "Reste" ou "Reste de [plat]".
Pour une case vide, illisible ou barrée, écris "non renseigné" : n'invente aucun repas.
Si un jour apparaît une seconde fois en fin de photo, conserve ces lignes à la fin sans les fusionner avec le premier.
Ignore les annotations hors repas. Ne génère ni recette ni quantité.`

export async function transcribeImageBuffer(
  buffer: Buffer,
  mimeType: string,
  customApiKey?: string
): Promise<string> {
  if (process.env.CLOUDFLARE_API_TOKEN !== undefined || process.env.CLOUDFLARE_ACCOUNT_ID !== undefined) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
    if (!apiToken || !accountId) {
      throw new Error("Configuration Cloudflare incomplète : renseignez CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID.")
    }
    return transcribeCloudflareImage({
      buffer,
      mimeType,
      prompt: VISION_PROMPT,
      accountId,
      apiToken,
      signal: AbortSignal.timeout(45000),
    })
  }

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
  const deadline = AbortSignal.timeout(45000)
  let lastProviderError = ""

  if (geminiKey) {
    const imageData = buffer.toString("base64")
    const models = [
      { name: "gemini-3.5-flash", thinkingLevel: "MINIMAL" },
      { name: "gemini-3.8-flash", thinkingLevel: "LOW" },
    ]
    for (const model of models) {
      if (deadline.aborted) break
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType, data: imageData } },
                  { text: VISION_PROMPT },
                ],
              }],
              generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.1,
                thinkingConfig: { thinkingLevel: model.thinkingLevel, includeThoughts: false },
              },
            }),
            signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]),
          }
        )
        if (response.ok) {
          const data: unknown = await response.json()
          return readGeminiTranscription(data)
        }
        if (response.status === 429) {
          lastProviderError = "Quota IA du jour atteint. Réessayez demain ou utilisez l'onglet Texte."
        } else if (response.status === 404) {
          lastProviderError = "Ce modèle IA n'est pas accessible avec votre clé. Utilisez l'onglet Texte ou vérifiez votre projet Google AI Studio."
        } else if (response.status === 503) {
          lastProviderError = "Le service IA est temporairement saturé. Réessayez plus tard ou utilisez l'onglet Texte."
        } else {
          lastProviderError = response.status === 401 || response.status === 403
            ? "Google refuse la clé Gemini. Vérifiez la clé et les autorisations du projet Google AI Studio."
            : `Le service d'analyse IA a échoué (HTTP ${response.status}). Utilisez l'onglet Texte ou réessayez plus tard.`
          break
        }
      } catch (err) {
        lastProviderError = err instanceof Error && err.name !== "TimeoutError" && err.name !== "AbortError"
          ? err.message
          : "Le service IA n'a pas répondu à temps. Réessayez plus tard ou utilisez l'onglet Texte."
      }
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
              signal: AbortSignal.any([deadline, AbortSignal.timeout(35000)]),
            }
          )

          if (response.ok) {
            const data = await response.json()
            const choice = data?.choices?.[0]
            if (choice?.finish_reason && choice.finish_reason !== "stop") {
              throw new Error("Transcription incomplète : le fournisseur a interrompu la lecture.")
            }
            const rawContent = choice?.message?.content
            const text = typeof rawContent === "string" ? rawContent.trim() : undefined
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
            signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
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
