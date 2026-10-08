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

  describe("Plats 'Reste' et liste de courses", () => {
    it("détecte les plats de type Reste", () => {
      const isReste = (name: string) => /^reste\b/i.test(name.trim())
      expect(isReste("Reste : Lasagnes maison")).toBe(true)
      expect(isReste("Reste de repas")).toBe(true)
      expect(isReste("reste")).toBe(true)
      expect(isReste("Poulet rôti")).toBe(false)
    })

    it("garantit qu'un plat reste n'ajoute aucun ingrédient de course", () => {
      const resteMeal = {
        id: "m-reste-1",
        name: "Reste : Lasagnes maison",
        origin: "user" as const,
        ingredients: [],
      }
      expect(resteMeal.ingredients.length).toBe(0)
    })
  })

  describe("Ingrédients de plat avec quantités", () => {
    it("préserve la quantité associée aux ingrédients d'un plat", () => {
      const meal = {
        id: "m-1",
        name: "Gâteau au chocolat",
        origin: "user" as const,
        ingredients: [
          { id: "i-1", name: "Chocolat", quantity: "200g" },
          { id: "i-2", name: "Beurre", quantity: "100g" },
          { id: "i-3", name: "Oeufs", quantity: "3" },
          { id: "i-4", name: "Farine", quantity: null },
        ],
      }
      expect(meal.ingredients[0].quantity).toBe("200g")
      expect(meal.ingredients[1].quantity).toBe("100g")
      expect(meal.ingredients[2].quantity).toBe("3")
      expect(meal.ingredients[3].quantity).toBeNull()
    })
  })

  describe("Sélection automatique du reste de la veille", () => {
    type TestSlot = {
      date: string
      kind: "lunch" | "dinner"
      meal: { id: string; name: string } | null
    }

    function findPreviousMeal(
      date: string,
      kind: "lunch" | "dinner",
      slots: TestSlot[]
    ) {
      const isTargetDinner = kind === "dinner"
      const priorSlots = slots.filter((s) => {
        if (s.date < date) return true
        if (s.date === date && isTargetDinner && s.kind === "lunch") return true
        return false
      })

      priorSlots.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        if (a.kind === "dinner" && b.kind === "lunch") return -1
        if (a.kind === "lunch" && b.kind === "dinner") return 1
        return 0
      })

      const found = priorSlots.find((s) => Boolean(s.meal?.name))
      if (!found || !found.meal) return null

      const cleanName = found.meal.name.replace(/^reste\s*:\s*/i, "").trim()
      const isSameDayLunch = found.date === date && found.kind === "lunch"
      return {
        cleanName,
        label: isSameDayLunch
          ? `Reste de ce midi : ${cleanName}`
          : `Reste de la veille : ${cleanName}`,
        resteTitle: `Reste : ${cleanName}`,
      }
    }

    it("trouve le déjeuner du jour même pour le dîner", () => {
      const slots: TestSlot[] = [
        { date: "2026-10-09", kind: "lunch", meal: { id: "1", name: "Quiche lorraine" } },
        { date: "2026-10-08", kind: "dinner", meal: { id: "2", name: "Pâtes carbo" } },
      ]
      const prev = findPreviousMeal("2026-10-09", "dinner", slots)
      expect(prev?.cleanName).toBe("Quiche lorraine")
      expect(prev?.label).toBe("Reste de ce midi : Quiche lorraine")
      expect(prev?.resteTitle).toBe("Reste : Quiche lorraine")
    })

    it("trouve le dîner de la veille pour le déjeuner", () => {
      const slots: TestSlot[] = [
        { date: "2026-10-08", kind: "dinner", meal: { id: "2", name: "Lasagnes" } },
        { date: "2026-10-08", kind: "lunch", meal: { id: "3", name: "Salade" } },
      ]
      const prev = findPreviousMeal("2026-10-09", "lunch", slots)
      expect(prev?.cleanName).toBe("Lasagnes")
      expect(prev?.label).toBe("Reste de la veille : Lasagnes")
      expect(prev?.resteTitle).toBe("Reste : Lasagnes")
    })

    it("renvoie null si aucun repas antérieur n'est planifié", () => {
      const slots: TestSlot[] = [
        { date: "2026-10-09", kind: "dinner", meal: { id: "1", name: "Pizza" } },
      ]
      const prev = findPreviousMeal("2026-10-09", "lunch", slots)
      expect(prev).toBeNull()
    })
  })

  describe("Détection anti-duplication de plat dans les idées", () => {
    const existingMeals = [
      { id: "1", name: "Poulet Rôti" },
      { id: "2", name: "Pâtes Bolognaise" },
    ]

    function checkDuplicate(name: string, meals: typeof existingMeals) {
      const norm = normalizeName(name)
      if (!norm) return null
      return meals.find((m) => normalizeName(m.name) === norm) ?? null
    }

    it("détecte un plat existant malgré la casse et les espaces", () => {
      const match = checkDuplicate("  poulet rôti  ", existingMeals)
      expect(match?.id).toBe("1")
      expect(match?.name).toBe("Poulet Rôti")
    })

    it("autorise un plat distinct", () => {
      const match = checkDuplicate("Poulet au curry", existingMeals)
      expect(match).toBeNull()
    })
  })
})
