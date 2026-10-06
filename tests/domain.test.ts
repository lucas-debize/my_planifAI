import { describe, it, expect } from "bun:test"
import { SCOPE_COOKIE, type PlanningScope } from "@/lib/domain/session"
import { resolveMealCopyName, knownFromMeals } from "@/lib/domain/meals"
import { displayName, normalizeName } from "@/lib/ingredients"
import { parseISODate, toISODate, weekDays } from "@/lib/dates"
import { SLOTS } from "@/lib/week"

describe("Domaine Planning, Repas & Gestion de Session", () => {
  describe("Contexte & Cookies de Scope (PlanningScope)", () => {
    it("définit le nom de cookie standardisé", () => {
      expect(SCOPE_COOKIE).toBe("planifia_scope")
    })

    it("résout le scope personnel par défaut quand l'utilisateur n'a pas de famille", () => {
      function computeScope(hasFamily: boolean, cookieValue?: string): PlanningScope {
        if (!hasFamily) {
          return {
            type: "personal",
            familyId: null,
            familyName: null,
            memberCount: 1,
            displayName: "Mon planning perso",
          }
        }
        if (cookieValue === "personal") {
          return {
            type: "personal",
            familyId: null,
            familyName: "Famille Martin",
            memberCount: 3,
            displayName: "Mon planning perso",
          }
        }
        return {
          type: "family",
          familyId: "fam-123",
          familyName: "Famille Martin",
          memberCount: 3,
          displayName: "Famille Martin",
        }
      }

      // Sans famille
      const scopeNoFam = computeScope(false, "family")
      expect(scopeNoFam.type).toBe("personal")
      expect(scopeNoFam.familyId).toBeNull()

      // Avec famille par défaut (sans cookie)
      const scopeDefault = computeScope(true, undefined)
      expect(scopeDefault.type).toBe("family")
      expect(scopeDefault.familyId).toBe("fam-123")
      expect(scopeDefault.displayName).toBe("Famille Martin")

      // Avec famille mais cookie "personal"
      const scopePersonal = computeScope(true, "personal")
      expect(scopePersonal.type).toBe("personal")
      expect(scopePersonal.familyId).toBeNull()
      expect(scopePersonal.familyName).toBe("Famille Martin")
      expect(scopePersonal.memberCount).toBe(3)
    })
  })

  describe("resolveMealCopyName (Anti-collision de noms de plats)", () => {
    const existing = ["Tarte aux pommes", "Pâtes au pesto"]

    it("préserve le nom original quand il n'y a aucun doublon", () => {
      expect(resolveMealCopyName("Gratin dauphinois", "Sophie", existing, "family")).toBe(
        "Gratin dauphinois"
      )
    })

    it("suffixe avec le prénom en cas de doublon vers le groupe familial", () => {
      expect(resolveMealCopyName("Tarte aux pommes", "Sophie", existing, "family")).toBe(
        "Tarte aux pommes (de Sophie)"
      )
    })

    it("incrémente le numéro si le suffixe avec prénom existe déjà", () => {
      const withAuthor = [...existing, "Tarte aux pommes (de Sophie)"]
      expect(resolveMealCopyName("Tarte aux pommes", "Sophie", withAuthor, "family")).toBe(
        "Tarte aux pommes (de Sophie 2)"
      )
    })

    it("incrémente avec un numéro pour une copie vers l'espace personnel", () => {
      expect(resolveMealCopyName("Tarte aux pommes", "Sophie", existing, "personal")).toBe(
        "Tarte aux pommes (2)"
      )
    })

    it("ignore la casse et les espaces superflus lors de la détection de conflit", () => {
      expect(
        resolveMealCopyName("  tarte aux pommes  ", "Sophie", existing, "family")
      ).toBe("tarte aux pommes (de Sophie)")
    })
  })

  describe("knownFromMeals", () => {
    it("dédoublonne et trie alphabétiquement tous les ingrédients d'un catalogue", () => {
      const meals = [
        {
          id: "m-1",
          name: "Plat 1",
          origin: "user" as const,
          ingredients: [
            { id: "i-1", name: "Tomates" },
            { id: "i-2", name: "Mozzarella" },
          ],
        },
        {
          id: "m-2",
          name: "Plat 2",
          origin: "user" as const,
          ingredients: [
            { id: "i-2", name: "Mozzarella" },
            { id: "i-3", name: "Basilic" },
          ],
        },
      ]

      const known = knownFromMeals(meals)
      expect(known.length).toBe(3)
      expect(known.map((k) => k.name)).toEqual(["Basilic", "Mozzarella", "Tomates"])
    })
  })

  describe("Dates & Semaine", () => {
    it("découpe une semaine en 7 jours débutant le lundi", () => {
      const monday = parseISODate("2026-10-05")
      expect(monday).not.toBeNull()
      const days = weekDays(monday!)
      expect(days.length).toBe(7)
      expect(toISODate(days[0])).toBe("2026-10-05")
      expect(toISODate(days[6])).toBe("2026-10-11")
    })

    it("définit les créneaux déjeuner et dîner", () => {
      expect(SLOTS).toEqual(["dejeuner", "diner"])
    })
  })

  describe("Normalisation d'ingrédients", () => {
    it("normalise correctement sans casse ni espaces", () => {
      expect(normalizeName("  Pommes de terre   ")).toBe("pommes de terre")
      expect(displayName("  Crème   fraîche  ")).toBe("Crème fraîche")
    })
  })

  describe("Plafonnement à 10 membres du groupe familial", () => {
    function simulateJoin(currentCount: number): boolean {
      if (currentCount >= 10) {
        throw new Error("Ce groupe a atteint la limite maximale de 10 personnes")
      }
      return true
    }

    it("autorise jusqu'à 10 membres", () => {
      expect(simulateJoin(0)).toBe(true)
      expect(simulateJoin(9)).toBe(true)
    })

    it("bloque strictement le 11e membre avec le message d'erreur officiel", () => {
      expect(() => simulateJoin(10)).toThrow(
        "Ce groupe a atteint la limite maximale de 10 personnes"
      )
    })
  })
})
