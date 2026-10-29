import { describe, it, expect } from "bun:test"
import {
  cleanIngredientName,
  extractIngredientQuantity,
  parseIngredientLine,
  extractRecipeFromText,
  extractRecipeFromHtml,
  extractMealsFromText,
  getDefaultRecipeForDish,
  cleanDishName,
  normalizeDayLines,
  parsePlanningToWeekSlots,
  isOcrGibberish,
} from "@/lib/ai/recipe-extractor"

describe("Import magique de recette (NLP & Extraction locale)", () => {
  describe("cleanIngredientName", () => {
    it("nettoie les puces et numérotations", () => {
      expect(cleanIngredientName("- Tomates")).toBe("Tomates")
      expect(cleanIngredientName("* Courgettes")).toBe("Courgettes")
      expect(cleanIngredientName("1. Pommes")).toBe("Pommes")
      expect(cleanIngredientName("• Carottes")).toBe("Carottes")
    })

    it("nettoie les quantités et unités françaises courantes", () => {
      expect(cleanIngredientName("200g de farine de blé")).toBe("Farine de blé")
      expect(cleanIngredientName("250 g de sucre")).toBe("Sucre")
      expect(cleanIngredientName("1 kg de pommes de terre")).toBe("Pommes de terre")
      expect(cleanIngredientName("20 cl de lait")).toBe("Lait")
      expect(cleanIngredientName("2 c. à soupe d'huile d'olive")).toBe("Huile d'olive")
      expect(cleanIngredientName("1 cuillère à café de sel")).toBe("Sel")
      expect(cleanIngredientName("3 gousses d'ail")).toBe("Ail")
      expect(cleanIngredientName("1 pincée de fleur de sel")).toBe("Fleur de sel")
      expect(cleanIngredientName("1 boîte de pulpe de tomates")).toBe("Pulpe de tomates")
      expect(cleanIngredientName("4 tranches de jambon")).toBe("Jambon")
    })

    it("gère les fractions et approximations", () => {
      expect(cleanIngredientName("1/2 oignon")).toBe("Oignon")
      expect(cleanIngredientName("un demi citron")).toBe("Citron")
      expect(cleanIngredientName("quelques feuilles de basilic")).toBe("Basilic")
    })

    it("nettoie les qualificatifs d'état et de découpe", () => {
      expect(cleanIngredientName("3 belles courgettes bien mûres, coupées en dés")).toBe("Courgettes")
      expect(cleanIngredientName("1 oignon émincé")).toBe("Oignon")
      expect(cleanIngredientName("100g de parmesan râpé")).toBe("Parmesan")
      expect(cleanIngredientName("2 gousses d'ail hachées")).toBe("Ail")
      expect(cleanIngredientName("beurre fondu")).toBe("Beurre")
    })

    it("préserve les noms d'ingrédients composés", () => {
      expect(cleanIngredientName("Crème fraîche")).toBe("Crème fraîche")
      expect(cleanIngredientName("Pâte feuilletée")).toBe("Pâte feuilletée")
      expect(cleanIngredientName("Lait de coco")).toBe("Lait de coco")
      expect(cleanIngredientName("Fromage de chèvre")).toBe("Fromage de chèvre")
    })

    it("supprime les annotations entre parenthèses", () => {
      expect(cleanIngredientName("4 filets de poulet (environ 500g)")).toBe("Filets de poulet")
      expect(cleanIngredientName("Piment d'Espelette (facultatif)")).toBe("Piment d'Espelette")
    })
  })

  describe("extractIngredientQuantity & parseIngredientLine", () => {
    it("détecte les quantités numériques, unités et fractions", () => {
      expect(extractIngredientQuantity("200g de farine")).toBe("200g")
      expect(extractIngredientQuantity("3 oeufs")).toBe("3")
      expect(extractIngredientQuantity("20 cl de crème")).toBe("20 cl")
      expect(extractIngredientQuantity("2 cuillères à soupe d'huile")).toBe("2 c. à soupe")
      expect(extractIngredientQuantity("un demi citron")).toBe("1/2")
      expect(extractIngredientQuantity("1 pincée de sel")).toBe("1 pincée")
      expect(extractIngredientQuantity("Carottes")).toBe(undefined)
    })

    it("structure l'ingrédient avec nom et quantité", () => {
      const parsed = parseIngredientLine("200g de chèvre")
      expect(parsed.length).toBe(1)
      expect(parsed[0].name).toBe("Chèvre")
      expect(parsed[0].quantity).toBe("200g")
    })
  })

  describe("extractRecipeFromText", () => {
    it("extrait une recette structurée avec sections", () => {
      const text = `
Recette de la Tarte aux poireaux
Ingrédients :
- 3 poireaux émincés
- 200g de chèvre
- 3 oeufs
- 20cl de crème fraîche
- 1 pâte brisée
- Sel et poivre

Préparation :
Faire suer les poireaux dans une poêle...
      `

      const extracted = extractRecipeFromText(text)
      expect(extracted.title).toBe("Tarte aux poireaux")
      expect(extracted.ingredients).toContain("Poireaux")
      expect(extracted.ingredients).toContain("Chèvre")
      expect(extracted.ingredients).toContain("Oeufs")
      expect(extracted.ingredients).toContain("Crème fraîche")
      expect(extracted.ingredients).toContain("Pâte brisée")
      expect(extracted.ingredients).toContain("Sel")
      expect(extracted.ingredients).toContain("Poivre")
      expect(extracted.ingredients).not.toContain("Faire suer les poireaux")
      expect(extracted.detailedIngredients.find((i) => i.name === "Poireaux")?.quantity).toBe("3")
      expect(extracted.detailedIngredients.find((i) => i.name === "Chèvre")?.quantity).toBe("200g")
      expect(extracted.detailedIngredients.find((i) => i.name === "Crème fraîche")?.quantity).toBe("20cl")
    })
    it("extrait un mémo rapide sans section explicite", () => {
      const text = `
Pâtes carbonara rapides
Pâtes tagliatelles, 150g de lardons, 3 jaunes d'oeufs, parmesan râpé
      `

      const extracted = extractRecipeFromText(text)
      expect(extracted.title).toBe("Pâtes carbonara rapides")
      expect(extracted.ingredients).toContain("Pâtes tagliatelles")
      expect(extracted.ingredients).toContain("Lardons")
      expect(extracted.ingredients).toContain("Jaunes d'oeufs")
      expect(extracted.ingredients).toContain("Parmesan")
    })

    it("gère une liste d'ingrédients isolée", () => {
      const text = `
- 2 escalopes de dinde
- 1 poivron rouge
- 1 oignon
- 200g de riz basmati
      `

      const extracted = extractRecipeFromText(text)
      expect(extracted.ingredients.length).toBe(4)
      expect(extracted.ingredients).toContain("Escalopes de dinde")
      expect(extracted.ingredients).toContain("Poivron rouge")
      expect(extracted.ingredients).toContain("Oignon")
      expect(extracted.ingredients).toContain("Riz basmati")
    })
  })

  describe("extractRecipeFromHtml", () => {
    it("extrait fidèlement les métadonnées JSON-LD Schema.org/Recipe", () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Lasagnes maison à la bolognaise",
    "recipeIngredient": [
      "500g de boeuf haché",
      "1 boîte de coulis de tomate",
      "12 plaques de lasagnes",
      "100g de parmesan râpé"
    ]
  }
  </script>
</head>
<body><h1>Lasagnes</h1></body>
</html>
      `

      const extracted = extractRecipeFromHtml(html)
      expect(extracted.source).toBe("json-ld")
      expect(extracted.ingredients).toEqual([
        "Boeuf",
        "Coulis de tomate",
        "Plaques de lasagnes",
        "Parmesan",
      ])
    })

    it("gère les architectures JSON-LD complexes avec @graph", () => {
      const html = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "MonBlog" },
    {
      "@type": "Recipe",
      "name": "Curry de pois chiches",
      "recipeIngredient": ["400g de pois chiches", "20cl de lait de coco", "1 c. à soupe de curry"]
    }
  ]
}
</script>
      `

      const extracted = extractRecipeFromHtml(html)
      expect(extracted.source).toBe("json-ld")
      expect(extracted.title).toBe("Curry de pois chiches")
      expect(extracted.ingredients).toContain("Pois chiches")
      expect(extracted.ingredients).toContain("Lait de coco")
      expect(extracted.ingredients).toContain("Curry")
    })

    it("bascule vers OpenGraph / balises meta si aucun JSON-LD n'est présent", () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Recette Tarte aux fraises facile - Marmiton" />
</head>
<body>
  <h2>Ingrédients</h2>
  <p>- 500g de fraises fraîches</p>
  <p>- 1 pâte sablée</p>
  <p>- 250g de crème pâtissière</p>
</body>
</html>
      `

      const extracted = extractRecipeFromHtml(html)
      expect(extracted.title).toBe("Tarte aux fraises facile")
      expect(extracted.ingredients).toContain("Fraises")
      expect(extracted.ingredients).toContain("Pâte sablée")
      expect(extracted.ingredients).toContain("Crème pâtissière")
    })
  })

  describe("getDefaultRecipeForDish", () => {
    it("retourne une recette cohérente pour Lasagnes contenant pâtes à lasagnes, boeuf haché et sauce tomate", () => {
      const ingredients = getDefaultRecipeForDish("Lasagnes")
      expect(ingredients.length > 0).toBe(true)
      const names = ingredients.map((i) => i.name.toLowerCase())
      expect(names.some((n) => n.includes("lasagne"))).toBe(true)
      expect(names.some((n) => n.includes("boeuf"))).toBe(true)
      expect(names.some((n) => n.includes("tomate"))).toBe(true)
      for (const ing of ingredients) {
        expect(ing.quantity !== undefined).toBe(true)
        expect(ing.raw !== undefined).toBe(true)
      }
    })

    it("retourne une recette cohérente pour Quiche lorraine contenant pâte brisée, lardons, oeufs et crème", () => {
      const ingredients = getDefaultRecipeForDish("Quiche lorraine")
      expect(ingredients.length > 0).toBe(true)
      const names = ingredients.map((i) => i.name.toLowerCase())
      expect(names.some((n) => n.includes("pâte brisée") || n.includes("pate brisee"))).toBe(true)
      expect(names.some((n) => n.includes("lardon"))).toBe(true)
      expect(names.some((n) => n.includes("oeuf"))).toBe(true)
      expect(names.some((n) => n.includes("crème") || n.includes("creme"))).toBe(true)
    })

    it("attribue une base équilibrée pour un plat inconnu (ex: Wok exotique)", () => {
      const ingredients = getDefaultRecipeForDish("Wok exotique")
      expect(ingredients.length >= 3).toBe(true)
      const names = ingredients.map((i) => i.name.toLowerCase())
      expect(names.some((n) => n.includes("nouille") || n.includes("légume") || n.includes("soja"))).toBe(true)
    })
  })

  describe("extractMealsFromText", () => {
    it("gère un plat unique avec recette complète intacte", () => {
      const text = `Tarte aux poireaux
Ingrédients :
- 3 poireaux
- 200g de chèvre
- 3 oeufs
- 20cl de crème
- 1 pâte brisée`

      const batch = extractMealsFromText(text)
      expect(batch.kind).toBe("single")
      expect(batch.meals.length).toBe(1)
      const recipe = batch.meals[0]
      expect(recipe.title).toBe("Tarte aux poireaux")
      expect(recipe.isDefaultRecipe).toBe(false)
      expect(recipe.detailedIngredients.length).toBe(5)
      expect(recipe.detailedIngredients.find((i) => i.name === "Poireaux")?.quantity).toBe("3")
      expect(recipe.detailedIngredients.find((i) => i.name === "Chèvre")?.quantity).toBe("200g")
      expect(recipe.detailedIngredients.find((i) => i.name === "Oeufs")?.quantity).toBe("3")
      expect(recipe.detailedIngredients.find((i) => i.name === "Crème")?.quantity).toBe("20cl")
      expect(recipe.detailedIngredients.find((i) => i.name === "Pâte brisée")?.quantity).toBe("1")
    })

    it("détecte un planning de la semaine avec jours et associe des recettes par défaut", () => {
      const text = `Planning de la semaine
Lundi : Lasagnes maison
Mardi : Salade de chèvre chaud
Mercredi : Quiche lorraine
Jeudi : Poulet rôti et haricots verts
Vendredi : Pizza maison`

      const batch = extractMealsFromText(text)
      expect(batch.kind).toBe("list")
      expect(batch.meals.length).toBe(5)
      expect(batch.meals.map((m) => m.title)).toEqual([
        "Lasagnes maison",
        "Salade de chèvre chaud",
        "Quiche lorraine",
        "Poulet rôti et haricots verts",
        "Pizza maison",
      ])
      for (const meal of batch.meals) {
        expect(meal.isDefaultRecipe).toBe(true)
        expect(meal.detailedIngredients.length > 0).toBe(true)
        expect(meal.ingredients.length > 0).toBe(true)
      }
    })

    it("détecte un planning avec créneaux midi/soir et nettoie les préfixes", () => {
      const text = `Lundi midi : Steak haché purée
Lundi soir : Soupe de légumes
Mardi midi : Pâtes au pesto`

      const batch = extractMealsFromText(text)
      expect(batch.kind).toBe("list")
      expect(batch.meals.length).toBe(3)
      expect(batch.meals.map((m) => m.title)).toEqual([
        "Steak haché purée",
        "Soupe de légumes",
        "Pâtes au pesto",
      ])
      for (const meal of batch.meals) {
        expect(meal.isDefaultRecipe).toBe(true)
        expect(meal.detailedIngredients.length > 0).toBe(true)
      }
    })

    it("gère les marqueurs multi-plats explicites de la vision IA", () => {
      const text = `=== PLAT : Lasagnes maison ===
Ingrédients :
- 300g pâtes à lasagnes
- 400g boeuf haché

=== PLAT : Quiche lorraine ===
Ingrédients :
- 1 pâte brisée
- 200g lardons`

      const batch = extractMealsFromText(text)
      expect(batch.kind).toBe("list")
      expect(batch.meals.length).toBe(2)
      expect(batch.meals[0].title).toBe("Lasagnes maison")
      expect(batch.meals[0].isDefaultRecipe).toBe(false)
      expect(batch.meals[0].detailedIngredients.length).toBe(2)
      expect(batch.meals[1].title).toBe("Quiche lorraine")
      expect(batch.meals[1].isDefaultRecipe).toBe(false)
      expect(batch.meals[1].detailedIngredients.length).toBe(2)
      expect(batch.meals[0].detailedIngredients.map((i) => i.quantity)).toEqual(["300g", "400g"])
      expect(batch.meals[1].detailedIngredients.map((i) => i.quantity)).toEqual(["1", "200g"])
    })

    it("attribue une recette par défaut pour un plat unique sans ingrédients", () => {
      const text = "Lasagnes maison"
      const batch = extractMealsFromText(text)
      expect(batch.kind).toBe("single")
      expect(batch.meals.length).toBe(1)
      expect(batch.meals[0].title).toBe("Lasagnes maison")
      expect(batch.meals[0].isDefaultRecipe).toBe(true)
      expect(batch.meals[0].detailedIngredients.length > 0).toBe(true)
    })

    it("détecte un planning avec jours sur des lignes séparées", () => {
      const text = `LUNDI MIDI
Poulet rôti
MARDI SOIR
Salade César
MERCREDI
Quiche lorraine`
      const batch = extractMealsFromText(text, "image")
      expect(batch.kind).toBe("list")
      expect(batch.meals.length).toBe(3)
      expect(batch.meals[0].title).toBe("Poulet rôti")
      expect(batch.meals[1].title).toBe("Salade César")
      expect(batch.meals[2].title).toBe("Quiche lorraine")
    })
    it("isole les ingrédients des blocs PLAT d'une section récapitulatif ou planning", () => {
      const text = `=== PLAT : Courgette viande hachée pâtes ===
Ingrédients :
- 2 courgettes
- 500g viande hachée

=== PLAT : Poisson à la bordelaise ===
Ingrédients :
- 4 filets de cabillaud
- 3 poireaux

---
**Récapitulatif du planning :**
• **Lundi** midi : Courgette viande hachée pâtes | soir : Poisson à la bordelaise
• **Mardi** midi : Pâtes au jambon | soir : Steak haricots

*Bon appétit !*`

      const batch = extractMealsFromText(text, "image")
      expect(batch.kind).toBe("list")
      const poisson = batch.meals.find((m) => m.title === "Poisson à la bordelaise")
      expect(poisson).toBeDefined()
      expect(poisson?.detailedIngredients.length).toBe(2)
      expect(poisson?.detailedIngredients.map((i) => i.name)).toEqual([
        "Filets de cabillaud",
        "Poireaux",
      ])
      // Vérifie que les plats du planning hors bloc sont aussi capturés
      const patesJambon = batch.meals.find((m) => m.title === "Pâtes au jambon")
      expect(patesJambon).toBeDefined()
      expect(patesJambon?.isDefaultRecipe).toBe(true)
    })

    it("ignore les phrases d'introduction sans supprimer les vrais noms de plats", () => {
      const text = `Let's look at the sequence.
Here is the meal plan:
Voici les plats reconnus :
Repas
- Repas de fête
- Menu végétarien
- Soupe de légumes`

      const batch = extractMealsFromText(text, "text", "list")
      expect(batch.meals.map((meal) => meal.title)).toEqual([
        "Repas de fête",
        "Menu végétarien",
        "Soupe de légumes",
      ])
    })

    it("ne transforme pas le préambule d'une recette unique en plat", () => {
      const batch = extractMealsFromText("Voici la recette reconnue :\nLasagnes maison")
      expect(batch.meals.map((meal) => meal.title)).toEqual(["Lasagnes maison"])
    })
  })

  describe("cleanDishName", () => {
    it("nettoie le markdown, les puces et les annotations", () => {
      expect(cleanDishName("**Courgette viande hachée pâtes**")).toBe(
        "Courgette viande hachée pâtes"
      )
      expect(cleanDishName("• Courgette viande hachée pâtes,")).toBe(
        "Courgette viande hachée pâtes"
      )
      expect(cleanDishName("Cake / Frite *(lecture : Farte)*")).toBe("Cake / Frite")
      expect(cleanDishName("Reste (« Roste »)")).toBe("Reste")
      expect(cleanDishName("rete")).toBe("Reste")
      expect(cleanDishName("*(non renseigné)*")).toBe("")
      expect(cleanDishName("Invité(e)")).toBe("")
      expect(cleanDishName("Lundi midi : Salade")).toBe("Salade")
    })
  })

  describe("normalizeDayLines", () => {
    it("découpe les lignes composées et associe les créneaux", () => {
      const lines = [
        "• **Lundi** midi : Pâtes | soir : Salade",
        "### **Mardi**",
        "Midi : Quiche",
        "Soir : Soupe",
      ]
      const normalized = normalizeDayLines(lines)
      expect(normalized).toEqual([
        "lundi midi : Pâtes",
        "lundi soir : Salade",
        "mardi midi : Quiche",
        "mardi soir : Soupe",
      ])
    })

    it("préserve les blocs PLAT et leurs ingrédients après un jour de planning", () => {
      const lines = [
        "Lundi midi : Salade",
        "=== PLAT : Quiche lorraine ===",
        "Ingrédients :",
        "- 1 pâte brisée",
        "- 200g lardons",
        "---",
        "Récapitulatif du planning :",
      ]
      expect(normalizeDayLines(lines)).toEqual([
        "lundi midi : Salade",
        ...lines.slice(1),
      ])
    })
  })

  describe("isOcrGibberish & Sécurisation de l'OCR", () => {
    it("détecte le charabia de lettres et symboles aléatoires issus d'un OCR défaillant", () => {
      const gibberish = `æ }, E. . 3\n: ports = KFONNnc0 Pi\n? - pa 9 az\nÄ E >U`
      expect(isOcrGibberish(gibberish)).toBe(true)
    })

    it("valide les textes culinaires normaux", () => {
      const good = `Samedi - Haricot vert / Poisson\n- Panini\nDimanche - Bon steak / Patate`
      expect(isOcrGibberish(good)).toBe(false)
    })

    it("rejette le charabia OCR dans extractMealsFromText au lieu de créer une fausse recette", () => {
      const gibberish = `æ }, E. . 3\n: ports = KFONNnc0 Pi\n? - pa 9 az\nÄ E >U`
      expect(() => extractMealsFromText(gibberish, "image")).toThrow(
        "L'écriture manuscrite sur cette photo n'a pas pu être reconnue"
      )
    })

    it("extrait une liste de plats simples en mode planning forcé", () => {
      const dishes = `Haricot vert / Poisson\nPanini\nBon steak / Patate\nNems / Riz cantonais\nCorne de boeuf / Tartiflette`
      const batch = extractMealsFromText(dishes, "text", "list")
      expect(batch.kind).toBe("list")
      expect(batch.meals.length).toBe(5)
      expect(batch.meals.map((m) => m.title)).toEqual([
        "Haricot vert / Poisson",
        "Panini",
        "Bon steak / Patate",
        "Nems / Riz cantonais",
        "Corne de boeuf / Tartiflette",
      ])
    })
  })

  describe("parsePlanningToWeekSlots - Support des photos de plannings réels", () => {
    const mondayIso = "2026-10-26"

    it("respecte les jours réels d'une semaine commençant le samedi", () => {
      const text = `Samedi - Haricot vert / Poisson
- Panini
Dimanche - Steak / Patate
- Nems / Riz cantonais
Lundi - Reste
- Tartiflette`

      expect(parsePlanningToWeekSlots(text, "2026-10-31")).toEqual([
        { date: "2026-10-31", kind: "dejeuner", mealName: "Haricot vert / Poisson" },
        { date: "2026-10-31", kind: "diner", mealName: "Panini" },
        { date: "2026-11-01", kind: "dejeuner", mealName: "Steak / Patate" },
        { date: "2026-11-01", kind: "diner", mealName: "Nems / Riz cantonais" },
        { date: "2026-11-02", kind: "dejeuner", mealName: "Reste" },
        { date: "2026-11-02", kind: "diner", mealName: "Tartiflette" },
      ])
    })

    it("place le lundi après le week-end dans la semaine suivante", () => {
      const text = `Samedi midi : Salade
Samedi soir : Pizza
Dimanche midi : Poisson
Lundi midi : Reste
Lundi soir : Tartiflette
Vendredi soir : Tacos`

      expect(parsePlanningToWeekSlots(text, "2026-10-26")).toEqual([
        { date: "2026-10-31", kind: "dejeuner", mealName: "Salade" },
        { date: "2026-10-31", kind: "diner", mealName: "Pizza" },
        { date: "2026-11-01", kind: "dejeuner", mealName: "Poisson" },
        { date: "2026-11-02", kind: "dejeuner", mealName: "Reste" },
        { date: "2026-11-02", kind: "diner", mealName: "Tartiflette" },
        { date: "2026-11-06", kind: "diner", mealName: "Tacos" },
      ])
    })

    it("conserve le second samedi à sa propre date sans remplir une case vide du premier", () => {
      const text = `Samedi midi : Salade
Samedi soir : non renseigné
Dimanche midi : Poisson
Vendredi soir : Tacos
Samedi midi : Pizza
Samedi soir : Panini`

      expect(parsePlanningToWeekSlots(text, "2026-10-31")).toEqual([
        { date: "2026-10-31", kind: "dejeuner", mealName: "Salade" },
        { date: "2026-11-01", kind: "dejeuner", mealName: "Poisson" },
        { date: "2026-11-06", kind: "diner", mealName: "Tacos" },
        { date: "2026-11-07", kind: "dejeuner", mealName: "Pizza" },
        { date: "2026-11-07", kind: "diner", mealName: "Panini" },
      ])
    })

    it("conserve plusieurs semaines lors du passage à une nouvelle année", () => {
      const text = `Jeudi midi : Salade
Vendredi soir : Soupe
Jeudi midi : Pizza
Vendredi soir : Quiche
Jeudi midi : Curry
Vendredi soir : Gratin
Lundi midi : Pâtes`

      expect(parsePlanningToWeekSlots(text, "2026-12-28")).toEqual([
        { date: "2026-12-31", kind: "dejeuner", mealName: "Salade" },
        { date: "2027-01-01", kind: "diner", mealName: "Soupe" },
        { date: "2027-01-07", kind: "dejeuner", mealName: "Pizza" },
        { date: "2027-01-08", kind: "diner", mealName: "Quiche" },
        { date: "2027-01-14", kind: "dejeuner", mealName: "Curry" },
        { date: "2027-01-15", kind: "diner", mealName: "Gratin" },
        { date: "2027-01-18", kind: "dejeuner", mealName: "Pâtes" },
      ])
    })

    it("fait avancer les jours vides et non renseignés sans créer de repas", () => {
      const text = `Dimanche midi :
Samedi midi : Salade
Dimanche
Samedi soir : Pizza
Dimanche soir : *(non renseigné)*
Samedi midi : Quiche`

      expect(parsePlanningToWeekSlots(text, mondayIso)).toEqual([
        { date: "2026-11-07", kind: "dejeuner", mealName: "Salade" },
        { date: "2026-11-14", kind: "diner", mealName: "Pizza" },
        { date: "2026-11-21", kind: "dejeuner", mealName: "Quiche" },
      ])
    })

    it("ne déplace pas un doublon de déjeuner vers un dîner vide", () => {
      expect(parsePlanningToWeekSlots(
        "Samedi midi : Salade\nSamedi midi : Pizza",
        "2026-10-31"
      )).toEqual([
        { date: "2026-10-31", kind: "dejeuner", mealName: "Salade" },
      ])
    })

    it("ignore le préambule et les cases vides sans créer de repas", () => {
      const text = `Let's look at the sequence.
Voici le planning :
Samedi
Here is the first day:
Midi : *(non renseigné)*
Soir : Panini
Dimanche (1) : Poisson (midi), Soupe (soir)
Lundi midi : Rien`

      expect(parsePlanningToWeekSlots(text, "2026-10-31")).toEqual([
        { date: "2026-10-31", kind: "diner", mealName: "Panini" },
        { date: "2026-11-01", kind: "dejeuner", mealName: "Poisson" },
        { date: "2026-11-01", kind: "diner", mealName: "Soupe" },
      ])
    })

    it("découpe un semainier format liste markdown avec lignes composées (Photo 1)", () => {
      const text = `• **Lundi** midi : Courgette viande hachée pâtes | soir : Poisson à la bordelaise fondue de poireaux  
• **Mardi** midi : Pâtes au jambon poireaux | soir : Steak haricots pâtes  
• **Mercredi** midi : Œufs coque champignons | soir : Tarte thon tomate  
• **Jeudi** midi : Tarte thon tomate | soir : Pizza - resto  
• **Vendredi** midi : Poulet tian provençal | soir : Poulet tian provençal  
• **Samedi** midi : Pique-nique | soir : Omelette pommes de terre  
• **Dimanche** midi : Pique-nique | soir : Saumon riz épinards`

      const slots = parsePlanningToWeekSlots(text, mondayIso)
      expect(slots.length).toBe(14)
      expect(slots[0]).toEqual({
        date: "2026-10-26",
        kind: "dejeuner",
        mealName: "Courgette viande hachée pâtes",
      })
      expect(slots[1]).toEqual({
        date: "2026-10-26",
        kind: "diner",
        mealName: "Poisson à la bordelaise fondue de poireaux",
      })
      expect(slots[12]).toEqual({
        date: "2026-11-01",
        kind: "dejeuner",
        mealName: "Pique-nique",
      })
      expect(slots[13]).toEqual({
        date: "2026-11-01",
        kind: "diner",
        mealName: "Saumon riz épinards",
      })
    })

    it("découpe un semainier manuscrit avec repas multiples sous chaque jour (Photo 2)", () => {
      const text = `Samedi - Haricot vert / Poisson .
       - Panini .
Dimanche - Bon steack / Patate .
         - Nems / Riz cantonais .
Lundi - Reste
      - Corne de boeuf / Tartiflette
Mardi - Rete
      - Steak / frite
Mercredi - Epinard saumon / oeuf
         - Pate bolo
Jeudi - Reste
      - Haricot blanc / Sauté de porc
Vendredi - Gnocci lardons .
         - Croque Monsieur / Croissant`

      const slots = parsePlanningToWeekSlots(text, mondayIso)
      expect(slots.length).toBe(14)
      // Lundi
      const lundiMidi = slots.find((s) => s.date === "2026-11-02" && s.kind === "dejeuner")
      const lundiSoir = slots.find((s) => s.date === "2026-11-02" && s.kind === "diner")
      expect(lundiMidi?.mealName).toBe("Reste")
      expect(lundiSoir?.mealName).toBe("Corne de boeuf / Tartiflette")

      // Mardi (avec typo 'Rete' corrigée en 'Reste')
      const mardiMidi = slots.find((s) => s.date === "2026-11-03" && s.kind === "dejeuner")
      const mardiSoir = slots.find((s) => s.date === "2026-11-03" && s.kind === "diner")
      expect(mardiMidi?.mealName).toBe("Reste")
      expect(mardiSoir?.mealName).toBe("Steak / frite")

      // Samedi
      const samediMidi = slots.find((s) => s.date === "2026-10-31" && s.kind === "dejeuner")
      const samediSoir = slots.find((s) => s.date === "2026-10-31" && s.kind === "diner")
      expect(samediMidi?.mealName).toBe("Haricot vert / Poisson")
      expect(samediSoir?.mealName).toBe("Panini")
    })

    it("découpe un semainier manuscrit avec puces simples par jour (Photo 3)", () => {
      const text = `Samedi
* Restes
* Pizza / cake
Dimanche
* Haricots verts / poisson
* Petit pain salé
Lundi
* Restes
* Brocoli / saucisse fumée
Mardi
* Restes
* Bourguignon porc
Mercredi
* Restes
* Hachis parmentier
Jeudi
* Restes
* Pâtes puttanesca
Vendredi
* Tacos
* Pommes noisettes steak`

      const slots = parsePlanningToWeekSlots(text, "2026-10-26")
      expect(slots.length).toBe(14)
      const lundiMidi = slots.find((s) => s.date === "2026-11-02" && s.kind === "dejeuner")
      const lundiSoir = slots.find((s) => s.date === "2026-11-02" && s.kind === "diner")
      expect(lundiMidi?.mealName).toBe("Restes")
      expect(lundiSoir?.mealName).toBe("Brocoli / saucisse fumée")

      const venMidi = slots.find((s) => s.date === "2026-11-06" && s.kind === "dejeuner")
      const venSoir = slots.find((s) => s.date === "2026-11-06" && s.kind === "diner")
      expect(venMidi?.mealName).toBe("Tacos")
      expect(venSoir?.mealName).toBe("Pommes noisettes steak")
    })

    it("découpe un semainier avec titres markdown et créneaux explicites (Photo 4)", () => {
      const text = `**Samedi midi :** Grosse salade / Tartine chèvre  
**Samedi soir :** Cake / Pizza  
**Dimanche midi :** Reste (Gnocchi)  
**Dimanche soir :** Tarte feuilletée  
**Lundi midi :** Reste  
**Lundi soir :** Pâtes Bolognaise  
**Mardi midi :** Reste  
**Mardi soir :** Petits pois / Endives  
**Mercredi midi :** Beignets de calmar / Purée / Frites  
**Mercredi soir :** Rougail saucisse  
**Jeudi midi :** Reste  
**Jeudi soir :** Steak / Frites  
**Vendredi midi :** Sandwich au thon  
**Vendredi soir :** *(non renseigné)*`

      const slots = parsePlanningToWeekSlots(text, mondayIso)
      expect(slots.length).toBe(13)
      // Ignore *(non renseigné)* pour Vendredi soir
      const vendSoir = slots.find((s) => s.date === "2026-11-06" && s.kind === "diner")
      expect(vendSoir).toBeUndefined()
      const vendMidi = slots.find((s) => s.date === "2026-11-06" && s.kind === "dejeuner")
      expect(vendMidi?.mealName).toBe("Sandwich au thon")
    })

    it("découpe un semainier sous forme de fiches journalières avec sous-listes (Photo 5)", () => {
      const text = `**LUNDI**
*   **Lundi midi : Salade**
*   **Lundi soir : Potage légumes**

**MARDI**
*   **Mardi midi : Taboulé**
*   **Mardi soir : Rôti de bœuf**

**MERCREDI**
*   **Mercredi midi : Salade verte & Saucisse**
*   **Mercredi soir : Salade verte**

**JEUDI**
*   **Jeudi midi : Restaurant**
*   **Jeudi soir : Petit Colin**

**VENDREDI**
*   **Vendredi midi : Potage**
*   **Vendredi soir : Rôti de porc au miel**

**SAMEDI**
*   **Samedi midi : Bouchées à la Reine**
*   **Samedi soir : Invité(e)**`

      const slots = parsePlanningToWeekSlots(text, mondayIso)
      expect(slots.length).toBe(11) // 12 créneaux moins Invité(e) ignoré
      const lundiMidi = slots.find((s) => s.date === "2026-10-26" && s.kind === "dejeuner")
      expect(lundiMidi?.mealName).toBe("Salade")
      const lundiSoir = slots.find((s) => s.date === "2026-10-26" && s.kind === "diner")
      expect(lundiSoir?.mealName).toBe("Potage légumes")
      const jeudiMidi = slots.find((s) => s.date === "2026-10-29" && s.kind === "dejeuner")
      expect(jeudiMidi?.mealName).toBe("Restaurant")
    })
  })
})
