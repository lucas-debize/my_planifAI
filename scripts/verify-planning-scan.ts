import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { extractMealsFromText, parsePlanningToWeekSlots } from "../lib/ai/recipe-extractor"

const args = process.argv.slice(2)
const cloudflareMode = args.includes("--cloudflare")
const [baseUrl, ...images] = args.filter((arg) => arg !== "--cloudflare")
if (!baseUrl || images.length === 0) {
  throw new Error("Usage: bun scripts/verify-planning-scan.ts [--cloudflare] <base-url> <image> [image...]")
}
const directory = resolve(".data/scan-verification")
await mkdir(directory, { recursive: true })
let failures = 0
let cloudflareModel = "cloudflare"
if (cloudflareMode) {
  try {
    const response = await fetch(new URL("/api/health", baseUrl), { signal: AbortSignal.timeout(10000) })
    const body = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 250)}`)
    const data: unknown = JSON.parse(body)
    if (typeof data !== "object" || data === null || !("aiVision" in data) ||
        typeof data.aiVision !== "object" || data.aiVision === null ||
        !("cloudflareConfigured" in data.aiVision) || data.aiVision.cloudflareConfigured !== true) {
      throw new Error("aiVision.cloudflareConfigured n'est pas true")
    }
    if ("cloudflareModel" in data.aiVision &&
        typeof data.aiVision.cloudflareModel === "string" && data.aiVision.cloudflareModel) {
      cloudflareModel = data.aiVision.cloudflareModel
    }
    console.log(JSON.stringify({ check: "health", status: "PASS", provider: cloudflareModel }))
    console.warn("Mode Cloudflare : un statut PASS contrôle la complétude, pas l'exactitude des noms transcrits.")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(JSON.stringify({ check: "health", status: "FAIL", error: message }))
    console.warn("Cloudflare non configuré sur /api/health : aucun scan lancé, aucun quota IA consommé.")
    process.exit(1)
  }
}
for (const image of images) {
  const bytes = await readFile(image)
  const type = image.endsWith(".png") ? "image/png" : image.endsWith(".webp") ? "image/webp" : "image/jpeg"
  const formData = new FormData()
  formData.set("image", new File([bytes], basename(image), { type }))
  formData.set("importMode", "planning")
  const started = performance.now()
  try {
    const response = await fetch(new URL("/api/ai/scan-image", baseUrl), {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(55000),
    })
    const body = await response.text()
    await writeFile(resolve(directory, `${basename(image)}-response.json`), body)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 250)}`)
    const data: unknown = JSON.parse(body)
    if (typeof data !== "object" || data === null || !("transcribedText" in data) || typeof data.transcribedText !== "string") {
      throw new Error("Réponse sans transcription")
    }
    const slots = parsePlanningToWeekSlots(data.transcribedText, "2026-10-31")
    const ideas = extractMealsFromText(data.transcribedText, "image", "list")
    const days = new Set(slots.map((slot) => slot.date))
    const chronological = slots.every((slot, index) => index === 0 || slot.date >= slots[index - 1].date)
    const valid = days.size >= 7 && slots.length >= 13 && chronological && !/let.s look|here is/i.test(data.transcribedText)
    if (!valid) failures++
    console.log(JSON.stringify({
      image: basename(image), status: valid ? "PASS" : "FAIL", http: response.status,
      ...(cloudflareMode ? { provider: cloudflareModel } : {}),
      seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
      days: days.size, slots: slots.length, ideas: ideas.meals.length,
      from: slots[0]?.date, to: slots.at(-1)?.date,
      meals: slots.map((slot) => ({ date: slot.date, kind: slot.kind, name: slot.mealName })),
    }))
  } catch (error) {
    failures++
    const message = error instanceof Error ? error.message : String(error)
    console.log(JSON.stringify({ image: basename(image), status: "FAIL", ...(cloudflareMode ? { provider: cloudflareModel } : {}), seconds: Number(((performance.now() - started) / 1000).toFixed(1)), error: message }))
    if (/Quota IA|RESOURCE_EXHAUSTED|quota.*exceeded|exceeded.*quota/i.test(message)) {
      console.warn("Quota atteint : arrêt des scans suivants pour éviter de nouveaux appels inutiles.")
      break
    }
  }
}
if (failures) process.exitCode = 1
