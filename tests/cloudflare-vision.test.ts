import { describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"

const cloudflareVisionUrl = new URL(
  "../lib/ai/cloudflare-vision.ts",
  import.meta.url
).href

const VALID_ACCOUNT_ID = "0123456789abcdef0123456789abcdef"
const SECRET_TOKEN = "cf_secret_token_do_not_leak_999"
const SECRET_IMAGE_TEXT = "raw_image_bytes_secret_777"

type SubprocessScenario = {
  accountId?: string
  apiToken?: string
  mimeType?: string
  prompt?: string
  status?: number
  body?: string
  abortMode?: "none" | "before_fetch" | "during_fetch"
  networkFailure?: boolean
}

type SubprocessOutcome = {
  requests: number
  transcription?: string
  error?: string
}

function parseSubprocessOutcome(raw: string): SubprocessOutcome {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("requests" in parsed) ||
    typeof parsed.requests !== "number"
  ) {
    throw new Error("Invalid subprocess output")
  }
  return {
    requests: parsed.requests,
    transcription:
      "transcription" in parsed && typeof parsed.transcription === "string"
        ? parsed.transcription
        : undefined,
    error:
      "error" in parsed && typeof parsed.error === "string" ? parsed.error : undefined,
  }
}

function runCloudflareVision(scenario: SubprocessScenario): SubprocessOutcome {
  const script = `
    import { transcribeCloudflareImage } from ${JSON.stringify(cloudflareVisionUrl)}
    const scenario = ${JSON.stringify(scenario)}
    const accountId = scenario.accountId ?? ${JSON.stringify(VALID_ACCOUNT_ID)}
    const apiToken = scenario.apiToken ?? ${JSON.stringify(SECRET_TOKEN)}
    const mimeType = scenario.mimeType ?? "image/jpeg"
    const prompt = scenario.prompt ?? "Transcris le planning."
    const buffer = Buffer.from(${JSON.stringify(SECRET_IMAGE_TEXT)}, "utf8")
    const controller = new AbortController()

    if (scenario.abortMode === "before_fetch") {
      controller.abort()
    }

    let requests = 0

    globalThis.fetch = async () => {
      requests++

      if (scenario.networkFailure) {
        throw new TypeError("Failed to fetch https://api.cloudflare.com with " + apiToken)
      }

      if (scenario.abortMode === "during_fetch") {
        controller.abort()
        throw new DOMException("The operation was aborted.", "AbortError")
      }

      return new Response(scenario.body ?? "", {
        status: scenario.status ?? 200,
        headers: { "content-type": "application/json" },
      })
    }

    try {
      const transcription = await transcribeCloudflareImage({
        buffer,
        mimeType,
        prompt,
        accountId,
        apiToken,
        signal: controller.signal,
      })
      console.log(JSON.stringify({
        requests,
        transcription,
      }))
    } catch (error) {
      console.log(JSON.stringify({
        requests,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  `

  const child = spawnSync(process.execPath, ["--eval", script], {
    encoding: "utf8",
    timeout: 10000,
  })
  if (child.error) throw child.error
  if (child.status !== 0) {
    throw new Error(child.stderr || "Cloudflare vision subprocess failed")
  }
  return parseSubprocessOutcome(child.stdout)
}

describe("Adaptateur Cloudflare Workers AI Vision", () => {
  it("accepte une transcription complète et nettoie ses espaces périphériques", () => {
    const outcome = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  "  Lundi midi : Haricots verts / Poisson\nLundi soir : Panini  ",
              },
            },
          ],
          usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
        },
      }),
    })

    expect(outcome.transcription).toBe(
      "Lundi midi : Haricots verts / Poisson\nLundi soir : Panini"
    )
  })

  it("ignore reasoning_content et rejette si seul reasoning_content est présent", () => {
    const withContent = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                reasoning_content: "Je réfléchis aux lignes du carnet...",
                content: "Mardi midi : Gratin dauphinois",
              },
            },
          ],
        },
      }),
    })
    expect(withContent.requests).toBe(1)
    expect(withContent.transcription).toBe("Mardi midi : Gratin dauphinois")

    const onlyReasoning = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                reasoning_content: "Mardi midi : Gratin dauphinois",
                content: "",
              },
            },
          ],
        },
      }),
    })
    expect(onlyReasoning.requests).toBe(1)
    expect(onlyReasoning.transcription).toBeUndefined()
    expect(onlyReasoning.error).toContain("aucune transcription finale")
  })

  it("rejette une transcription tronquée ou sans confirmation de fin", () => {
    const truncated = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              finish_reason: "length",
              message: {
                role: "assistant",
                content: "Lundi midi : Poisson\nLundi soir : Pan",
              },
            },
          ],
        },
      }),
    })
    expect(truncated.requests).toBe(1)
    expect(truncated.error).toContain("incomplète")

    const missingFinish = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Lundi midi : Poisson",
              },
            },
          ],
        },
      }),
    })
    expect(missingFinish.requests).toBe(1)
    expect(missingFinish.error).toContain("fin de la transcription")
  })

  it("rejette une réponse vide ou un faux succès HTTP 200 sans exposer le JSON fournisseur", () => {
    const emptyContent = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: true,
        result: {
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "   \n  " },
            },
          ],
        },
      }),
    })
    expect(emptyContent.requests).toBe(1)
    expect(emptyContent.error).toContain("aucune transcription finale")

    const falseSuccess = runCloudflareVision({
      status: 200,
      body: JSON.stringify({
        success: false,
        errors: [{ code: 7000, message: "Internal Cloudflare trace 98765" }],
        result: {
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "Lundi midi : Pizza" },
            },
          ],
        },
      }),
    })
    expect(falseSuccess.requests).toBe(1)
    expect(falseSuccess.transcription).toBeUndefined()
    expect(falseSuccess.error).toContain("échec")
    expect(falseSuccess.error).not.toContain("Internal Cloudflare trace 98765")
  })

  it("rejette le JSON malformé sans exposer le corps brut ni les secrets", () => {
    const malformed = runCloudflareVision({
      status: 200,
      body: "{malformed_provider_payload_secret",
    })
    expect(malformed.requests).toBe(1)
    expect(malformed.error).toBe("Réponse invalide du service IA Cloudflare.")
    expect(malformed.error).not.toContain("malformed_provider_payload_secret")
    expect(malformed.error).not.toContain(SECRET_TOKEN)
  })

  it("traduit les erreurs HTTP 401, 403, 429, 503 et 502 en français sans retry ni fuite", () => {
    const base64Image = Buffer.from(SECRET_IMAGE_TEXT, "utf8").toString("base64")

    for (const status of [401, 403]) {
      const authError = runCloudflareVision({
        status,
        body: JSON.stringify({
          success: false,
          errors: [{ code: 10000, message: `Authentication error for ${SECRET_TOKEN}` }],
        }),
      })
      expect(authError.requests).toBe(1)
      expect(authError.error).toContain("Authentification Cloudflare refusée")
      expect(authError.error).not.toContain(SECRET_TOKEN)
      expect(authError.error).not.toContain("10000")
    }

    const quotaError = runCloudflareVision({
      status: 429,
      body: JSON.stringify({
        success: false,
        errors: [{ code: 3040, message: "Daily free neuron allocation exceeded" }],
      }),
    })
    expect(quotaError.requests).toBe(1)
    expect(/quota/i.test(quotaError.error ?? "")).toBe(true)
    expect(quotaError.error).not.toContain("Daily free neuron allocation exceeded")
    expect(quotaError.error).not.toContain(SECRET_TOKEN)
    expect(quotaError.error).not.toContain(base64Image)

    const unavailableError = runCloudflareVision({
      status: 503,
      body: JSON.stringify({
        success: false,
        errors: [{ code: 3043, message: "Upstream model overloaded" }],
      }),
    })
    expect(unavailableError.requests).toBe(1)
    expect(unavailableError.error).toContain("temporairement indisponible")
    expect(unavailableError.error).not.toContain("Upstream model overloaded")

    const gatewayError = runCloudflareVision({
      status: 502,
      body: "Bad Gateway Cloudflare Worker trace",
    })
    expect(gatewayError.requests).toBe(1)
    expect(gatewayError.error).toContain("HTTP 502")
    expect(gatewayError.error).not.toContain("Bad Gateway Cloudflare Worker trace")
  })

  it("valide le format 32 hexadécimal de CLOUDFLARE_ACCOUNT_ID avant tout appel réseau", () => {
    const invalidAccount = runCloudflareVision({
      accountId: "not-a-32-char-hex-account-secret",
      status: 200,
      body: "{}",
    })
    expect(invalidAccount.requests).toBe(0)
    expect(invalidAccount.error).toContain("32 caractères hexadécimaux")
    expect(invalidAccount.error).not.toContain("not-a-32-char-hex-account-secret")
    expect(invalidAccount.error).not.toContain(SECRET_TOKEN)
  })

  it("rend une erreur exploitable lors d'une interruption ou d'une panne réseau", () => {
    const abortedDuringFetch = runCloudflareVision({
      abortMode: "during_fetch",
    })
    expect(abortedDuringFetch.requests).toBe(1)
    expect(abortedDuringFetch.error).toContain("n'a pas répondu à temps")

    const networkFailure = runCloudflareVision({
      networkFailure: true,
    })
    expect(networkFailure.requests).toBe(1)
    expect(networkFailure.error).toContain("Impossible de joindre")
    expect(networkFailure.error).not.toContain(SECRET_TOKEN)
  })
})
