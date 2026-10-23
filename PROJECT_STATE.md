# État du Projet MyPlanifAI (Octobre 2026)

Ce document conserve l'intégrité du contexte architectural, fonctionnel et technique de l'application MyPlanifAI pour assurer une continuité parfaite entre toutes les sessions et terminaux.

---

## 1. Vue d'Ensemble & Stack Technique

* **Framework** : Next.js 16 (App Router, Turbopack, React 19).
* **Langage & Typage** : TypeScript 5 strict (`tsc --noEmit`).
* **Styles & UI** : Tailwind CSS 4, Radix UI primitives, Lucide Icons, Sonner (toasts).
* **Base de données & Auth** : Supabase (PostgreSQL 15+, Row Level Security, Google OAuth PKCE).
  * **Projet Supabase lié** : `cqlbaqkovfykajwryfre` (`https://cqlbaqkovfykajwryfre.supabase.co`).
* **Hébergement Frontend** : Vercel (`https://myplanifai.vercel.app`).
* **Tests unitaires** : Bun Test (`bun test` ou `npm test`), 44 tests unitaires permanents en 60 ms.

---

## 2. Architecture & Fonctionnalités Majeures

### A. Séparation Planning Personnel vs Planning Familial (Max 10 membres)
1. **Scope actif (`PlanningScope`)** :
   * Géré par le cookie HTTP `planifia_scope` (`"personal"` ou `"family"`).
   * Fonctions clés : `getPlanningScope()`, `switchPlanningScopeAction()`, `requireScopedContext()` dans `lib/actions/session.ts` et `lib/domain/session.ts`.
   * Fallback automatique en mode personnel si l'utilisateur ne fait partie d'aucun groupe.
2. **Plafonnement à 10 membres** :
   * Bloqué au niveau SQL dans `public.join_family(invite, member_name)` avec exception `'Ce groupe a atteint la limite maximale de 10 personnes'`.
   * Affiché dans `/compte` (`components/account-panel.tsx`) avec badge `Groupe complet (10/10)` et désactivation du code d'invitation quand le groupe est plein.
3. **Plats & Anti-collision** :
   * `resolveMealCopyName(...)` : en cas d'import d'une recette personnelle vers la famille, suffixe automatique avec le prénom de l'auteur (`Tarte aux pommes (de Sophie)`).
   * Double onglet dans `MealPicker` en mode groupe (*Plats de la famille* et *Mes recettes perso* avec import et assignation transparents).
4. **Courses synchronisées** :
   * En mode groupe, les coches `shopping_checks` sont partagées en direct entre tous les membres (`family_id`).
   * En mode perso, les courses restent strictement privées (`family_id IS NULL`).

### B. Fonctionnalités IA Locales (0 € de coût, 0 quota, 0 ms de latence)
1. **Magic Fill (`lib/ai/auto-planner.ts`, `components/magic-plan-dialog.tsx`)** :
   * Sur `/semaine`, le bouton *Remplir avec l'IA* complète les créneaux vides en respectant l'équilibre nutritionnel (viande, poisson, végétarien, féculent), sans répétition et en priorisant le carnet existant.
   * Dialogue interactif avec re-roll de créneau individuel (🎲).
2. **Import Magique de Recette (`lib/ai/recipe-extractor.ts`, `components/magic-recipe-dialog.tsx`)** :
   * Sur `/idees/nouvelle`, extraction automatique du titre et des ingrédients nettoyés depuis un texte brut (mémo, livre) ou une URL web (Schema.org/Recipe JSON-LD).
3. **Courses par rayon (`lib/ai/aisles.ts`, `components/shopping-board.tsx`)** :
   * Tri automatique par rayon de supermarché (*Fruits & Légumes, Frais, Boucherie, Épicerie...*) avec algorithme NLP local *Longest Match First*.

---

## 3. Schéma Base de Données & Migrations SQL

Toutes les migrations sont stockées dans `supabase/migrations/` et synchronisées sur le projet `cqlbaqkovfykajwryfre` :
* `001_init.sql` : Tables de base (`meals`, `ingredients`, `meal_ingredients`, `plan_slots`, `shopping_checks`, triggers, RLS).
* `002_families.sql` : Tables `families`, `family_members`, fonctions de groupe.
* `003_fix_family_rls.sql` : Durcissement des fonctions `SECURITY DEFINER` et RLS.
* `004_separate_personal_and_family.sql` : Colonnes `family_id` et `created_by_user_id`, index partiels, fonction `is_family_member`, limite 10 membres dans `join_family`, et RLS unifiées.

### Commandes utiles pour la base :
* Pousser les migrations vers Supabase :
  ```bash
  npm run db:push
  ```
* Vérifier le statut des migrations distantes :
  ```bash
  npx supabase migration list --linked
  ```

---

## 4. Sécurité & RGPD

1. **Données pseudonymisées** : les utilisateurs sont uniquement identifiés par des UUID aléatoires v4 (`auth.uid()`).
2. **Aucune donnée bancaire ou mot de passe en clair** : les sessions sont gérées par Supabase Auth (tokens chiffrés, PKCE, cookies `HttpOnly`, `SameSite=Lax`, `Secure`).
3. **Row Level Security (RLS)** : activée sur 100 % des tables. Aucun utilisateur ne peut accéder aux repas ou courses d'un autre utilisateur ou d'une autre famille.
4. **Zéro secret dans le code** : les clés privées et tokens sont stockés dans `.env.local` (strictement ignoré par `.gitignore`) et dans les GitHub Secrets.
