import { displayName, normalizeName } from "@/lib/ingredients"

export type ExtractedRecipe = {
  title: string
  ingredients: string[]
  source?: "url" | "text" | "json-ld"
}

// Nettoyage d'une ligne d'ingrédient individuelle
export function cleanIngredientName(raw: string): string {
  let s = raw.trim()

  // 1. Enlever puces et numéros au début (- , * , 1. , etc.)
  s = s.replace(/^(\d+[.)\]]\s*|[-*•+–—\s]+)/, "").trim()

  // 2. Enlever parenthèses complètes (ex: "(environ 200g)", "(facultatif)")
  s = s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()

  // 3. Enlever quantités et unités au début
  // Nombres (ex: 2, 2.5, 200, 1/2) + unités courantes
  const unitRegex =
    /^((\d+([.,/]\d+)?|une?|deux|trois|quatre|quelques|un\s+peu|un\s+demi|une\s+demie?)\s*)?((cuill[eè]res?|c)\.?\s*à\s*(soupe|caf[eé]|[sc]\.?)|kilos?|kg|grammes?|g|litres?|l|centilitres?|cl|millilitres?|ml|cas|cac|pinc[eé]es?|poign[eé]es?|belles?|gousses?|bo[iî]tes?|tranches?|sachets?|morceaux?|brins?|feuilles?|verres?|tasses?|pots?|paquets?|tablettes?|gouttes?)\s+(d['’]|de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+)?/i

  s = s.replace(unitRegex, "").trim()

  // Nombres isolés au début (ex: "3 carottes" -> "carottes", "2 tomates" -> "tomates")
  s = s.replace(/^\d+([.,/]\d+)?\s*(d['’]|de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+)?/i, "").trim()

  // Expressions de quantité textuelle (ex: "un demi citron" -> "citron", "une pincée de sel" -> "sel")
  s = s.replace(
    /^(un\s+demi|une\s+demie?|un\s+peu\s+de|quelques|une?|deux|trois|quatre)\s+(d['’]|de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+)?/i,
    ""
  ).trim()

  // 4. Enlever prépositions résiduelles au début
  s = s.replace(/^(d['’]|de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+)/i, "").trim()

  // 5. Enlever les qualificatifs culinaires fréquents
  // En fin de chaîne ou après virgule (ex: "oignon, émincé" -> "oignon")
  if (s.includes(",")) {
    const parts = s.split(",")
    // Garder le premier segment si le second est juste un état de découpe
    const prepWords = /hach[eé]|coup[eé]|[eé]minc[eé]|r[aâ]p[eé]|fondu|[eé]goutt[eé]|frais|m[uû]r|ti[eè]de|moulu|dor[eé]|pel[eé]|cuit|au\s+choix/i
    if (parts.length > 1 && prepWords.test(parts[1])) {
      s = parts[0].trim()
    }
  }

  // Mots de préparation en fin de mot (ex: "ail haché" -> "ail", "gruyère râpé" -> "gruyère")
  s = s.replace(
    /\s+(bien\s+)?(hach[eé]e?s?|coup[eé]e?s?|[eé]minc[eé]e?s?|r[aâ]p[eé]e?s?|fondu|cuite?s?|dor[eé]e?s?|pel[eé]e?s?|[eé]goutt[eé]e?s?|moulu|concass[eé]e?s?|m[uû]re?s?)(\s+(en\s+d[eé]s|en\s+rondelles|en\s+morceaux|en\s+lani[eè]res))?$/i,
    ""
  ).trim()
  // Enlever les adjectifs frais/fraîche sauf pour les composés comme crème fraîche ou pâte fraîche
  if (!/^(cr[eè]me|p[aâ]te)\s+fra[iî]che/i.test(s)) {
    s = s.replace(/\s+(bien\s+)?(fra[iî]che?s?|frais)$/i, "").trim()
  }
  s = s.replace(/[.,;:]+$/, "").trim()

  if (s.length < 2) return ""

  // Si le mot est "sel et poivre", séparer n'est pas nécessaire ou géré
  // Capitalisation propre
  return displayName(s.charAt(0).toUpperCase() + s.slice(1))
}

/**
 * Extrait le titre et les ingrédients d'un texte libre de recette.
 */
export function extractRecipeFromText(rawText: string): ExtractedRecipe {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { title: "", ingredients: [] }
  }

  // 1. Recherche du titre
  let title = ""
  let titleLineIndex = -1

  // Filtres de lignes à ignorer pour le titre
  const nonTitleRegex =
    /^(ingr[eé]dients?|pr[eé]paration|[eé]tapes?|instructions?|pour\s+\d+|temps\s+de|cuisson|repos|recette\s*:?$)/i

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].replace(/^[#*_\s]+|[#*_\s]+$/g, "").trim()
    if (!line || nonTitleRegex.test(line) || /^[-*•+–—]/.test(lines[i])) continue

    // Si la ligne commence par "Recette de..." ou "Recette : ...", nettoyer
    const cleanTitle = line
      .replace(/^recette\s*(de\s+la\s+|de\s+l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*|:\s*)/i, "")
      .replace(/[.:;!]+$/, "")
      .trim()
    if (cleanTitle.length >= 3 && cleanTitle.length <= 80) {
      title = cleanTitle
      titleLineIndex = i
      break
    }
  }

  // 2. Recherche et découpage de la section Ingrédients
  const ingredientLines: string[] = []
  let inIngredientsSection = false
  let sectionExplicitlyFound = false

  const ingredientHeaderRegex = /^ingr[eé]dients?\b/i
  const stopSectionRegex =
    /^(pr[eé]paration|[eé]tapes?|instructions?|cuisson|progression|marche\s+à\s+suivre)\b/i

  for (let i = 0; i < lines.length; i++) {
    if (i === titleLineIndex) continue
    const line = lines[i]

    if (ingredientHeaderRegex.test(line)) {
      inIngredientsSection = true
      sectionExplicitlyFound = true
      continue
    }

    if (inIngredientsSection && stopSectionRegex.test(line)) {
      break
    }

    if (inIngredientsSection) {
      ingredientLines.push(line)
    }
  }

  // Si aucune section "Ingrédients" n'est explicitement balisée :
  // On prend toutes les lignes hors titre qui ressemblent à des ingrédients
  if (!sectionExplicitlyFound) {
    for (let i = 0; i < lines.length; i++) {
      if (i === titleLineIndex) continue
      const line = lines[i]
      if (stopSectionRegex.test(line)) break
      // Si la ligne ressemble à une puce ou à une ligne courte
      if (
        /^[-*•+–—]/.test(line) ||
        (line.length <= 90 && !line.includes(". "))
      ) {
        ingredientLines.push(line)
      }
    }
  }

  // Si on a très peu de lignes mais que certaines ont des virgules (ex: "Spaghetti, lardons, oeufs")
  const rawIngredients: string[] = []
  for (const line of ingredientLines) {
    if (line.includes(",") && !/^[-*•+–—]/.test(line) && line.length < 150) {
      const parts = line.split(",").map((p) => p.trim()).filter(Boolean)
      rawIngredients.push(...parts)
    } else {
      rawIngredients.push(line)
    }
  }

  // 3. Normalisation et déduplication des ingrédients
  const cleaned: string[] = []
  const seenNorms = new Set<string>()

  for (const raw of rawIngredients) {
    const item = cleanIngredientName(raw)
    if (!item) continue

    // Si c'est "Sel et poivre", décomposer en deux ingrédients distincts
    if (/^sel\s+et\s+poivre$/i.test(item)) {
      for (const splitItem of ["Sel", "Poivre"]) {
        const norm = normalizeName(splitItem)
        if (!seenNorms.has(norm)) {
          seenNorms.add(norm)
          cleaned.push(splitItem)
        }
      }
      continue
    }

    const norm = normalizeName(item)
    // Éviter les lignes parasites qui sont des phrases d'instructions
    if (norm.length > 60 || norm.includes("melanger") || norm.includes("verser")) {
      continue
    }

    if (!seenNorms.has(norm)) {
      seenNorms.add(norm)
      cleaned.push(item)
    }
  }

  return {
    title: title ? displayName(title) : "Nouvelle recette",
    ingredients: cleaned,
    source: "text",
  }
}

/**
 * Extrait les données de recette depuis le HTML d'une page web (JSON-LD Recipe ou meta).
 */
export function extractRecipeFromHtml(html: string): ExtractedRecipe {
  // 1. Recherche de script JSON-LD avec type Recipe
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonText = match[1].trim()
      const data = JSON.parse(jsonText)

      const findRecipe = (obj: unknown): Record<string, unknown> | null => {
        if (!obj || typeof obj !== "object") return null
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findRecipe(item)
            if (found) return found
          }
          return null
        }
        const record = obj as Record<string, unknown>
        if (record["@type"] === "Recipe" || (Array.isArray(record["@type"]) && record["@type"].includes("Recipe"))) {
          return record
        }
        if (record["@graph"]) {
          return findRecipe(record["@graph"])
        }
        return null
      }

      const recipeObj = findRecipe(data)
      if (recipeObj) {
        const title = typeof recipeObj.name === "string" ? recipeObj.name.trim() : ""
        const rawIngs: string[] = []

        if (Array.isArray(recipeObj.recipeIngredient)) {
          for (const ing of recipeObj.recipeIngredient) {
            if (typeof ing === "string") rawIngs.push(ing)
          }
        }

        const cleanedIngs: string[] = []
        const seenNorms = new Set<string>()

        for (const raw of rawIngs) {
          const item = cleanIngredientName(raw)
          if (!item) continue
          const norm = normalizeName(item)
          if (!seenNorms.has(norm)) {
            seenNorms.add(norm)
            cleanedIngs.push(item)
          }
        }

        if (title && cleanedIngs.length > 0) {
          return {
            title: displayName(title),
            ingredients: cleanedIngs,
            source: "json-ld",
          }
        }
      }
    } catch {
      // JSON-LD malformé, continuer vers le suivant
    }
  }

  // 2. Si pas de JSON-LD : recherche des balises meta OpenGraph ou title
  let title = ""
  const ogTitleMatch = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogTitleMatch?.[1]) {
    title = ogTitleMatch[1]
      .replace(/\s*[-|•]\s*(Marmiton|750g|CuisineAZ|Chefclub|Cuisine Actuelle|Recette).*$/i, "")
      .replace(/^recette\s*(de\s+la\s+|de\s+l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*|:\s*)?/i, "")
      .trim()
  }

  if (!title) {
    const titleTagMatch = html.match(/<title\b[^>]*>([^<]+)<\/title>/i)
    if (titleTagMatch?.[1]) {
      title = titleTagMatch[1]
        .replace(/\s*[-|•]\s*(Marmiton|750g|CuisineAZ|Chefclub|Cuisine Actuelle|Recette).*$/i, "")
        .trim()
    }
  }

  // Nettoyage sommaire du corps texte pour le passer au parser texte
  const textContent = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")

  const parsed = extractRecipeFromText(textContent)
  return {
    title: title ? displayName(title) : parsed.title,
    ingredients: parsed.ingredients,
    source: "url",
  }
}
