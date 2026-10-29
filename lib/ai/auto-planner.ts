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
  {
    name: "Dorade royale au four et pommes de terre fondantes",
    ingredients: ["Dorade", "Pommes de terre", "Oignon", "Huile d'olive", "Romarin"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Truite meunière aux amandes et haricots verts",
    ingredients: ["Truite", "Amandes effilées", "Haricots verts", "Beurre", "Citron"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Tagliatelles au saumon frais et aneth",
    ingredients: ["Tagliatelles", "Pavé de saumon", "Crème fraîche", "Aneth", "Citron"],
    category: "poisson",
    isLight: false,
  },
  {
    name: "Lieu noir poêlé et fondue de poireaux",
    ingredients: ["Lieu noir", "Poireaux", "Crème fraîche", "Riz", "Moutarde"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Papillote de merlu aux petits légumes",
    ingredients: ["Merlu", "Carottes", "Courgettes", "Poivrons", "Huile d'olive"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Tartare de saumon avocat et riz sésame",
    ingredients: ["Saumon frais", "Avocat", "Riz vinaigré", "Sauce soja", "Sésame"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Risotto aux crevettes et parmesan",
    ingredients: ["Riz arborio", "Crevettes", "Parmesan", "Oignon", "Bouillon de légumes"],
    category: "poisson",
    isLight: false,
  },
  {
    name: "Poisson blanc à la bordelaise et riz",
    ingredients: ["Poisson blanc", "Chapelure", "Échalote", "Persil", "Riz"],
    category: "poisson",
    isLight: true,
  },
  {
    name: "Tarte au thon et à la tomate",
    ingredients: ["Pâte brisée", "Thon en boîte", "Tomates", "Moutarde", "Gruyère râpé"],
    category: "poisson",
    isLight: false,
  },
  {
    name: "Moules marinières et frites",
    ingredients: ["Moules", "Vin blanc", "Échalote", "Persil", "Frites"],
    category: "poisson",
    isLight: false,
  },
  {
    name: "Couscous de poisson et légumes",
    ingredients: ["Filet de poisson", "Semoule", "Courgettes", "Carottes", "Pois chiches"],
    category: "poisson",
    isLight: false,
  },
  {
    name: "Dos de cabillaud en croûte d'herbes et purée",
    ingredients: ["Cabillaud", "Persil", "Parmesan", "Pommes de terre", "Beurre"],
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
const STOPWORDS: Record<string, true> = {
  que: true, qui: true, quoi: true, dont: true, dans: true, la: true, le: true,
  les: true, un: true, une: true, des: true, du: true, de: true, d: true, l: true,
  et: true, ou: true, en: true, pour: true, avec: true, sans: true, sur: true,
  sous: true, par: true, semaine: true, repas: true, midi: true, soir: true,
  jour: true, tous: true, tout: true, toute: true, toutes: true, chaque: true,
  faire: true, plat: true, plats: true, manger: true, envie: true, stock: true,
  stocks: true,
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

  const rawKeywords = options?.stockOrCravings?.trim()
    ? options.stockOrCravings
        .toLowerCase()
        .split(/[\s,;+.'’]+/)
        .map((k) => k.trim())
        .filter((k) => k.length >= 3 && !STOPWORDS[k])
    : []

  const matchesKeyword = (c: PlannedMealCandidate) => {
    if (rawKeywords.length === 0) return true
    const text = `${c.name} ${c.ingredients.join(" ")}`.toLowerCase()
    return rawKeywords.some(
      (kw) =>
        text.includes(kw) ||
        (kw === "poisson" && c.category === "poisson") ||
        (kw === "vege" && c.category === "vege") ||
        (kw === "viande" && c.category === "viande") ||
        (kw === "feculent" && c.category === "feculent")
    )
  }

  // Filtrer ou prioriser selon les mots-clés de consigne
  let catalogPool = [...catalogCandidates]
  let staplesPool = [...stapleCandidates]

  if (rawKeywords.length > 0) {
    const matchedCatalog = catalogPool.filter(matchesKeyword)
    if (matchedCatalog.length > 0) catalogPool = matchedCatalog

    const matchedStaples = staplesPool.filter(matchesKeyword)
    if (matchedStaples.length > 0) staplesPool = matchedStaples
  }

  const shuffledCatalog = catalogPool.sort(() => Math.random() - 0.5)
  const shuffledStaples = staplesPool.sort(() => Math.random() - 0.5)

  // 4. Identifier les créneaux vides
  const emptySlots = slots.filter((s) => s.meal === null)
  const proposals: PlanProposal[] = []

  let lastCategory: MealCategory | null = null
  const usedInProposal = new Set<string>(alreadyUsedNorms)
  const isEnforcingCraving = rawKeywords.length > 0

  for (const slot of emptySlots) {
    const isDinner = slot.slot_kind === "diner"

    const findCandidate = (): PlannedMealCandidate | null => {
      // 1. Essayer dans le carnet
      const catalogMatch = shuffledCatalog.find((c) => {
        const norm = normalizeName(c.name)
        if (usedInProposal.has(norm)) return false
        if (!isEnforcingCraving && lastCategory && c.category === lastCategory && shuffledCatalog.length > 2) return false
        if (!isEnforcingCraving && isDinner && !c.isLight && Math.random() > 0.7) return false
        return true
      })
      if (catalogMatch) return catalogMatch

      // Fallback dans le carnet sans contrainte de catégorie
      const looseCatalogMatch = shuffledCatalog.find((c) => !usedInProposal.has(normalizeName(c.name)))
      if (looseCatalogMatch) return looseCatalogMatch

      // Si mode carnet uniquement mais carnet épuisé, recycler les plats du carnet pour ne jamais laisser de trous
      if (options?.onlyCatalog && shuffledCatalog.length > 0) {
        const recycled = shuffledCatalog[Math.floor(Math.random() * shuffledCatalog.length)]
        return recycled
      }
      if (options?.onlyCatalog) return null

      // 2. Chercher dans les staples équilibrés
      const stapleMatch = shuffledStaples.find((c) => {
        const norm = normalizeName(c.name)
        if (usedInProposal.has(norm)) return false
        if (!isEnforcingCraving && lastCategory && c.category === lastCategory && shuffledStaples.length > 3) return false
        return true
      })
      if (stapleMatch) return stapleMatch

      const looseStapleMatch = shuffledStaples.find((c) => !usedInProposal.has(normalizeName(c.name)))
      if (looseStapleMatch) return looseStapleMatch

      // Si toutes les idées uniques ont été utilisées mais qu'il reste des créneaux, recycler parmi les staples correspondants
      if (shuffledStaples.length > 0) {
        return shuffledStaples[Math.floor(Math.random() * shuffledStaples.length)]
      }

      return null
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
      .split(/[\s,;+.'’]+/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 3 && !STOPWORDS[k])
    if (keywords.length > 0) {
      const score = (c: PlannedMealCandidate) => {
        const text = `${c.name} ${c.ingredients.join(" ")}`.toLowerCase()
        return keywords.filter(
          (kw) =>
            text.includes(kw) ||
            (kw === "poisson" && c.category === "poisson") ||
            (kw === "vege" && c.category === "vege") ||
            (kw === "viande" && c.category === "viande") ||
            (kw === "feculent" && c.category === "feculent")
        ).length
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
