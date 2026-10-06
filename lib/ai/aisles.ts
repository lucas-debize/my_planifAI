export type AisleKey =
  | "fruits_legumes"
  | "boulangerie"
  | "frais_cremerie"
  | "boucherie_poissonnerie"
  | "epicerie_salee"
  | "epicerie_sucree"
  | "surgeles"
  | "boissons"
  | "entretien_hygiene"
  | "autre"

export type AisleInfo = {
  key: AisleKey
  label: string
  icon: string
  order: number
}

export const AISLES: Record<AisleKey, AisleInfo> = {
  fruits_legumes: {
    key: "fruits_legumes",
    label: "Fruits & Légumes",
    icon: "🥬",
    order: 1,
  },
  boulangerie: {
    key: "boulangerie",
    label: "Boulangerie & Pains",
    icon: "🥖",
    order: 2,
  },
  frais_cremerie: {
    key: "frais_cremerie",
    label: "Frais & Produits laitiers",
    icon: "🧀",
    order: 3,
  },
  boucherie_poissonnerie: {
    key: "boucherie_poissonnerie",
    label: "Boucherie & Poissonnerie",
    icon: "🥩",
    order: 4,
  },
  epicerie_salee: {
    key: "epicerie_salee",
    label: "Épicerie salée",
    icon: "🍝",
    order: 5,
  },
  epicerie_sucree: {
    key: "epicerie_sucree",
    label: "Épicerie sucrée",
    icon: "🍫",
    order: 6,
  },
  surgeles: {
    key: "surgeles",
    label: "Surgelés",
    icon: "❄️",
    order: 7,
  },
  boissons: {
    key: "boissons",
    label: "Boissons",
    icon: "🧃",
    order: 8,
  },
  entretien_hygiene: {
    key: "entretien_hygiene",
    label: "Entretien & Hygiène",
    icon: "🧼",
    order: 9,
  },
  autre: {
    key: "autre",
    label: "Autre / Divers",
    icon: "📦",
    order: 10,
  },
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Patterns culinaires par rayon
const PATTERNS: { key: AisleKey; keywords: string[] }[] = [
  {
    key: "surgeles",
    keywords: [
      "glace vanille",
      "glace chocolat",
      "creme glacee",
      "surgele",
      "surgeles",
      "surgelee",
      "surgelees",
      "glace",
      "glaces",
      "sorbet",
      "sorbets",
      "esquimau",
      "cone glace",
    ],
  },
  {
    key: "boissons",
    keywords: [
      "eau gazeuse",
      "eau plate",
      "eau minerale",
      "jus de",
      "jus d",
      "soda",
      "cola",
      "coca",
      "limonade",
      "sirop",
      "biere",
      "vin blanc",
      "vin rouge",
      "vin rose",
      "cidre",
      "champagne",
      "ice tea",
      "tonic",
    ],
  },
  {
    key: "entretien_hygiene",
    keywords: [
      "liquide vaisselle",
      "eponge",
      "essuie tout",
      "sopalin",
      "papier toilette",
      "papier wc",
      "sac poubelle",
      "dentifrice",
      "savon",
      "shampoing",
      "gel douche",
      "lessive",
      "adoucissant",
      "desinfectant",
      "javel",
      "nettoyant",
    ],
  },
  {
    key: "boulangerie",
    keywords: [
      "baguette",
      "pain",
      "pains",
      "pain de mie",
      "pain complet",
      "pain burger",
      "brioche",
      "croissant",
      "pain au chocolat",
      "chocolatine",
      "viennoiserie",
      "pate feuilletee",
      "pate brisee",
      "pate sablee",
      "tortilla",
      "tortillas",
      "fajita",
      "wrap",
      "wraps",
      "pita",
      "naan",
      "focaccia",
      "ciabatta",
      "biscotte",
      "pain pita",
    ],
  },
  {
    key: "boucherie_poissonnerie",
    keywords: [
      "poulet",
      "boeuf",
      "porc",
      "veau",
      "agneau",
      "dinde",
      "canard",
      "lapin",
      "steak",
      "hache",
      "viande",
      "viandes",
      "escalope",
      "cotelette",
      "cote de",
      "roti",
      "filet mignon",
      "cuisse de",
      "blanc de poulet",
      "aiguillette",
      "jambon",
      "lardon",
      "lardons",
      "bacon",
      "saucisse",
      "saucisses",
      "merguez",
      "chipolata",
      "chorizo",
      "saucisson",
      "charcuterie",
      "boudin",
      "pate de campagne",
      "saumon",
      "thon",
      "cabillaud",
      "colin",
      "lieu",
      "bar",
      "daurade",
      "truite",
      "sole",
      "morue",
      "sardine",
      "sardines",
      "maquereau",
      "anchois",
      "crevette",
      "crevettes",
      "gambas",
      "moule",
      "moules",
      "saint jacques",
      "coquille",
      "calamar",
      "calamars",
      "poulpe",
      "seiche",
      "fruits de mer",
      "crabe",
      "surimi",
      "poisson",
      "poissons",
      "pave de",
    ],
  },
  {
    key: "frais_cremerie",
    keywords: [
      "oeuf",
      "oeufs",
      "lait",
      "beurre",
      "creme",
      "creme fraiche",
      "creme liquide",
      "yaourt",
      "yaourts",
      "fromage",
      "fromages",
      "emmental",
      "gruyere",
      "parmesan",
      "mozzarella",
      "chevre",
      "crottin",
      "feta",
      "ricotta",
      "mascarpone",
      "comte",
      "reblochon",
      "raclette",
      "brie",
      "camembert",
      "roquefort",
      "gorgonzola",
      "cheddar",
      "gouda",
      "cantal",
      "saint nectaire",
      "fromage blanc",
      "faisselle",
      "tofu",
      "maroilles",
      "parmigiano",
      "pecorino",
      "burrata",
      "chèvre",
    ],
  },
  {
    key: "fruits_legumes",
    keywords: [
      "tomate",
      "tomates",
      "courgette",
      "courgettes",
      "carotte",
      "carottes",
      "oignon",
      "oignons",
      "echalote",
      "echalotes",
      "ail",
      "gousse d ail",
      "poireau",
      "poireaux",
      "pomme de terre",
      "pommes de terre",
      "patate",
      "patates",
      "patate douce",
      "avocat",
      "avocats",
      "salade",
      "laitue",
      "mache",
      "roquette",
      "epinard",
      "epinards",
      "poivron",
      "poivrons",
      "concombre",
      "concombres",
      "aubergine",
      "aubergines",
      "brocoli",
      "brocolis",
      "chou",
      "choux",
      "chou fleur",
      "champignon",
      "champignons",
      "cepe",
      "cepes",
      "persil",
      "coriandre",
      "ciboulette",
      "basilic",
      "menthe",
      "aneth",
      "estragon",
      "cerfeuil",
      "citron",
      "citrons",
      "lime",
      "orange",
      "oranges",
      "banane",
      "bananes",
      "pomme",
      "pommes",
      "poire",
      "poires",
      "fraise",
      "fraises",
      "framboise",
      "framboises",
      "myrtille",
      "myrtilles",
      "raisin",
      "raisins",
      "melon",
      "pasteque",
      "mangue",
      "ananas",
      "peche",
      "peches",
      "abricot",
      "abricots",
      "prune",
      "prunes",
      "cerise",
      "cerises",
      "gingembre",
      "radis",
      "navet",
      "navets",
      "celeri",
      "fenouil",
      "haricot vert",
      "haricots verts",
      "petits pois",
      "asperge",
      "asperges",
      "artichaut",
      "potiron",
      "courge",
      "butternut",
      "potimarron",
      "panais",
      "betterave",
      "endive",
      "endives",
      "mais doux",
      "legumes",
      "fruits",
      "clementine",
      "mandarine",
      "kiwi",
      "pamplemousse",
    ],
  },
  {
    key: "epicerie_sucree",
    keywords: [
      "sucre",
      "cassonade",
      "miel",
      "confiture",
      "nutella",
      "pate a tartiner",
      "chocolat",
      "chocolat noir",
      "chocolat au lait",
      "cacao",
      "vanille",
      "extrait de vanille",
      "sucre vanille",
      "levure chimique",
      "levure de boulanger",
      "poudre d amande",
      "amandes",
      "noix",
      "noisettes",
      "pepites de chocolat",
      "biscuit",
      "biscuits",
      "speculoos",
      "cereales",
      "muesli",
      "flocons d avoine",
      "sirop d erable",
      "compote",
      "pate d amande",
      "caramel",
      "cafe",
      "the",
      "tisane",
    ],
  },
  {
    key: "epicerie_salee",
    keywords: [
      "pate",
      "pates",
      "spaghetti",
      "tagliatelle",
      "coquillette",
      "penne",
      "fusilli",
      "riz",
      "riz basmati",
      "riz thai",
      "semoule",
      "quinoa",
      "lentille",
      "lentilles",
      "pois chiche",
      "pois chiches",
      "haricot rouge",
      "haricots blancs",
      "farine",
      "huile",
      "huile d olive",
      "huile de tournesol",
      "vinaigre",
      "vinaigre balsamique",
      "sel",
      "poivre",
      "moutarde",
      "mayonnaise",
      "ketchup",
      "sauce tomate",
      "sauce pesto",
      "pesto",
      "coulis de tomate",
      "concentre de tomate",
      "sauce soja",
      "curry",
      "cumin",
      "paprika",
      "curcuma",
      "piment",
      "origan",
      "thym",
      "laurier",
      "herbes de provence",
      "bouillon",
      "cube bouillon",
      "fond de veau",
      "olive",
      "olives",
      "capres",
      "cornichon",
      "cornichons",
      "conserve",
      "thon en boite",
      "noix de cajou",
      "cacahuete",
      "chips",
      "croutons",
    ],
  },
]

// Index ordonné par spécificité décroissante (les expressions de plusieurs mots en premier)
const SORTED_PATTERNS: { keyword: string; key: AisleKey; wordCount: number }[] = []
for (const group of PATTERNS) {
  for (const keyword of group.keywords) {
    const wordCount = keyword.split(" ").length
    SORTED_PATTERNS.push({ keyword, key: group.key, wordCount })
  }
}
SORTED_PATTERNS.sort((a, b) => {
  if (b.wordCount !== a.wordCount) return b.wordCount - a.wordCount
  return b.keyword.length - a.keyword.length
})

/**
 * Classifie un ingrédient en fonction de son nom vers le rayon approprié.
 * Algorithme local instantané (0 ms, 0 limite, 100% hors-ligne).
 */
export function categorizeIngredient(name: string): AisleInfo {
  const norm = normalizeForMatching(name)
  if (!norm) return AISLES.autre

  const tokens = norm.split(" ")

  // 1. Passe exacte ou expressions multi-mots spécifiques d'abord
  for (const item of SORTED_PATTERNS) {
    if (item.wordCount > 1) {
      if (norm === item.keyword || norm.includes(item.keyword)) {
        return AISLES[item.key]
      }
    } else {
      if (norm === item.keyword) {
        return AISLES[item.key]
      }
      if (tokens.includes(item.keyword)) {
        return AISLES[item.key]
      }
    }
  }

  // 2. Seconde passe : recherche d'inclusion souple
  for (const item of SORTED_PATTERNS) {
    if (item.keyword.length >= 4 && norm.includes(item.keyword)) {
      return AISLES[item.key]
    }
  }

  return AISLES.autre
}

export type CategorizedAisleGroup<T> = {
  aisle: AisleInfo
  items: T[]
}

/**
 * Regroupe une liste d'éléments possédant un nom vers des groupes par rayon,
 * ordonnés selon le parcours logique du supermarché.
 */
export function groupItemsByAisle<T extends { name: string }>(
  items: T[]
): CategorizedAisleGroup<T>[] {
  const map = new Map<AisleKey, T[]>()

  for (const item of items) {
    const aisle = categorizeIngredient(item.name)
    const current = map.get(aisle.key) ?? []
    current.push(item)
    map.set(aisle.key, current)
  }

  const result: CategorizedAisleGroup<T>[] = []
  const sortedAisles = Object.values(AISLES).sort((a, b) => a.order - b.order)

  for (const aisle of sortedAisles) {
    const groupItems = map.get(aisle.key)
    if (groupItems && groupItems.length > 0) {
      result.push({
        aisle,
        items: groupItems,
      })
    }
  }

  return result
}
