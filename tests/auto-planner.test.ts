import { describe, it, expect } from "bun:test"
import {
  analyzeMealProfile,
  generateWeekPlanProposal,
  rerollSlot,
} from "@/lib/ai/auto-planner"
import type { WeekSlot } from "@/lib/domain/slots"
import type { MealWithIngredients } from "@/lib/domain/meals"
import { SLOTS } from "@/lib/week"

describe("Auto-planner Magic Fill (Équilibrage & Planification locale)", () => {
  describe("analyzeMealProfile", () => {
    it("détecte le profil poisson", () => {
      const profile = analyzeMealProfile("Pavé de saumon", ["Saumon", "Riz", "Citron"])
      expect(profile.category).toBe("poisson")
      expect(profile.isLight).toBe(true)
    })

    it("détecte le profil viande", () => {
      const profile = analyzeMealProfile("Escalope de poulet à la crème", [
        "Poulet",
        "Crème fraîche",
        "Champignons",
      ])
      expect(profile.category).toBe("viande")
      expect(profile.isLight).toBe(false)
    })

    it("détecte le profil féculent dominant", () => {
      const profile = analyzeMealProfile("Pâtes au pesto", ["Pâtes", "Pesto", "Parmesan"])
      expect(profile.category).toBe("feculent")
    })

    it("détecte le profil végétarien", () => {
      const profile = analyzeMealProfile("Curry de pois chiches", [
        "Pois chiches",
        "Lait de coco",
        "Épinards",
      ])
      expect(profile.category).toBe("vege")
      expect(profile.isLight).toBe(true)
    })
  })

  describe("generateWeekPlanProposal", () => {
    const dates = [
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08",
      "2026-10-09", "2026-10-10", "2026-10-11",
    ]
    const emptySlots: WeekSlot[] = dates.flatMap((date) =>
      SLOTS.map((kind) => ({ slot_date: date, slot_kind: kind, meal: null }))
    )

    it("génère 14 créneaux équilibrés pour une semaine entièrement vide", () => {
      const proposals = generateWeekPlanProposal({
        slots: emptySlots,
        catalogMeals: [],
        options: { mode: "balanced" },
      })

      expect(proposals.length).toBe(14)

      // Zéro doublon
      const names = new Set(proposals.map((p) => p.meal.name.toLowerCase()))
      expect(names.size).toBe(14)
    })

    it("respecte le mode 100% végétarien", () => {
      const proposals = generateWeekPlanProposal({
        slots: emptySlots,
        catalogMeals: [],
        options: { mode: "vegetarian" },
      })

      expect(proposals.length).toBe(14)
      const hasMeatOrFish = proposals.some(
        (p) => p.meal.category === "viande" || p.meal.category === "poisson"
      )
      expect(hasMeatOrFish).toBe(false)
    })

    it("ne remplit que les créneaux vides et préserve les repas existants", () => {
      const partiallyFilled: WeekSlot[] = emptySlots.map((s, idx) => {
        if (idx === 0) {
          return { ...s, meal: { id: "m-1", name: "Salade César au poulet grillé" } }
        }
        if (idx === 3) {
          return { ...s, meal: { id: "m-2", name: "Pavé de saumon et poêlée de courgettes" } }
        }
        return s
      })

      const proposals = generateWeekPlanProposal({
        slots: partiallyFilled,
        catalogMeals: [],
        options: { mode: "balanced" },
      })

      expect(proposals.length).toBe(12)

      // Ne repropose pas les repas déjà existants
      const names = proposals.map((p) => p.meal.name.toLowerCase())
      expect(names).not.toContain("salade césar au poulet grillé")
      expect(names).not.toContain("pavé de saumon et poêlée de courgettes")
    })

    it("intègre en priorité les recettes du carnet de l'utilisateur", () => {
      const userCatalog: MealWithIngredients[] = [
        { id: "c-1", name: "Tarte tatin aux tomates", ingredients: [], origin: "user" },
        { id: "c-2", name: "Blanquette de veau maison", ingredients: [], origin: "user" },
        { id: "c-3", name: "Soupe de nouilles ramen", ingredients: [], origin: "user" },
      ]

      const proposals = generateWeekPlanProposal({
        slots: emptySlots,
        catalogMeals: userCatalog,
        options: { mode: "balanced" },
      })

      const fromCatalog = proposals.filter((p) => p.meal.origin === "catalog")
      expect(fromCatalog.length).toBe(3)
      expect(fromCatalog.map((p) => p.meal.id)).toContain("c-1")
      expect(fromCatalog.map((p) => p.meal.id)).toContain("c-2")
      expect(fromCatalog.map((p) => p.meal.id)).toContain("c-3")
    })

    it("applique strictement la consigne 'que du poisson dans la semaine'", () => {
      const proposals = generateWeekPlanProposal({
        slots: emptySlots,
        catalogMeals: [],
        options: { stockOrCravings: "que du poisson dans la semaine", onlyCatalog: false },
      })

      expect(proposals.length).toBe(14)
      for (const p of proposals) {
        expect(p.meal.category).toBe("poisson")
      }
    })

    it("remplit tous les créneaux même avec un carnet réduit en mode carnet uniquement", () => {
      const miniCatalog: MealWithIngredients[] = [
        {
          id: "m-1",
          name: "Risotto aux champignons",
          origin: "user",
          ingredients: [{ id: "i-1", name: "Riz" }],
        },
        {
          id: "m-2",
          name: "Pâtes au pesto",
          origin: "user",
          ingredients: [{ id: "i-2", name: "Pesto" }],
        },
      ]
      const proposals = generateWeekPlanProposal({
        slots: emptySlots,
        catalogMeals: miniCatalog,
        options: { onlyCatalog: true },
      })

      expect(proposals.length).toBe(14)
      for (const p of proposals) {
        expect(["m-1", "m-2"]).toContain(p.meal.id!)
      }
    })
  })

  describe("rerollSlot", () => {
    it("permet de relancer un créneau sans collision avec les autres repas", () => {
      const dates = ["2026-10-05", "2026-10-06"]
      const slots: WeekSlot[] = dates.flatMap((date) =>
        SLOTS.map((kind) => ({ slot_date: date, slot_kind: kind, meal: null }))
      )

      const proposals = generateWeekPlanProposal({
        slots,
        catalogMeals: [],
        options: { mode: "balanced" },
      })

      const target = proposals[0]
      const rerolled = rerollSlot({
        slot: { date: target.date, kind: target.kind },
        currentMealName: target.meal.name,
        proposals,
        catalogMeals: [],
        options: { mode: "balanced" },
      })

      expect(rerolled).not.toBeNull()
      expect(rerolled?.name.toLowerCase()).not.toBe(target.meal.name.toLowerCase())

      // Vérifier l'absence de conflit avec les créneaux restants
      const otherNames = proposals.slice(1).map((p) => p.meal.name.toLowerCase())
      expect(otherNames).not.toContain(rerolled!.name.toLowerCase())
    })

    it("respecte scrupuleusement l'option stockOrCravings lors d'un reroll de plat unique", () => {
      const proposals = [
        {
          date: "2026-10-05",
          kind: "diner" as const,
          meal: { name: "Pizza", ingredients: ["Pâte", "Tomate"], origin: "ai" as const, category: "feculent" as const, isLight: false },
        },
      ]

      const rerolled = rerollSlot({
        slot: { date: "2026-10-05", kind: "diner" },
        currentMealName: "Pizza",
        proposals,
        catalogMeals: [],
        options: {
          mode: "balanced",
          onlyCatalog: false,
          stockOrCravings: "envie de poulet",
        },
      })

      expect(rerolled).not.toBeNull()
      const text = `${rerolled!.name} ${rerolled!.ingredients.join(" ")}`.toLowerCase()
      expect(text.includes("poulet") || rerolled!.category === "viande").toBe(true)
    })

    it("respecte onlyCatalog et recycle parmi le carnet si les plats uniques sont épuisés", () => {
      const catalog: MealWithIngredients[] = [
        {
          id: "c-1",
          name: "Gratin dauphinois",
          origin: "user",
          ingredients: [{ id: "i-1", name: "Pommes de terre", quantity: null }],
        },
        {
          id: "c-2",
          name: "Soupe de potimarron",
          origin: "user",
          ingredients: [{ id: "i-2", name: "Potimarron", quantity: null }],
        },
      ]

      const proposals = [
        {
          date: "2026-10-05",
          kind: "dejeuner" as const,
          meal: { id: "c-1", name: "Gratin dauphinois", ingredients: ["Pommes de terre"], origin: "catalog" as const, category: "feculent" as const, isLight: false },
        },
        {
          date: "2026-10-05",
          kind: "diner" as const,
          meal: { id: "c-2", name: "Soupe de potimarron", ingredients: ["Potimarron"], origin: "catalog" as const, category: "vege" as const, isLight: true },
        },
      ]

      // Relance le déjeuner (qui était Gratin dauphinois) en mode carnet uniquement
      const rerolled = rerollSlot({
        slot: { date: "2026-10-05", kind: "dejeuner" },
        currentMealName: "Gratin dauphinois",
        proposals,
        catalogMeals: catalog,
        options: {
          onlyCatalog: true,
        },
      })

      expect(rerolled).not.toBeNull()
      expect(rerolled!.origin).toBe("catalog")
      expect(["c-1", "c-2"]).toContain(rerolled!.id!)
    })
  })
})
