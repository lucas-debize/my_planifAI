import { normalizeName } from "@/lib/ingredients"
import type { MealWithIngredients } from "@/lib/domain/meals"

/**
 * Calcule la distance d'édition de Levenshtein entre deux chaînes.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }
  return row[b.length]
}

/**
 * Nettoie une chaîne pour comparaison lexicale souple (sans accents, sans ponctuation, sans mots de liaison).
 */
function simplifyForComparison(s: string): string {
  return normalizeName(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(?:la|le|les|un|une|des|du|de|d|au|aux|a|et|maison|facon)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Détermine si deux titres de plats sont identiques ou fortement similaires.
 */
export function areMealNamesSimilar(nameA: string, nameB: string): boolean {
  const normA = simplifyForComparison(nameA)
  const normB = simplifyForComparison(nameB)
  if (!normA || !normB) return false
  if (normA === normB) return true

  // Inclusion de sous-titres significatifs (ex: "quiche poireaux" dans "quiche aux poireaux")
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) return true
  }

  // Similarité de Levenshtein relative
  const dist = levenshteinDistance(normA, normB)
  const maxLen = Math.max(normA.length, normB.length)
  const similarity = 1 - dist / maxLen
  return similarity >= 0.75
}

/**
 * Trouve un plat similaire dans une liste de plats existants.
 */
export function findSimilarMeal(
  candidateName: string,
  existingMeals: MealWithIngredients[],
  excludeMealId?: string
): MealWithIngredients | null {
  for (const existing of existingMeals) {
    if (excludeMealId && existing.id === excludeMealId) continue
    if (areMealNamesSimilar(candidateName, existing.name)) {
      return existing
    }
  }
  return null
}
