import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { extractRecipeFromImageAction } from "@/lib/actions/ai"
import { parsePlanningToWeekSlots } from "@/lib/ai/recipe-extractor"

describe("Extraction d'images de planning repas (AI Vision)", () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    globalThis.fetch = originalFetch
  })

  it("rejette si aucun fichier image n'est fourni", async () => {
    const formData = new FormData()
    expect(extractRecipeFromImageAction(formData)).rejects.toThrow(
      "Veuillez sélectionner ou prendre une photo de recette."
    )
  })

  it("rejette si l'image dépasse la limite de taille", async () => {
    const formData = new FormData()
    const largeBlob = new Blob([new Uint8Array(13 * 1024 * 1024)], { type: "image/jpeg" })
    const largeFile = new File([largeBlob], "huge.jpg", { type: "image/jpeg" })
    formData.append("image", largeFile)

    expect(extractRecipeFromImageAction(formData)).rejects.toThrow(
      "L'image est trop volumineuse"
    )
  })

  it("signale immédiatement l'absence de clé Vision sans bloquer le serveur", async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GLM_API_KEY
    delete process.env.ZHIPU_API_KEY
    delete process.env.ZAI_API_KEY

    const fakeImage = new File([new Uint8Array([1, 2, 3])], "test.jpg", {
      type: "image/jpeg",
    })
    const formData = new FormData()
    formData.append("image", fakeImage)
    const res = await extractRecipeFromImageAction(formData)
    expect(res.noVisionKey).toBe(true)
  })

  it("accepte une clé personnalisée passée dans le formulaire", async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GLM_API_KEY

    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Lundi midi : Tarte aux poireaux\nLundi soir : Soupe de légumes" }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }

    const fakeImage = new File([new Uint8Array([1, 2, 3])], "test.jpg", {
      type: "image/jpeg",
    })
    const formData = new FormData()
    formData.append("image", fakeImage)
    formData.append("customApiKey", "AIzaSyTestCustomGeminiKey")

    const result = await extractRecipeFromImageAction(formData)
    expect(result.transcribedText).toContain("Lundi midi : Tarte aux poireaux")
    expect(result.result.meals[0].title).toBe("Tarte aux poireaux")
  })

  it("extrait un planning complet via GLM Vision (Zhipu)", async () => {
    process.env.GLM_API_KEY = "test-glm-key"
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY

    const fakePlanningResponse = `Lundi midi : Courgette viande hachée pâtes
Lundi soir : Poisson à la bordelaise fondue de poireaux
Mardi midi : Pâtes au jambon poireaux
Mardi soir : Steak haricots pâtes
Mercredi midi : Œufs coque champignons
Mercredi soir : Tarte thon tomate
Jeudi midi : Tarte thon tomate
Jeudi soir : Pizza - resto
Vendredi midi : Poulet tian provençal
Vendredi soir : Poulet tian provençal
Samedi midi : Pique-nique
Samedi soir : Omelette pommes de terre
Dimanche midi : Pique-nique
Dimanche soir : Saumon riz épinards

=== PLAT : Courgette viande hachée pâtes ===
Ingrédients :
- 2 courgettes
- 400g viande hachée
- 300g pâtes

=== PLAT : Tarte thon tomate ===
Ingrédients :
- 1 pâte brisée
- 2 boîtes de thon
- 3 tomates`

    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("bigmodel.cn")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: fakePlanningResponse,
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }

    const fakeImage = new File([new Uint8Array([1, 2, 3, 4])], "planning.jpg", {
      type: "image/jpeg",
    })
    const formData = new FormData()
    formData.append("image", fakeImage)

    const result = await extractRecipeFromImageAction(formData)
    expect(result.transcribedText).toContain("Lundi midi : Courgette")
    expect(result.result.kind).toBe("list")
    expect(result.result.meals.length >= 10).toBe(true)

    // Vérifie que les créneaux de semaine sont découpés avec succès
    const slots = parsePlanningToWeekSlots(result.transcribedText, "2026-10-26")
    expect(slots.length).toBe(14)
    expect(slots[0].mealName).toBe("Courgette viande hachée pâtes")
    expect(slots[0].kind).toBe("dejeuner")
    expect(slots[1].mealName).toBe("Poisson à la bordelaise fondue de poireaux")
    expect(slots[1].kind).toBe("diner")
  })

  it("extrait un planning complet via Gemini Vision", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key"
    delete process.env.OPENAI_API_KEY
    delete process.env.GLM_API_KEY

    const fakeGeminiResponse = `• **Lundi** midi : Salade verte | soir : Lasagnes
• **Mardi** midi : Steak frites | soir : Soupe de légumes`

    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: fakeGeminiResponse }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }

    const fakeImage = new File([new Uint8Array([1, 2, 3, 4])], "planning.jpg", {
      type: "image/jpeg",
    })
    const formData = new FormData()
    formData.append("image", fakeImage)

    const result = await extractRecipeFromImageAction(formData)
    expect(result.transcribedText).toContain("Lundi")
    const slots = parsePlanningToWeekSlots(result.transcribedText, "2026-10-26")
    expect(slots.length).toBe(4)
    expect(slots[0].mealName).toBe("Salade verte")
    expect(slots[0].kind).toBe("dejeuner")
    expect(slots[1].mealName).toBe("Lasagnes")
    expect(slots[1].kind).toBe("diner")
  })

  it("extrait un planning complet via OpenAI Vision", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key"
    delete process.env.GEMINI_API_KEY
    delete process.env.GLM_API_KEY

    const fakeOpenAiResponse = `Lundi midi : Poulet basquaise
Lundi soir : Omelette aux champignons`

    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("api.openai.com")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: fakeOpenAiResponse,
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Not found", { status: 404 })
    }

    const fakeImage = new File([new Uint8Array([1, 2, 3, 4])], "planning.jpg", {
      type: "image/jpeg",
    })
    const formData = new FormData()
    formData.append("image", fakeImage)

    const result = await extractRecipeFromImageAction(formData)
    expect(result.transcribedText).toContain("Poulet basquaise")
    const slots = parsePlanningToWeekSlots(result.transcribedText, "2026-10-26")
    expect(slots.length).toBe(2)
    expect(slots[0].mealName).toBe("Poulet basquaise")
    expect(slots[0].kind).toBe("dejeuner")
    expect(slots[1].mealName).toBe("Omelette aux champignons")
    expect(slots[1].kind).toBe("diner")
    expect(result.result.kind).toBe("list")
    expect(result.result.meals.length).toBe(2)
    expect(result.result.meals[0].isDefaultRecipe).toBe(true)
  })
})
