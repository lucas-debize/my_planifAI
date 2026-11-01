import { describe, it, expect } from "bun:test"
import {
  areMealNamesSimilar,
  findSimilarMeal,
  levenshteinDistance,
} from "@/lib/domain/meal-similarity"
import type { MealWithIngredients } from "@/lib/domain/meals"

describe("Détection et comparaison de similarité de plats (Meal Similarity & Merge)", () => {
  describe("levenshteinDistance", () => {
    it("calcule la distance d'édition exacte", () => {
      expect(levenshteinDistance("lasagne", "lasagne")).toBe(0)
      expect(levenshteinDistance("lasagne", "lasagnes")).toBe(1)
      expect(levenshteinDistance("poulet", "porc")).toBe(4)
    })
  })

  describe("areMealNamesSimilar", () => {
    it("détecte des noms identiques malgré la casse ou la ponctuation", () => {
      expect(areMealNamesSimilar("Quiche Lorraine", "quiche lorraine")).toBe(true)
      expect(areMealNamesSimilar("Poulet rôti !", "poulet roti")).toBe(true)
    })

    it("détecte des variantes proches avec ou sans articles", () => {
      expect(areMealNamesSimilar("Quiche aux poireaux", "Quiche poireaux")).toBe(true)
      expect(areMealNamesSimilar("Gratin de pâtes", "Gratin pâtes")).toBe(true)
      expect(areMealNamesSimilar("Tarte aux pommes maison", "Tarte aux pommes")).toBe(true)
    })

    it("détecte des fautes de frappe légères", () => {
      expect(areMealNamesSimilar("Salade césar", "Salade cesar")).toBe(true)
      expect(areMealNamesSimilar("Tartiflette savoyarde", "Tartiflette savoyard")).toBe(true)
    })

    it("ne confond pas des plats distincts", () => {
      expect(areMealNamesSimilar("Poulet rôti", "Boeuf bourguignon")).toBe(false)
      expect(areMealNamesSimilar("Pizza 4 fromages", "Pizza reine")).toBe(false)
      expect(areMealNamesSimilar("Pâtes carbonara", "Pâtes bolognaise")).toBe(false)
    })
  })

  describe("findSimilarMeal", () => {
    const existing: MealWithIngredients[] = [
      {
        id: "m-1",
        name: "Quiche aux poireaux",
        origin: "user",
        ingredients: [{ id: "i-1", name: "Poireaux" }],
      },
      {
        id: "m-2",
        name: "Poulet basquaise",
        origin: "user",
        ingredients: [{ id: "i-2", name: "Poulet" }],
      },
    ]

    it("trouve le plat existant correspondant", () => {
      const match = findSimilarMeal("Quiche poireaux", existing)
      expect(match).not.toBeNull()
      expect(match?.id).toBe("m-1")
    })

    it("ignore l'id exclu en cas d'édition", () => {
      const match = findSimilarMeal("Quiche aux poireaux", existing, "m-1")
      expect(match).toBeNull()
    })

    it("renvoie null si aucun plat ne correspond", () => {
      const match = findSimilarMeal("Couscous royal", existing)
      expect(match).toBeNull()
    })
  })
})
