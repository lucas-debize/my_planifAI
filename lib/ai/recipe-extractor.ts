import { displayName, normalizeName } from "@/lib/ingredients"
import { STAPLE_MEALS } from "@/lib/ai/auto-planner"

export type ExtractedIngredient = {
  name: string
  quantity?: string
  raw: string
}

export type ExtractedRecipe = {
  title: string
  ingredients: string[]
  detailedIngredients: ExtractedIngredient[]
  source?: "url" | "text" | "json-ld" | "image"
  isDefaultRecipe?: boolean
}

export type ExtractedMealBatch = {
  kind: "single" | "list"
  meals: ExtractedRecipe[]
  source?: "url" | "text" | "json-ld" | "image"
}

/**
 * Détecte et extrait la quantité éventuelle au début d'un ingrédient brut.
 */
export function extractIngredientQuantity(raw: string): string | undefined {
  let s = raw.trim().replace(/^(\d+[.)\]]\s*|[-*•+–—\s]+)/, "").trim()
  s = s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()

  const qtyMatch = s.match(
    /^((?:\d+(?:[.,/]\d+)?|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quelques|un\s+peu|un\s+demi|une\s+demie?)\s*(?:(?:cuill[eè]res?|c)\.?\s*à\s*(?:soupe|caf[eé]|[sc]\.?)|kilos?|kg|grammes?|g|litres?|l|centilitres?|cl|millilitres?|ml|cas|cac|pinc[eé]es?|poign[eé]es?|belles?|gousses?|bo[iî]tes?|tranches?|sachets?|morceaux?|brins?|feuilles?|verres?|tasses?|pots?|paquets?|tablettes?|gouttes?)|\d+(?:[.,/]\d+)?\s*(?:kg|g|l|cl|ml|cas|cac)?|\b(?:un\s+demi|une\s+demie?|un\s+peu)\b)/i
  )

  if (!qtyMatch) return undefined

  let q = qtyMatch[1].trim()
  q = q
    .replace(/^(?:un|une)\s+demie?\b/i, "1/2")
    .replace(/^une?\b/i, "1")
    .replace(/^deux\b/i, "2")
    .replace(/^trois\b/i, "3")
    .replace(/^quatre\b/i, "4")
    .replace(/^cinq\b/i, "5")
    .replace(/cuill[eè]res?\s*à\s*soupe/i, "c. à soupe")
    .replace(/cuill[eè]res?\s*à\s*caf[eé]/i, "c. à café")
  return q
}

/**
 * Découpe et extrait le nom nettoyé ainsi que la quantité.
 */
export function parseIngredientLine(raw: string): ExtractedIngredient[] {
  const item = cleanIngredientName(raw)
  if (!item) return []

  if (/^sel\s+et\s+poivre$/i.test(item)) {
    return [
      { name: "Sel", raw },
      { name: "Poivre", raw },
    ]
  }

  const quantity = extractIngredientQuantity(raw)
  return [{ name: item, quantity, raw }]
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
 * Quantité usuelle par défaut selon le type d'ingrédient.
 */
function getTypicalQuantity(norm: string): string {
  if (
    norm.includes("lasagne") ||
    norm.includes("pates") ||
    norm.includes("spaghetti") ||
    norm.includes("coquillette") ||
    norm.includes("tagliatelle") ||
    norm.includes("nouille")
  ) {
    return "400g"
  }
  if (
    norm.includes("riz") ||
    norm.includes("semoule") ||
    norm.includes("lentille") ||
    norm.includes("quinoa") ||
    norm.includes("feculent")
  ) {
    return "300g"
  }
  if (norm.includes("boeuf hache") || norm.includes("viande hachee")) return "400g"
  if (norm.includes("steak hache")) return "2"
  if (
    norm.includes("poulet") ||
    norm.includes("dinde") ||
    norm.includes("porc") ||
    norm.includes("veau") ||
    norm.includes("saumon") ||
    norm.includes("cabillaud") ||
    norm.includes("colin") ||
    norm.includes("poisson") ||
    norm.includes("crevette")
  ) {
    return "400g"
  }
  if (norm.includes("lardon") || norm.includes("jambon")) return "150g"
  if (
    norm.includes("pate brisee") ||
    norm.includes("pate feuilletee") ||
    norm.includes("pate a pizza") ||
    norm.includes("salade") ||
    norm.includes("laitue")
  ) {
    return "1"
  }
  if (norm.includes("oeuf")) return "3"
  if (norm.includes("creme") || norm.includes("lait de coco")) return "20cl"
  if (norm.includes("sauce tomate") || norm.includes("coulis de tomate")) return "300g"
  if (norm.includes("lait")) return "25cl"
  if (norm.includes("beurre")) return "25g"
  if (
    norm.includes("fromage") ||
    norm.includes("emmental") ||
    norm.includes("mozzarella") ||
    norm.includes("parmesan") ||
    norm.includes("chevre") ||
    norm.includes("feta") ||
    norm.includes("cheddar")
  ) {
    return "100g"
  }
  if (norm.includes("pomme de terre") || norm.includes("legume")) return "400g"
  if (
    norm.includes("carotte") ||
    norm.includes("poireau") ||
    norm.includes("tomate") ||
    norm.includes("courgette") ||
    norm.includes("aubergine") ||
    norm.includes("poivron")
  ) {
    return "2"
  }
  if (norm.includes("oignon")) return "1"
  if (norm.includes("ail")) return "1 gousse"
  if (
    norm.includes("huile") ||
    norm.includes("vinaigre") ||
    norm.includes("vinaigrette") ||
    norm.includes("sauce soja") ||
    norm.includes("moutarde") ||
    norm.includes("miel")
  ) {
    return "2 c. à soupe"
  }
  if (norm.includes("pain")) return "4 tranches"
  return "200g"
}

function toExtractedIngredient(name: string, quantity?: string): ExtractedIngredient {
  const norm = normalizeName(name)
  const qty = quantity ?? getTypicalQuantity(norm)
  const dName = displayName(name)
  return {
    name: dName,
    quantity: qty,
    raw: qty ? `${qty} ${dName}` : dName,
  }
}

const CLASSIC_DISH_RECIPES: {
  keywords: string[]
  ingredients: { name: string; quantity?: string }[]
}[] = [
  {
    keywords: ["lasagne"],
    ingredients: [
      { name: "Pâtes à lasagnes", quantity: "300g" },
      { name: "Boeuf haché", quantity: "400g" },
      { name: "Sauce tomate", quantity: "400g" },
      { name: "Oignon", quantity: "1" },
      { name: "Emmental râpé", quantity: "100g" },
    ],
  },
  {
    keywords: ["quiche lorraine"],
    ingredients: [
      { name: "Pâte brisée", quantity: "1" },
      { name: "Lardons", quantity: "200g" },
      { name: "Oeufs", quantity: "3" },
      { name: "Crème fraîche", quantity: "20cl" },
    ],
  },
  {
    keywords: ["steak hache pure", "steak pure", "steak hache et pure"],
    ingredients: [
      { name: "Steak haché", quantity: "2" },
      { name: "Pommes de terre", quantity: "500g" },
      { name: "Lait", quantity: "20cl" },
      { name: "Beurre", quantity: "30g" },
      { name: "Salade verte", quantity: "1" },
    ],
  },
  {
    keywords: ["pates au pesto", "pate au pesto"],
    ingredients: [
      { name: "Pâtes", quantity: "400g" },
      { name: "Pesto", quantity: "1 pot" },
      { name: "Tomates cerises", quantity: "200g" },
      { name: "Parmesan", quantity: "50g" },
    ],
  },
  {
    keywords: ["poulet roti"],
    ingredients: [
      { name: "Poulet", quantity: "1" },
      { name: "Pommes de terre", quantity: "400g" },
      { name: "Haricots verts", quantity: "300g" },
      { name: "Ail", quantity: "2 gousses" },
      { name: "Beurre", quantity: "30g" },
    ],
  },
  {
    keywords: ["chevre chaud"],
    ingredients: [
      { name: "Fromage de chèvre", quantity: "150g" },
      { name: "Salade", quantity: "1" },
      { name: "Pain complet", quantity: "4 tranches" },
      { name: "Noix", quantity: "50g" },
      { name: "Miel", quantity: "2 c. à soupe" },
      { name: "Huile d'olive", quantity: "2 c. à soupe" },
    ],
  },
  {
    keywords: ["pizza"],
    ingredients: [
      { name: "Pâte à pizza", quantity: "1" },
      { name: "Sauce tomate", quantity: "200g" },
      { name: "Mozzarella", quantity: "150g" },
      { name: "Jambon", quantity: "150g" },
      { name: "Champignons", quantity: "100g" },
    ],
  },
  {
    keywords: ["carbonara"],
    ingredients: [
      { name: "Pâtes", quantity: "400g" },
      { name: "Lardons", quantity: "200g" },
      { name: "Oeufs", quantity: "3" },
      { name: "Parmesan", quantity: "60g" },
    ],
  },
  {
    keywords: ["bolognaise", "bolognese"],
    ingredients: [
      { name: "Spaghetti", quantity: "400g" },
      { name: "Boeuf haché", quantity: "400g" },
      { name: "Sauce tomate", quantity: "300g" },
      { name: "Oignon", quantity: "1" },
      { name: "Parmesan", quantity: "50g" },
    ],
  },
  {
    keywords: ["chili con carne"],
    ingredients: [
      { name: "Boeuf haché", quantity: "400g" },
      { name: "Haricots rouges", quantity: "250g" },
      { name: "Coulis de tomate", quantity: "300g" },
      { name: "Oignon", quantity: "1" },
      { name: "Maïs", quantity: "150g" },
      { name: "Riz", quantity: "200g" },
    ],
  },
  {
    keywords: ["burger"],
    ingredients: [
      { name: "Pains burger", quantity: "2" },
      { name: "Steak haché", quantity: "2" },
      { name: "Cheddar", quantity: "2 tranches" },
      { name: "Tomates", quantity: "1" },
      { name: "Salade", quantity: "quelques feuilles" },
    ],
  },
  {
    keywords: ["dahl", "dal"],
    ingredients: [
      { name: "Lentilles corail", quantity: "300g" },
      { name: "Coulis de tomate", quantity: "200g" },
      { name: "Lait de coco", quantity: "20cl" },
      { name: "Curry", quantity: "1 c. à café" },
      { name: "Riz", quantity: "200g" },
    ],
  },
  {
    keywords: ["risotto"],
    ingredients: [
      { name: "Riz arborio", quantity: "300g" },
      { name: "Champignons", quantity: "250g" },
      { name: "Parmesan", quantity: "60g" },
      { name: "Oignon", quantity: "1" },
      { name: "Bouillon de légumes", quantity: "1 cube" },
    ],
  },
  {
    keywords: ["gratin dauphinois"],
    ingredients: [
      { name: "Pommes de terre", quantity: "600g" },
      { name: "Crème fraîche", quantity: "20cl" },
      { name: "Lait", quantity: "20cl" },
      { name: "Ail", quantity: "1 gousse" },
      { name: "Muscade", quantity: "1 pincée" },
    ],
  },
  {
    keywords: ["salade nicoise"],
    ingredients: [
      { name: "Thon en boîte", quantity: "1 boîte" },
      { name: "Oeufs", quantity: "2" },
      { name: "Haricots verts", quantity: "200g" },
      { name: "Tomates", quantity: "2" },
      { name: "Pommes de terre", quantity: "200g" },
      { name: "Olives", quantity: "50g" },
    ],
  },
  {
    keywords: ["salade cesar"],
    ingredients: [
      { name: "Poulet", quantity: "300g" },
      { name: "Laitue", quantity: "1" },
      { name: "Parmesan", quantity: "50g" },
      { name: "Croûtons", quantity: "50g" },
      { name: "Oeufs", quantity: "2" },
    ],
  },
  {
    keywords: ["croque monsieur"],
    ingredients: [
      { name: "Pain de mie", quantity: "8 tranches" },
      { name: "Jambon", quantity: "4 tranches" },
      { name: "Emmental râpé", quantity: "100g" },
      { name: "Beurre", quantity: "30g" },
    ],
  },
  {
    keywords: ["ratatouille"],
    ingredients: [
      { name: "Courgettes", quantity: "2" },
      { name: "Aubergines", quantity: "1" },
      { name: "Poivrons", quantity: "2" },
      { name: "Tomates", quantity: "3" },
      { name: "Oignon", quantity: "1" },
      { name: "Huile d'olive", quantity: "2 c. à soupe" },
    ],
  },
  {
    keywords: ["soupe de legumes", "veloute de legumes", "potage de legumes"],
    ingredients: [
      { name: "Carottes", quantity: "3" },
      { name: "Poireaux", quantity: "2" },
      { name: "Pommes de terre", quantity: "2" },
      { name: "Courgettes", quantity: "1" },
      { name: "Bouillon de légumes", quantity: "1 cube" },
    ],
  },
]

const CULINARY_FAMILIES: {
  family: string
  keywords: string[]
  ingredients: { name: string; quantity: string }[]
}[] = [
  {
    family: "wok",
    keywords: ["wok", "saute asiatique"],
    ingredients: [
      { name: "Nouilles", quantity: "300g" },
      { name: "Légumes croquants", quantity: "300g" },
      { name: "Sauce soja", quantity: "2 c. à soupe" },
      { name: "Ail", quantity: "1 gousse" },
      { name: "Huile de sésame", quantity: "1 c. à soupe" },
    ],
  },
  {
    family: "curry",
    keywords: ["curry", "colombo", "massale"],
    ingredients: [
      { name: "Poulet ou Protéine", quantity: "350g" },
      { name: "Riz basmati", quantity: "300g" },
      { name: "Lait de coco", quantity: "20cl" },
      { name: "Poudre de curry", quantity: "1 c. à café" },
      { name: "Oignon", quantity: "1" },
    ],
  },
  {
    family: "pates",
    keywords: ["pate", "spaghetti", "coquillette", "penne", "tagliatelle", "macaroni"],
    ingredients: [
      { name: "Pâtes", quantity: "400g" },
      { name: "Sauce tomate", quantity: "200g" },
      { name: "Parmesan", quantity: "50g" },
      { name: "Oignon", quantity: "1" },
      { name: "Huile d'olive", quantity: "1 c. à soupe" },
    ],
  },
  {
    family: "riz",
    keywords: ["riz"],
    ingredients: [
      { name: "Riz", quantity: "300g" },
      { name: "Légumes variés", quantity: "300g" },
      { name: "Oignon", quantity: "1" },
      { name: "Huile d'olive", quantity: "1 c. à soupe" },
    ],
  },
  {
    family: "salade",
    keywords: ["salade"],
    ingredients: [
      { name: "Salade verte", quantity: "1" },
      { name: "Tomates", quantity: "2" },
      { name: "Concombre", quantity: "1" },
      { name: "Vinaigrette", quantity: "2 c. à soupe" },
    ],
  },
  {
    family: "soupe",
    keywords: ["soupe", "veloute", "potage", "bouillon"],
    ingredients: [
      { name: "Carottes", quantity: "3" },
      { name: "Poireaux", quantity: "2" },
      { name: "Pommes de terre", quantity: "2" },
      { name: "Crème fraîche", quantity: "10cl" },
    ],
  },
  {
    family: "tarte_quiche",
    keywords: ["quiche", "tarte", "tourte"],
    ingredients: [
      { name: "Pâte brisée", quantity: "1" },
      { name: "Oeufs", quantity: "3" },
      { name: "Crème fraîche", quantity: "20cl" },
      { name: "Emmental râpé", quantity: "100g" },
    ],
  },
  {
    family: "gratin",
    keywords: ["gratin"],
    ingredients: [
      { name: "Pommes de terre", quantity: "600g" },
      { name: "Crème fraîche", quantity: "20cl" },
      { name: "Emmental râpé", quantity: "100g" },
      { name: "Ail", quantity: "1 gousse" },
    ],
  },
  {
    family: "pizza",
    keywords: ["pizza"],
    ingredients: [
      { name: "Pâte à pizza", quantity: "1" },
      { name: "Sauce tomate", quantity: "200g" },
      { name: "Mozzarella", quantity: "150g" },
      { name: "Origan", quantity: "1 pincée" },
    ],
  },
  {
    family: "burger",
    keywords: ["burger"],
    ingredients: [
      { name: "Pains burger", quantity: "2" },
      { name: "Steak haché", quantity: "2" },
      { name: "Cheddar", quantity: "2 tranches" },
      { name: "Tomates", quantity: "1" },
    ],
  },
  {
    family: "poisson",
    keywords: ["saumon", "cabillaud", "colin", "poisson", "thon", "crevette"],
    ingredients: [
      { name: "Filet de poisson", quantity: "400g" },
      { name: "Riz", quantity: "250g" },
      { name: "Courgettes", quantity: "2" },
      { name: "Citron", quantity: "1" },
      { name: "Huile d'olive", quantity: "1 c. à soupe" },
    ],
  },
  {
    family: "volaille",
    keywords: ["poulet", "dinde", "volaille"],
    ingredients: [
      { name: "Filets de volaille", quantity: "400g" },
      { name: "Pommes de terre", quantity: "400g" },
      { name: "Haricots verts", quantity: "300g" },
      { name: "Beurre", quantity: "20g" },
    ],
  },
  {
    family: "viande",
    keywords: ["boeuf", "steak", "porc", "viande", "veau"],
    ingredients: [
      { name: "Viande", quantity: "400g" },
      { name: "Féculent", quantity: "300g" },
      { name: "Légumes", quantity: "200g" },
      { name: "Oignon", quantity: "1" },
    ],
  },
  {
    family: "oeufs",
    keywords: ["oeuf", "omelette"],
    ingredients: [
      { name: "Oeufs", quantity: "4" },
      { name: "Beurre", quantity: "20g" },
      { name: "Salade verte", quantity: "1" },
      { name: "Pain", quantity: "quelques tranches" },
    ],
  },
  {
    family: "wrap",
    keywords: ["wrap", "fajita", "burrito", "taco"],
    ingredients: [
      { name: "Galettes wrap", quantity: "4" },
      { name: "Poulet", quantity: "200g" },
      { name: "Tomates", quantity: "2" },
      { name: "Salade", quantity: "quelques feuilles" },
      { name: "Sauce au yaourt", quantity: "4 c. à soupe" },
    ],
  },
]

/**
 * Génère une recette par défaut équilibrée pour un nom de plat donné.
 */
export function getDefaultRecipeForDish(dishName: string): ExtractedIngredient[] {
  const norm = normalizeName(dishName)
  if (!norm) return []

  // 1. Recherche dans les recettes classiques précises
  for (const classic of CLASSIC_DISH_RECIPES) {
    if (classic.keywords.some((kw) => norm.includes(kw))) {
      return classic.ingredients.map((ing) => toExtractedIngredient(ing.name, ing.quantity))
    }
  }

  // 2. Recherche par correspondance dans STAPLE_MEALS (auto-planner)
  for (const staple of STAPLE_MEALS) {
    const stapleNorm = normalizeName(staple.name)
    if (norm.includes(stapleNorm) || stapleNorm.includes(norm)) {
      return staple.ingredients.map((ing) => toExtractedIngredient(ing))
    }
  }

  // 3. Recherche par famille culinaire lexicale
  for (const fam of CULINARY_FAMILIES) {
    if (fam.keywords.some((kw) => norm.includes(kw))) {
      return fam.ingredients.map((ing) => toExtractedIngredient(ing.name, ing.quantity))
    }
  }

  // 4. Base équilibrée par défaut
  return [
    toExtractedIngredient("Protéine au choix", "350g"),
    toExtractedIngredient("Féculent (riz ou pâtes)", "300g"),
    toExtractedIngredient("Légumes de saison", "300g"),
    toExtractedIngredient("Huile d'olive", "2 c. à soupe"),
  ]
}

/**
 * Nettoie le nom d'un plat extrait d'un planning ou d'une liste.
 */
export function cleanDishName(rawName: string): string {
  let s = rawName.trim()
  s = s.replace(
    /^(?:[-*•+–—\s\d.)\]]*)(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+(?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter))?|(?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter))\s*[:\-–—.]\s*/i,
    ""
  )
  s = s.replace(/^(?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter)\s*[:\-–—.]\s*/i, "")
  s = s.replace(/^[-*•+–—\s\d.)\]]+/, "")
  s = s.replace(/\s*\((?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter|reste|rapide)\)\s*$/i, "")
  s = s.replace(/[.:;!]+$/, "").trim()
  return displayName(s)
}

const HEADER_LINE_REGEX =
  /^(?:planning|menu|programme|repas|id[eé]es?\s+de\s+repas|semaine|liste\s+de\s+plats?)(?:\s+(?:de\s+la\s+semaine|semaine|\d+))?\s*:?$/i

const DAY_PREFIX_LINE_REGEX =
  /^(?:[-*•+–—\s\d.)\]]*)(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+(?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter))?|(?:midi|soir|d[eé]jeuner|d[iî]ner|matin|go[uû]ter))\s*[:\-–—.]\s*(.+)$/i

const PLAT_MARKER_REGEX =
  /^(?:={2,}\s*)?PLAT\s*:\s*([^\n=]+?)(?:\s*={2,})?$/i

function parseSingleRecipe(
  rawText: string,
  source?: "url" | "text" | "json-ld" | "image"
): ExtractedRecipe {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { title: "", ingredients: [], detailedIngredients: [], source: source ?? "text" }
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
  const detailedIngredients: ExtractedIngredient[] = []
  const seenNorms = new Set<string>()

  for (const raw of rawIngredients) {
    const parsedList = parseIngredientLine(raw)
    if (parsedList.length === 0) continue

    for (const parsed of parsedList) {
      const norm = normalizeName(parsed.name)
      // Éviter les lignes parasites qui sont des phrases d'instructions
      if (norm.length > 60 || norm.includes("melanger") || norm.includes("verser")) {
        continue
      }

      if (!seenNorms.has(norm)) {
        seenNorms.add(norm)
        cleaned.push(parsed.name)
        detailedIngredients.push(parsed)
      }
    }
  }

  return {
    title: title ? displayName(title) : "Nouvelle recette",
    ingredients: cleaned,
    detailedIngredients,
    source: source ?? "text",
  }
}

/**
 * Détecte si le texte représente une recette unique ou une liste/planning de plats,
 * et extrait chaque plat avec ses ingrédients réels ou par défaut.
 */
export function extractMealsFromText(
  rawText: string,
  source?: "url" | "text" | "json-ld" | "image"
): ExtractedMealBatch {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      kind: "single",
      meals: [{ title: "", ingredients: [], detailedIngredients: [], source: source ?? "text" }],
      source: source ?? "text",
    }
  }

  const lines = rawText.split(/\r?\n/)

  // Heuristique 1 : Marqueurs multi-plats explicites (=== PLAT : [Nom] === ou PLAT : [Nom])
  const platMarkerCount = lines.filter((l) => PLAT_MARKER_REGEX.test(l.trim())).length
  if (platMarkerCount > 0) {
    const mealBlocks: { title: string; lines: string[] }[] = []
    let currentBlock: { title: string; lines: string[] } | null = null

    for (const line of lines) {
      const m = line.trim().match(PLAT_MARKER_REGEX)
      if (m) {
        if (currentBlock) mealBlocks.push(currentBlock)
        currentBlock = { title: cleanDishName(m[1]), lines: [] }
      } else if (currentBlock) {
        currentBlock.lines.push(line)
      }
    }
    if (currentBlock) mealBlocks.push(currentBlock)

    if (mealBlocks.length > 0) {
      const meals: ExtractedRecipe[] = []
      const seenTitles = new Set<string>()

      for (const block of mealBlocks) {
        const norm = normalizeName(block.title)
        if (!norm || seenTitles.has(norm)) continue
        seenTitles.add(norm)

        const blockText = block.lines.join("\n").trim()
        const parsed = blockText ? parseSingleRecipe(blockText, source) : null
        if (parsed && parsed.detailedIngredients.length > 0) {
          meals.push({
            title: block.title,
            ingredients: parsed.ingredients,
            detailedIngredients: parsed.detailedIngredients,
            isDefaultRecipe: false,
            source: source ?? "text",
          })
        } else {
          const defaultIngs = getDefaultRecipeForDish(block.title)
          meals.push({
            title: block.title,
            ingredients: defaultIngs.map((i) => i.name),
            detailedIngredients: defaultIngs,
            isDefaultRecipe: true,
            source: source ?? "text",
          })
        }
      }

      if (meals.length > 0) {
        return {
          kind: meals.length > 1 ? "list" : "single",
          meals,
          source: source ?? "text",
        }
      }
    }
  }

  // Heuristique 2 : Lignes commençant par des jours de la semaine ou créneaux
  const dayLinesCount = lines.filter((l) => DAY_PREFIX_LINE_REGEX.test(l.trim())).length
  if (dayLinesCount >= 2) {
    const meals: ExtractedRecipe[] = []
    const seenTitles = new Set<string>()

     for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || HEADER_LINE_REGEX.test(trimmedLine)) continue

      const match = trimmedLine.match(DAY_PREFIX_LINE_REGEX)
      if (match) {
        const dishName = cleanDishName(match[2])
        if (dishName.length < 2) continue
        const norm = normalizeName(dishName)
        if (seenTitles.has(norm)) continue
        seenTitles.add(norm)

        const defaultIngs = getDefaultRecipeForDish(dishName)
        meals.push({
          title: dishName,
          ingredients: defaultIngs.map((i) => i.name),
          detailedIngredients: defaultIngs,
          isDefaultRecipe: true,
          source: source ?? "text",
        })
      }
    }

    if (meals.length > 0) {
      return {
        kind: meals.length > 1 ? "list" : "single",
        meals,
        source: source ?? "text",
      }
    }
  }

  // Heuristique 3 : Liste à puces ou numérotée de plats sans en-tête d'ingrédients
  const hasIngredientHeader = lines.some((l) => /^ingr[eé]dients?\b/i.test(l.trim()))
  if (!hasIngredientHeader) {
    const nonInstructionLines = lines.filter((l) => {
      const t = l.trim()
      if (!t || HEADER_LINE_REGEX.test(t)) return false
      if (/^(pr[eé]paration|[eé]tapes?|instructions?|cuisson)\b/i.test(t)) return false
      return t.length >= 3 && t.length <= 80 && !t.includes(". ")
    })
    // Vérifier si une des lignes ressemble à une liste d'ingrédients séparés par des virgules
    const hasCommaIngredientsLine = nonInstructionLines.some((l) => {
      if (!l.includes(",")) return false
      const parts = l.split(",")
      return (
        parts.length >= 3 ||
        parts.some((p) => extractIngredientQuantity(p.trim()) !== undefined)
      )
    })

    const allHaveBullets =
      nonInstructionLines.length >= 2 &&
      nonInstructionLines.every((l) => /^[-*•+–—\d.)\]]/.test(l.trim()))

    if (
      !hasCommaIngredientsLine &&
      (allHaveBullets || nonInstructionLines.length >= 3)
    ) {
      let qtyCount = 0
      for (const line of nonInstructionLines) {
        if (extractIngredientQuantity(line) !== undefined) {
          qtyCount++
        }
      }

      if (qtyCount / nonInstructionLines.length < 0.35) {
        const meals: ExtractedRecipe[] = []
        const seenTitles = new Set<string>()

        for (const line of nonInstructionLines) {
          const dishName = cleanDishName(line)
          if (dishName.length < 2) continue
          const norm = normalizeName(dishName)
          if (seenTitles.has(norm)) continue
          seenTitles.add(norm)

          const defaultIngs = getDefaultRecipeForDish(dishName)
          meals.push({
            title: dishName,
            ingredients: defaultIngs.map((i) => i.name),
            detailedIngredients: defaultIngs,
            isDefaultRecipe: true,
            source: source ?? "text",
          })
        }

        if (meals.length > 0) {
          return {
            kind: meals.length > 1 ? "list" : "single",
            meals,
            source: source ?? "text",
          }
        }
      }
    }
  }

  // Plat unique
  const single = parseSingleRecipe(rawText, source)
  if (single.detailedIngredients.length === 0 && single.title && single.title !== "Nouvelle recette") {
    const defaultIngs = getDefaultRecipeForDish(single.title)
    single.detailedIngredients = defaultIngs
    single.ingredients = defaultIngs.map((i) => i.name)
    single.isDefaultRecipe = true
  } else {
    single.isDefaultRecipe = false
  }

  return {
    kind: "single",
    meals: [single],
    source: source ?? "text",
  }
}

/**
 * Extrait le titre et les ingrédients d'un texte libre de recette (rétrocompatibilité).
 */
export function extractRecipeFromText(rawText: string): ExtractedRecipe {
  const batch = extractMealsFromText(rawText)
  return batch.meals[0] || { title: "", ingredients: [], detailedIngredients: [], source: "text" }
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
        const detailedIngs: ExtractedIngredient[] = []
        const seenNorms = new Set<string>()

        for (const raw of rawIngs) {
          const parsedList = parseIngredientLine(raw)
          for (const parsed of parsedList) {
            const norm = normalizeName(parsed.name)
            if (!seenNorms.has(norm)) {
              seenNorms.add(norm)
              cleanedIngs.push(parsed.name)
              detailedIngs.push(parsed)
            }
          }
        }

        if (title && cleanedIngs.length > 0) {
          return {
            title: displayName(title),
            ingredients: cleanedIngs,
            detailedIngredients: detailedIngs,
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
    detailedIngredients: parsed.detailedIngredients,
    source: "url",
  }
}
