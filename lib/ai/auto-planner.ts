import type { MealWithIngredients } from "@/lib/domain/meals"
import type { WeekSlot } from "@/lib/domain/slots"
import type { SlotKind } from "@/lib/week"
import { normalizeName } from "@/lib/ingredients"

export type MealCategory = "poisson" | "viande" | "vege" | "feculent"

export type MealProfile = {
  category: MealCategory
  isLight: boolean
}

export type PlannedMealCandidate = {
  id?: string
  name: string
  ingredients: string[]
  origin: "catalog" | "ai"
  category: MealCategory
  isLight: boolean
}

export type PlanProposal = {
  date: string
  kind: SlotKind
  meal: PlannedMealCandidate
}

export type AutoPlanOptions = {
  mode?: "balanced" | "vegetarian" | "quick"
  onlyCatalog?: boolean
  stockOrCravings?: string
}

// Bibliothèque de recettes familiales équilibrées (100% gratuites, pré-intégrées)
export const STAPLE_MEALS: {
  name: string
  ingredients: string[]
  category: MealCategory
  isLight: boolean
}[] = [
  // 🐟 Poissons
  {
    name: "Pavé de saumon et poêlée de courgettes",
    ingredients: ["Saumon", "Courgettes", "Riz", "Huile d'olive", "Citron"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Cabillaud en papillote et tomates cerises",
    ingredients: ["Cabillaud", "Tomates cerises", "Courgettes", "Herbes de Provence", "Huile d'olive"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Wok de crevettes et légumes croquants",
    ingredients: ["Crevettes", "Poivrons", "Carottes", "Nouilles", "Sauce soja", "Ail"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Filet de colin sauce citronnée et riz basmati",
    ingredients: ["Colin", "Riz basmati", "Crème fraîche", "Citron", "Épinards"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Salade niçoise au thon",
    ingredients: ["Thon en boîte", "Oeufs", "Haricots verts", "Tomates", "Pommes de terre", "Olives"],
    category: "poisson",
    isLight: true,
  },

  // 🥩 Volailles & Viandes
  {
    name: "Filets de poulet rôti et haricots verts",
    ingredients: ["Poulet", "Haricots verts", "Pommes de terre", "Ail", "Beurre"],
    category: "viande",
    isLight: false,
  },
  {
    name: "Curry de poulet au lait de coco",
    ingredients: ["Poulet", "Lait de coco", "Poudre de curry", "Oignon", "Riz basmati", "Poivron"],
    category: "viande",
    isLight: false,
  },
  {
    name: "Steak haché et purée maison",
    ingredients: ["Steak haché", "Pommes de terre", "Lait", "Beurre", "Salade"],
    category: "viande",
    isLight: false,
  },
  {
    name: "Escalope de dinde à la crème et champignons",
    ingredients: ["Escalope de dinde", "Champignons", "Crème fraîche", "Pâtes", "Persil"],
    category: "viande",
    isLight: false,
  },
  {
    name: "Chili con carne doux",
    ingredients: ["Boeuf haché", "Haricots rouges", "Coulis de tomate", "Oignon", "Maïs", "Riz"],
    category: "viande",
    isLight: false,
  },
  {
    name: "Sauté de porc aux carottes",
    ingredients: ["Porc", "Carottes", "Oignon", "Bouillon", "Thym"],
    category: "viande",
    isLight: true,
  },
  {
    name: "Salade César au poulet grillé",
    ingredients: ["Poulet", "Laitue", "Parmesan", "Croûtons", "Oeufs", "Sauce césar"],
    category: "viande",
    isLight: true,
  },

  // 🥬 Végétarien & Légumineuses
  {
    name: "Curry de pois chiches et épinards",
    ingredients: ["Pois chiches", "Épinards", "Lait de coco", "Curry", "Oignon", "Riz"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Dahl de lentilles corail",
    ingredients: ["Lentilles corail", "Coulis de tomate", "Lait de coco", "Curry", "Ail", "Coriandre"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Quiche aux poireaux et fromage de chèvre",
    ingredients: ["Pâte brisée", "Poireaux", "Fromage de chèvre", "Oeufs", "Crème fraîche"],
    category: "vege",
    isLight: false,
  },
  {
    name: "Omelette aux champignons et salade verte",
    ingredients: ["Oeufs", "Champignons", "Ciboulette", "Beurre", "Salade verte"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Poêlée de légumes d'été et feta rôtie",
    ingredients: ["Courgettes", "Aubergines", "Poivrons", "Feta", "Huile d'olive", "Origan"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Soupe veloutée de potimarron et tartines",
    ingredients: ["Potimarron", "Carottes", "Crème fraîche", "Pain complet", "Fromage"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Shakshuka aux poivrons et oeufs",
    ingredients: ["Oeufs", "Poivrons", "Tomates pelées", "Oignon", "Cumin", "Pain"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Gratin dauphinois traditionnel",
    ingredients: ["Pommes de terre", "Crème fraîche", "Lait", "Ail", "Muscade"],
    category: "vege",
    isLight: false,
  },
  {
    name: "Salade de chèvre chaud et noix",
    ingredients: ["Fromage de chèvre", "Salade", "Noix", "Pain complet", "Miel", "Huile d'olive"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Tarte fine aux tomates et moutarde",
    ingredients: ["Pâte feuilletée", "Tomates", "Moutarde", "Herbes de Provence", "Huile d'olive"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Velouté de poireaux et pommes de terre",
    ingredients: ["Poireaux", "Pommes de terre", "Beurre", "Crème fraîche", "Croûtons"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Chili sin carne aux haricots noirs",
    ingredients: ["Haricots noirs", "Coulis de tomate", "Poivrons", "Maïs", "Cumin", "Riz"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Ratatouille provençale et riz blanc",
    ingredients: ["Courgettes", "Aubergines", "Tomates", "Poivrons", "Oignon", "Riz"],
    category: "vege",
    isLight: true,
  },
  {
    name: "Lasagnes végétariennes aux épinards et ricotta",
    ingredients: ["Plaques de lasagnes", "Épinards", "Ricotta", "Coulis de tomate", "Parmesan"],
    category: "vege",
    isLight: false,
  },
  {
    name: "Galettes de sarrasin aux champignons et emmental",
    ingredients: ["Galettes de sarrasin", "Champignons", "Emmental", "Beurre", "Oeufs"],
    category: "vege",
    isLight: false,
  },

  // 🍝 Féculents & Plats complets
  {
    name: "Pâtes au pesto et tomates cerises",
    ingredients: ["Pâtes", "Pesto", "Tomates cerises", "Parmesan", "Pignons de pin"],
    category: "feculent",
    isLight: false,
  },
  {
    name: "Risotto crémeux aux champignons",
    ingredients: ["Riz arborio", "Champignons", "Parmesan", "Oignon", "Bouillon de légumes"],
    category: "feculent",
    isLight: false,
  },
  {
    name: "Gratin de coquillettes et jambon",
    ingredients: ["Coquillettes", "Jambon", "Emmental", "Crème fraîche", "Muscade"],
    category: "feculent",
    isLight: false,
  },
  {
    name: "Pâtes bolognaise maison",
    ingredients: ["Spaghetti", "Boeuf haché", "Sauce tomate", "Oignon", "Carotte", "Parmesan"],
    category: "feculent",
    isLight: false,
  },
  {
    name: "Gnocchis poêlés à la mozzarella et basilic",
    ingredients: ["Gnocchis", "Mozzarella", "Coulis de tomate", "Basilic", "Huile d'olive"],
    category: "feculent",
    isLight: false,
  },
]

/**
 * Analyse le profil nutritionnel et culinaire d'un plat à partir de son nom et de ses ingrédients.
 */
export function analyzeMealProfile(name: string, ingredientNames: string[]): MealProfile {
  const text = `${name} ${ingredientNames.join(" ")}`.toLowerCase()

  // Détection Poisson
  if (
    /saumon|thon|cabillaud|poisson|colin|lieu|merlan|sole|truite|crevette|gambas|saint[- ]jacques|moule|calamar|poulpe|sardine/i.test(
      text
    )
  ) {
    return {
      category: "poisson",
      isLight: !/cr[eè]me|beurre|frit|gratin|pan[eé]/i.test(text),
    }
  }

  // Détection Viande / Volaille
  if (
    /poulet|dinde|canard|boeuf|bœuf|porc|veau|agneau|steak|hach[eé]|lardon|jambon|saucisse|merguez|bacon|chorizo/i.test(
      text
    )
  ) {
    return {
      category: "viande",
      isLight: /salade|blanc de|vapeur/i.test(text),
    }
  }

  // Détection Féculents dominants
  if (/p[aâ]te|spaghetti|tagliatelle|penne|lasagne|pizza|gnocchi|risotto|quiche/i.test(text)) {
    return {
      category: "feculent",
      isLight: false,
    }
  }

  // Par défaut : Végétarien
  const isLight = /salade|soupe|velout[eé]|bouillon|vapeur|l[eé]gume|[eé]pinard|pois|lentille/i.test(text)
  return {
    category: "vege",
    isLight,
  }
}

/**
 * Génère une proposition complète pour remplir tous les créneaux vides de la semaine
 * en respectant les règles d'équilibre nutritionnel et sans répétition.
 */
export function generateWeekPlanProposal(params: {
  slots: WeekSlot[]
  catalogMeals: MealWithIngredients[]
  options?: AutoPlanOptions
}): PlanProposal[] {
  const { slots, catalogMeals, options } = params
  const isVegMode = options?.mode === "vegetarian"

  // 1. Repérer les plats déjà posés pour ne jamais les répéter
  const alreadyUsedNorms = new Set<string>()
  for (const slot of slots) {
    if (slot.meal?.name) {
      alreadyUsedNorms.add(normalizeName(slot.meal.name))
    }
  }

  // 2. Transformer le carnet en candidats
  const catalogCandidates: PlannedMealCandidate[] = []
  for (const meal of catalogMeals) {
    const norm = normalizeName(meal.name)
    if (alreadyUsedNorms.has(norm)) continue

    const ingNames = meal.ingredients.map((i) => i.name)
    const profile = analyzeMealProfile(meal.name, ingNames)

    if (isVegMode && (profile.category === "viande" || profile.category === "poisson")) {
      continue
    }

    catalogCandidates.push({
      id: meal.id,
      name: meal.name,
      ingredients: ingNames,
      origin: "catalog",
      category: profile.category,
      isLight: profile.isLight,
    })
  }

  // 3. Préparer les candidats du répertoire de staples
  const stapleCandidates: PlannedMealCandidate[] = []
  for (const staple of STAPLE_MEALS) {
    const norm = normalizeName(staple.name)
    if (alreadyUsedNorms.has(norm)) continue
    if (isVegMode && (staple.category === "viande" || staple.category === "poisson")) {
      continue
    }

    stapleCandidates.push({
      name: staple.name,
      ingredients: staple.ingredients,
      origin: "ai",
      category: staple.category,
      isLight: staple.isLight,
    })
  }

  // Mélanger de façon déterministe/pseudo-aléatoire pour varier
  const shuffledCatalog = [...catalogCandidates].sort(() => Math.random() - 0.5)
  const shuffledStaples = [...stapleCandidates].sort(() => Math.random() - 0.5)

  // Si l'utilisateur a spécifié des stocks ou des envies, prioriser les plats correspondants
  if (options?.stockOrCravings?.trim()) {
    const keywords = options.stockOrCravings
      .toLowerCase()
      .split(/[\s,;+]+/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 3)

    if (keywords.length > 0) {
      const score = (c: PlannedMealCandidate) => {
        const text = `${c.name} ${c.ingredients.join(" ")}`.toLowerCase()
        return keywords.filter((kw) => text.includes(kw)).length
      }
      shuffledCatalog.sort((a, b) => score(b) - score(a))
      shuffledStaples.sort((a, b) => score(b) - score(a))
    }
  }

  // 4. Identifier les créneaux vides
  const emptySlots = slots.filter((s) => s.meal === null)
  const proposals: PlanProposal[] = []

  let lastCategory: MealCategory | null = null
  const usedInProposal = new Set<string>(alreadyUsedNorms)

  for (const slot of emptySlots) {
    const isDinner = slot.slot_kind === "diner"

    // Chercher le meilleur candidat qui n'a pas encore été utilisé
    // Critères :
    // - Pas la même catégorie que le repas précédent
    // - Le soir : favoriser les repas plus légers ou équilibrés
    const findCandidate = (): PlannedMealCandidate | null => {
      // 1. Essayer d'abord dans le carnet
      const catalogMatch = shuffledCatalog.find((c) => {
        const norm = normalizeName(c.name)
        if (usedInProposal.has(norm)) return false
        if (lastCategory && c.category === lastCategory && shuffledCatalog.length > 2) return false
        if (isDinner && !c.isLight && Math.random() > 0.7) return false
        return true
      })
      if (catalogMatch) return catalogMatch

      // Fallback dans le carnet sans contrainte stricte de catégorie
      const looseCatalogMatch = shuffledCatalog.find((c) => !usedInProposal.has(normalizeName(c.name)))
      if (looseCatalogMatch && options?.onlyCatalog) return looseCatalogMatch

      if (options?.onlyCatalog) return null

      // 2. Chercher dans les staples équilibrés
      const stapleMatch = shuffledStaples.find((c) => {
        const norm = normalizeName(c.name)
        if (usedInProposal.has(norm)) return false
        if (lastCategory && c.category === lastCategory && shuffledStaples.length > 3) return false
        return true
      })
      if (stapleMatch) return stapleMatch

      const looseStapleMatch = shuffledStaples.find((c) => !usedInProposal.has(normalizeName(c.name)))
      return looseStapleMatch ?? looseCatalogMatch ?? null
    }

    const chosen = findCandidate()
    if (chosen) {
      usedInProposal.add(normalizeName(chosen.name))
      lastCategory = chosen.category
      proposals.push({
        date: slot.slot_date,
        kind: slot.slot_kind,
        meal: chosen,
      })
    }
  }

  return proposals
}

/**
 * Régénère un plat unique pour un créneau spécifique, sans entrer en conflit
 * avec les autres créneaux de la proposition.
 */
export function rerollSlot(params: {
  slot: { date: string; kind: SlotKind }
  currentMealName: string
  proposals: PlanProposal[]
  catalogMeals: MealWithIngredients[]
  options?: AutoPlanOptions
}): PlannedMealCandidate | null {
  const { currentMealName, proposals, catalogMeals, options } = params
  const isVegMode = options?.mode === "vegetarian"

  const usedNames = new Set(
    proposals
      .map((p) => normalizeName(p.meal.name))
      .filter((name) => name !== normalizeName(currentMealName))
  )

  const pool: PlannedMealCandidate[] = []

  // Carnet
  for (const m of catalogMeals) {
    const norm = normalizeName(m.name)
    if (usedNames.has(norm)) continue
    const ings = m.ingredients.map((i) => i.name)
    const prof = analyzeMealProfile(m.name, ings)
    if (isVegMode && (prof.category === "viande" || prof.category === "poisson")) continue
    pool.push({
      id: m.id,
      name: m.name,
      ingredients: ings,
      origin: "catalog",
      category: prof.category,
      isLight: prof.isLight,
    })
  }

  // Staples
  if (!options?.onlyCatalog) {
    for (const s of STAPLE_MEALS) {
      const norm = normalizeName(s.name)
      if (usedNames.has(norm)) continue
      if (isVegMode && (s.category === "viande" || s.category === "poisson")) continue
      pool.push({
        name: s.name,
        ingredients: s.ingredients,
        origin: "ai",
        category: s.category,
        isLight: s.isLight,
      })
    }
  }

  let filteredPool = pool.filter((c) => normalizeName(c.name) !== normalizeName(currentMealName))
  if (filteredPool.length === 0) return null

  if (options?.stockOrCravings?.trim()) {
    const keywords = options.stockOrCravings
      .toLowerCase()
      .split(/[\s,;+]+/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 3)
    if (keywords.length > 0) {
      const score = (c: PlannedMealCandidate) => {
        const text = `${c.name} ${c.ingredients.join(" ")}`.toLowerCase()
        return keywords.filter((kw) => text.includes(kw)).length
      }
      const matching = filteredPool.filter((c) => score(c) > 0)
      if (matching.length > 0) {
        filteredPool = matching
      }
    }
  }

  // Tirage aléatoire
  const index = Math.floor(Math.random() * filteredPool.length)
  return filteredPool[index]
}
