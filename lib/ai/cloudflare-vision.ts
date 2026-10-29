export const CLOUDFLARE_VISION_MODEL = "@cf/google/gemma-4-26b-a4b-it"

export type CloudflareVisionInput = {
  buffer: Buffer
  mimeType: string
  prompt: string
  accountId: string
  apiToken: string
  signal: AbortSignal
}

const CLOUDFLARE_ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i
const TIMEOUT_MESSAGE =
  "Le service IA Cloudflare n'a pas répondu à temps. Réessayez plus tard ou utilisez l'onglet Texte."
const NETWORK_MESSAGE =
  "Impossible de joindre le service IA Cloudflare. Vérifiez votre connexion ou réessayez plus tard."
const INVALID_RESPONSE_MESSAGE = "Réponse invalide du service IA Cloudflare."

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function createHttpError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(
      "Authentification Cloudflare refusée. Vérifiez CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID."
    )
  }
  if (status === 429) {
    return new Error(
      "Quota IA Cloudflare atteint. Réessayez plus tard ou utilisez l'onglet Texte."
    )
  }
  if (status === 503) {
    return new Error(
      "Le service IA Cloudflare est temporairement indisponible. Réessayez plus tard ou utilisez l'onglet Texte."
    )
  }
  const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500
  return new Error(
    `Le service d'analyse IA Cloudflare a échoué (HTTP ${safeStatus}). Utilisez l'onglet Texte ou réessayez plus tard.`
  )
}

function readCloudflareTranscription(data: unknown): string {
  if (typeof data !== "object" || data === null) {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }
  if (!("success" in data) || data.success !== true) {
    throw new Error("Le service IA Cloudflare a signalé un échec de l'analyse.")
  }
  if (!("result" in data) || typeof data.result !== "object" || data.result === null) {
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }

  const result = data.result
  if (!("choices" in result) || !Array.isArray(result.choices) || result.choices.length === 0) {
    throw new Error("Cloudflare Workers AI n'a retourné aucune transcription.")
  }

  const choice: unknown = result.choices[0]
  if (typeof choice !== "object" || choice === null) {
    throw new Error("Cloudflare Workers AI n'a retourné aucune transcription.")
  }
  if (
    !("finish_reason" in choice) ||
    typeof choice.finish_reason !== "string" ||
    choice.finish_reason.trim().length === 0
  ) {
    throw new Error(
      "La réponse de Cloudflare Workers AI ne confirme pas la fin de la transcription."
    )
  }
  if (choice.finish_reason !== "stop") {
    throw new Error(
      "Transcription incomplète : Cloudflare Workers AI a interrompu la lecture. Aucun repas n'a été importé."
    )
  }
  if (!("message" in choice) || typeof choice.message !== "object" || choice.message === null) {
    throw new Error("Cloudflare Workers AI n'a retourné aucune transcription.")
  }

  const message = choice.message
  if (!("content" in message) || typeof message.content !== "string") {
    throw new Error("Cloudflare Workers AI n'a retourné aucune transcription finale.")
  }

  const transcription = message.content.trim()
  if (!transcription) {
    throw new Error("Cloudflare Workers AI n'a retourné aucune transcription finale.")
  }

  return transcription
}

export async function transcribeCloudflareImage({
  buffer,
  mimeType,
  prompt,
  accountId,
  apiToken,
  signal,
}: CloudflareVisionInput): Promise<string> {
  const normalizedAccountId = accountId.trim()
  const normalizedToken = apiToken.trim()

  if (!normalizedAccountId || !normalizedToken) {
    throw new Error(
      "Configuration Cloudflare incomplète : renseignez CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID."
    )
  }
  if (!CLOUDFLARE_ACCOUNT_ID_PATTERN.test(normalizedAccountId)) {
    throw new Error(
      "Identifiant de compte Cloudflare invalide : CLOUDFLARE_ACCOUNT_ID doit contenir 32 caractères hexadécimaux."
    )
  }

  const normalizedMimeType = mimeType.trim() || "image/jpeg"
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${normalizedAccountId}/ai/run/${CLOUDFLARE_VISION_MODEL}`

  let response: Response
  try {
    signal.throwIfAborted()
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${normalizedMimeType};base64,${buffer.toString("base64")}`,
                },
              },
            ],
          },
        ],
        max_completion_tokens: 2048,
        temperature: 0,
        chat_template_kwargs: {
          enable_thinking: false,
        },
      }),
      signal,
    })
  } catch (error: unknown) {
    if (isAbortError(error, signal)) {
      throw new Error(TIMEOUT_MESSAGE)
    }
    throw new Error(NETWORK_MESSAGE)
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw createHttpError(response.status)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error: unknown) {
    if (isAbortError(error, signal)) {
      throw new Error(TIMEOUT_MESSAGE)
    }
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }

  return readCloudflareTranscription(data)
}
