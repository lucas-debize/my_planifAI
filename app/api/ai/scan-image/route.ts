import { NextResponse } from "next/server"
import { transcribeImageBuffer } from "@/lib/actions/ai"
import { extractMealsFromText } from "@/lib/ai/recipe-extractor"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("image")
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Veuillez sélectionner ou prendre une photo de recette." },
        { status: 400 }
      )
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "L'image est trop volumineuse (maximum 12 Mo)." },
        { status: 400 }
      )
    }

    const customApiKey = formData.get("customApiKey")?.toString()?.trim() || undefined
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || "image/jpeg"

    const transcribedText = await transcribeImageBuffer(buffer, mimeType, customApiKey)

    if (!transcribedText || transcribedText.length < 5) {
      return NextResponse.json(
        {
          error:
            "Aucun texte n'a pu être déchiffré sur cette image. Vérifiez la netteté et l'éclairage de la photo, ou configurez une clé d'API Vision (GEMINI_API_KEY, OPENAI_API_KEY ou GLM_API_KEY).",
        },
        { status: 422 }
      )
    }
    const result = extractMealsFromText(transcribedText, "image", "list")
    const recipe = result.meals[0] || {
      title: "Nouvelle recette",
      ingredients: [],
      detailedIngredients: [],
      source: "image" as const,
    }

    return NextResponse.json({
      transcribedText,
      result,
      recipe,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'analyse de l'image."
    const isNoKey = message.includes("Aucune clé Vision IA") || message.includes("NO_VISION_KEY")
    return NextResponse.json(
      { error: message, code: isNoKey ? "NO_VISION_KEY" : "SCAN_ERROR" },
      { status: isNoKey ? 400 : 500 }
    )
  }
}
