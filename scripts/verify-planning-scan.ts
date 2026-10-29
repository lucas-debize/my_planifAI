import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { extractMealsFromText, parsePlanningToWeekSlots } from "../lib/ai/recipe-extractor"

const [baseUrl, ...images] = process.argv.slice(2)
if (!baseUrl || images.length === 0) {
  throw new Error("Usage: bun scripts/verify-planning-scan.ts <base-url> <image> [image...]")
}
const directory = resolve(".data/scan-verification")
await mkdir(directory, { recursive: true })
let failures = 0
for (const [index, image] of images.entries()) {
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
    await writeFile(resolve(directory, `${index + 1}-response.json`), body)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 250)}`)
    const data: unknown = JSON.parse(body)
    if (typeof data !== "object" || data === null || !("transcribedText" in data) || typeof data.transcribedText !== "string") {
      throw new Error("Réponse sans transcription")
    }
    const slots = parsePlanningToWeekSlots(data.transcribedText, "2026-10-31")
    const ideas = extractMealsFromText(data.transcribedText, "image", "list")
    const days = new Set(slots.map((slot) => slot.date))
    const valid = days.size === 7 && slots.length >= 13 && !/let.s look|here is/i.test(data.transcribedText)
    if (!valid) failures++
    console.log(JSON.stringify({
      image: basename(image), status: valid ? "PASS" : "FAIL", http: response.status,
      seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
      days: days.size, slots: slots.length, ideas: ideas.meals.length,
      meals: slots.map((slot) => ({ date: slot.date, kind: slot.kind, name: slot.mealName })),
    }))
  } catch (error) {
    failures++
    const message = error instanceof Error ? error.message : String(error)
    console.log(JSON.stringify({ image: basename(image), status: "FAIL", seconds: Number(((performance.now() - started) / 1000).toFixed(1)), error: message }))
    if (/Quota IA|RESOURCE_EXHAUSTED|quota.*exceeded|exceeded.*quota/i.test(message)) {
      console.warn("Quota atteint : arrêt des scans suivants pour éviter de nouveaux appels inutiles.")
      break
    }
  }
}
if (failures) process.exitCode = 1
