import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"

const clientScanUrl = new URL("../lib/ai/client-scan.ts", import.meta.url).href

function runScan(input: {
  status: number
  body: string
  contentType?: string
  networkFailure?: boolean
}): unknown {
  // Each process owns its fetch replacement, isolated from the vision tests.
  const script = `
    import { scanImageClient } from ${JSON.stringify(clientScanUrl)}
    const input = ${JSON.stringify(input)}
    let requests = 0
    globalThis.fetch = async () => {
      requests++
      if (input.networkFailure) throw new TypeError("Failed to fetch")
      return new Response(input.body, {
        status: input.status,
        headers: { "content-type": input.contentType ?? "application/json" },
      })
    }
    const formData = new FormData()
    formData.append("image", new File(["photo"], "planning.jpg", { type: "image/jpeg" }))
    try {
      const data = await scanImageClient(formData)
      console.log(JSON.stringify({ requests, data }))
    } catch (error) {
      console.log(JSON.stringify({ requests, error: error.message }))
    }
  `
  const child = spawnSync(process.execPath, ["--eval", script], {
    encoding: "utf8",
    timeout: 10000,
  })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(child.stderr || "Client scan subprocess failed")
  return JSON.parse(child.stdout)
}

const recipe = {
  title: "Soupe de légumes",
  ingredients: ["Carotte"],
  detailedIngredients: [{ name: "Carotte", raw: "2 carottes", quantity: "2" }],
  source: "image",
}
const imageResult = {
  transcribedText: "Lundi soir : Soupe de légumes",
  result: { kind: "list", meals: [recipe], source: "image" },
  recipe,
}

describe("Import photo côté client", () => {
  it("restitue les données valides sans les remplacer par une recette inventée", () => {
    expect(runScan({ status: 200, body: JSON.stringify(imageResult) })).toEqual({
      requests: 1,
      data: imageResult,
    })
  })

  it("arrête un HTTP 504 non JSON sans seconde requête ni OCR", () => {
    expect(runScan({ status: 504, body: "Gateway Timeout", contentType: "text/plain" })).toEqual({
      requests: 1,
      error: "L'analyse de la photo a dépassé le délai du serveur. Réessayez avec une photo plus nette ou utilisez l'onglet Texte / Dictée.",
    })
  })

  it("préserve l'erreur utilisateur HTTP 500 sans relancer l'analyse", () => {
    const error = "Impossible de déchiffrer cette photo. Utilisez une photo plus nette."
    expect(runScan({ status: 500, body: JSON.stringify({ error }) })).toEqual({ requests: 1, error })
  })

  it("rejette une réponse JSON de succès incomplète", () => {
    expect(runScan({ status: 200, body: JSON.stringify({ transcribedText: "Soupe de légumes" }) })).toEqual({
      requests: 1,
      error: "Le serveur a renvoyé une analyse de photo invalide. Réessayez ou utilisez l'onglet Texte / Dictée.",
    })
  })

  it("rejette le JSON invalide au lieu de relancer une server action", () => {
    expect(runScan({ status: 500, body: "{invalid" })).toEqual({
      requests: 1,
      error: "L'analyse de la photo a échoué (HTTP 500). Réessayez ou utilisez l'onglet Texte / Dictée.",
    })
  })

  it("explique les limites de l'OCR sans fabriquer de succès si aucune clé Vision n'existe", () => {
    expect(runScan({ status: 400, body: JSON.stringify({ code: "NO_VISION_KEY" }) })).toEqual({
      requests: 1,
      error: "Aucune clé Vision IA n'est configurée. L'OCR local ne reconnaît pas assez fiablement les plannings manuscrits et n'est pas lancé automatiquement. Configurez une clé Vision IA ou utilisez l'onglet Texte / Dictée.",
    })
  })

  it("rend une erreur de connexion exploitable sans seconde requête", () => {
    expect(runScan({ status: 200, body: "", networkFailure: true })).toEqual({
      requests: 1,
      error: "Impossible de joindre le service d'analyse de photos. Vérifiez votre connexion et réessayez, ou utilisez l'onglet Texte / Dictée.",
    })
  })
})
