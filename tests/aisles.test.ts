import { describe, it, expect } from "bun:test"
import { categorizeIngredient, groupItemsByAisle } from "@/lib/ai/aisles"

describe("Classification par rayon (AI / Heuristiques locales)", () => {
  describe("Fruits & Légumes", () => {
    it("classifie correctement les fruits, légumes et aromates frais", () => {
      expect(categorizeIngredient("Tomates grappe").key).toBe("fruits_legumes")
      expect(categorizeIngredient("3 courgettes").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Gousse d'ail").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Persil frais").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Pommes Golden").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Poireaux").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Avocat mûr").key).toBe("fruits_legumes")
      expect(categorizeIngredient("Oignons jaunes").key).toBe("fruits_legumes")
    })
  })

  describe("Boucherie & Poissonnerie", () => {
    it("classifie les viandes, poissons et crustacés", () => {
      expect(categorizeIngredient("Blanc de poulet").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Pavé de saumon").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Steak haché 5%").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Lardons fumés").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Crevettes décortiquées").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Jambon blanc").key).toBe("boucherie_poissonnerie")
      expect(categorizeIngredient("Cabillaud").key).toBe("boucherie_poissonnerie")
    })
  })

  describe("Frais & Produits laitiers", () => {
    it("classifie les crèmes, beurres, fromages et oeufs", () => {
      expect(categorizeIngredient("Crème fraîche épaisse").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Parmesan râpé").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Mozzarella di bufala").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Oeufs frais").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Beurre doux").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Lait demi-écrémé").key).toBe("frais_cremerie")
      expect(categorizeIngredient("Fromage de chèvre").key).toBe("frais_cremerie")
    })
  })

  describe("Boulangerie & Pains", () => {
    it("classifie les pains, pâtes à tarte et viennoiseries", () => {
      expect(categorizeIngredient("Pâte feuilletée pur beurre").key).toBe("boulangerie")
      expect(categorizeIngredient("Baguette tradition").key).toBe("boulangerie")
      expect(categorizeIngredient("Pain de mie complet").key).toBe("boulangerie")
      expect(categorizeIngredient("Tortillas de blé").key).toBe("boulangerie")
      expect(categorizeIngredient("Brioche tranchée").key).toBe("boulangerie")
    })
  })

  describe("Épicerie salée & Épicerie sucrée", () => {
    it("classifie l'épicerie salée", () => {
      expect(categorizeIngredient("Spaghetti n°5").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Riz basmati").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Huile d'olive extra vierge").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Curry doux moulu").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Sel fin").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Moutarde de Dijon").key).toBe("epicerie_salee")
    })

    it("classifie l'épicerie sucrée", () => {
      expect(categorizeIngredient("Chocolat noir pâtissier").key).toBe("epicerie_sucree")
      expect(categorizeIngredient("Sucre en poudre").key).toBe("epicerie_sucree")
      expect(categorizeIngredient("Miel de fleurs").key).toBe("epicerie_sucree")
      expect(categorizeIngredient("Confiture de fraises").key).toBe("epicerie_sucree")
      expect(categorizeIngredient("Cacao non sucré").key).toBe("epicerie_sucree")
    })
  })

  describe("Surgelés, Boissons & Hygiène", () => {
    it("classifie les surgelés, boissons et articles d'entretien", () => {
      expect(categorizeIngredient("Glace vanille").key).toBe("surgeles")
      expect(categorizeIngredient("Eau gazeuse").key).toBe("boissons")
      expect(categorizeIngredient("Liquide vaisselle citron").key).toBe("entretien_hygiene")
      expect(categorizeIngredient("Essuie-tout").key).toBe("entretien_hygiene")
    })
  })

  describe("Heuristique Longest Match First (Priorité aux expressions composées)", () => {
    it("donne priorité aux sauces et préparations sur les ingrédients bruts", () => {
      // "sauce tomate" doit aller en épicerie salée, pas en fruits & légumes
      expect(categorizeIngredient("Sauce tomate basilic").key).toBe("epicerie_salee")
      expect(categorizeIngredient("Coulis de tomate").key).toBe("epicerie_salee")

      // "jus de citron" doit aller en boissons, pas en fruits & légumes
      expect(categorizeIngredient("Jus de citron").key).toBe("boissons")

      // "pâte feuilletée" doit aller en boulangerie, pas en pâtes (épicerie)
      expect(categorizeIngredient("Pâte feuilletée").key).toBe("boulangerie")

      // "glace chocolat" doit aller en surgelés, pas en chocolat (épicerie sucrée)
      expect(categorizeIngredient("Glace chocolat").key).toBe("surgeles")
    })
  })

  describe("groupItemsByAisle", () => {
    it("regroupe les articles selon l'ordre du parcours supermarché", () => {
      const items = [
        { name: "Chocolat noir", id: "1" },
        { name: "Pommes", id: "2" },
        { name: "Steak haché", id: "3" },
        { name: "Mozzarella", id: "4" },
        { name: "Pâtes", id: "5" },
      ]

      const grouped = groupItemsByAisle(items)

      expect(grouped.length).toBe(5)
      // Ordre logique du supermarché
      expect(grouped[0].aisle.key).toBe("fruits_legumes")
      expect(grouped[1].aisle.key).toBe("frais_cremerie")
      expect(grouped[2].aisle.key).toBe("boucherie_poissonnerie")
      expect(grouped[3].aisle.key).toBe("epicerie_salee")
      expect(grouped[4].aisle.key).toBe("epicerie_sucree")

      // Contenu du groupe
      expect(grouped[0].items.map((i) => i.name)).toEqual(["Pommes"])
      expect(grouped[1].items.map((i) => i.name)).toEqual(["Mozzarella"])
    })

    it("gère une liste vide", () => {
      expect(groupItemsByAisle([])).toEqual([])
    })
  })
})
