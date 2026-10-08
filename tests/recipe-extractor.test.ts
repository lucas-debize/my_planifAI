import { describe, it, expect } from "bun:test"
import {
  cleanIngredientName,
  extractIngredientQuantity,
  parseIngredientLine,
  extractRecipeFromText,
  extractRecipeFromHtml,
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
})
