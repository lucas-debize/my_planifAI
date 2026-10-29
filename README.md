# MyPlanifAI

PWA de planning repas : déjeuner et dîner, semaine après semaine.

Chaque compte Google a son propre espace. Les repas, courses et semaines restent isolés par `auth.uid()` (RLS Supabase).

---

## Déploiement en production 24/24 (Gratuit - 0,00 €)

L'application tourne gratuitement 24h/24 sans mise en veille :
- **Hébergement Frontend / SSR / PDF** : Vercel Hobby (0 €)
- **Base de données & Authentification** : Supabase Free Tier (0 €)
- **Authentification** : Google Cloud OAuth (0 €)
- **Maintien actif 24/24 (Anti-pause Supabase)** : GitHub Actions Cron (0 €)

---

### Étape 1 : Base de données Supabase (5 min)

1. Crée un projet gratuit sur [supabase.com](https://supabase.com) (choisis `eu-central-1` Francfort ou `eu-west-1` Londres).
2. Ouvre le **SQL Editor** dans le tableau de bord Supabase et exécute les scripts de `supabase/migrations/` (ou `full_setup.sql`) :
   - `001_init.sql` (tables repas, créneaux, courses, profils, RLS)
   - `002_families.sql` (gestion des familles et partages)
   - `003_fix_family_rls.sql` (politiques RLS affinées)
   - `004_separate_personal_and_family.sql` (séparation planning perso/famille, limite 10 membres)
   *(Ou directement via le terminal avec la commande : `npx supabase db push`)*
   - **Project URL** (`https://<id-projet>.supabase.co`)
   - **anon public key** (`sb_publishable_...` ou clé `anon`)
   *(Ne partage jamais la clé `service_role`)*.

---

### Étape 2 : Google Cloud OAuth (5 min)

1. Rends-toi sur la [Google Cloud Console](https://console.cloud.google.com/) et crée un nouveau projet (ex: *MyPlanifAI*).
2. Va dans **APIs & Services → OAuth consent screen** :
   - User Type : **External**
  - Nom de l'application : `MyPlanifAI`
   - Scopes demandés : `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - En phase de test, ajoute tes adresses Gmail dans **Test users** (ou publie l'écran, gratuit pour ces 3 scopes standards).
3. Va dans **APIs & Services → Credentials → Create Credentials → OAuth client ID** :
   - Application type : **Web application**
  - Nom : `MyPlanifAI Web`
   - **Authorized redirect URIs** :
     `https://<id-projet>.supabase.co/auth/v1/callback`
     *(trouvable aussi dans Supabase → Authentication → Providers → Google)*
4. Copie le **Client ID** et le **Client secret**.
5. Dans **Supabase → Authentication → Providers → Google** :
   - Active Google (**Enable**)
   - Colle le **Client ID** et le **Client secret**
   - Laisse *Skip nonce check* désactivé et enregistre.

---

### Étape 3 : Déploiement sur Vercel (3 min)

1. Connecte-toi sur [vercel.com](https://vercel.com) avec ton compte GitHub.
2. Clique sur **Add New Project** et sélectionne le dépôt `PlanifIA`.
3. Dans la section **Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<id-projet>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `<clé-anon-supabase>`
   - `NEXT_PUBLIC_APP_URL` = `https://myplanifai.vercel.app`
4. Clique sur **Deploy**.
5. Une fois le déploiement terminé, finalise les URLs de redirection :
   - Dans **Supabase → Authentication → URL Configuration** :
     - **Site URL** : `https://<nom-de-ton-projet>.vercel.app`
     - **Redirect URLs** : `https://<nom-de-ton-projet>.vercel.app/auth/callback`
   - Dans **Google Cloud Console → Credentials → ton client OAuth** :
     - **Authorized JavaScript origins** : ajoute `https://<nom-de-ton-projet>.vercel.app`

---

### Étape 4 : Activer le Keepalive 24/24 (Anti-veille Supabase)

Supabase Free met automatiquement en veille les projets inactifs après 7 jours sans requête. Le dépôt inclut un workflow GitHub Actions (`.github/workflows/supabase-keepalive.yml`) qui envoie une requête authentifiée tous les 3 jours :

1. Sur ton dépôt GitHub, va dans **Settings → Secrets and variables → Actions**.
2. Clique sur **New repository secret** et ajoute :
   - `SUPABASE_URL` : l'URL de ton projet Supabase (`https://<id-projet>.supabase.co`)
   - `SUPABASE_ANON_KEY` : la clé publique anon de ton projet Supabase
3. Dans l'onglet **Actions** de GitHub, vérifie que le workflow *Supabase Keepalive* est activé. Tu peux déclencher un run de test manuel avec le bouton **Run workflow**.

---

### Étape 5 : Route de diagnostic et Monitoring (`/api/health`)

L'application expose un endpoint public de santé :
- URL : `https://myplanifai.vercel.app/api/health`
- Réponse JSON :
  ```json
  {
    "status": "ok",
    "timestamp": "2025-05-10T12:00:00.000Z",
    "database": "connected"
  }
  ```
Cet endpoint peut aussi être interrogé par un service gratuit tiers (ex: [cron-job.org](https://cron-job.org) ou [UptimeRobot](https://uptimerobot.com)) pour une double garantie de disponibilité.

---

## Configurer l'import photo de planning

Ajoute `GEMINI_API_KEY` dans les variables serveur Vercel, puis redéploie l'application. Ne préfixe pas cette clé par `NEXT_PUBLIC_`.
Le scanner appelle `gemini-2.5-flash`, avec la réflexion désactivée. La présence d'une clé ne garantit ni quota disponible ni disponibilité du service Google.

Le navigateur optimise la photo en JPEG, puis l'envoie à `/api/ai/scan-image`. Le serveur retranscrit les jours et les repas.
Il accepte uniquement une réponse finale complète et ignore les blocs de réflexion. Le traitement des fournisseurs est borné à 45 secondes.
Le client ne relance pas l'analyse par une server action ou un OCR après un échec.

La transcription est ensuite affectée aux dates à partir du début de semaine choisi. Un second samedi en fin de photo ne remplace pas le premier.
Les cases vides restent vides. Vérifie les propositions avant de les appliquer, notamment les lignes barrées et les accompagnements.
Les ingrédients proposés pour un nouveau plat viennent des recettes par défaut de l'application, pas de la photo.

La reconnaissance manuscrite utilise une API distante. Elle n'est ni entièrement locale ni garantie exacte.
Sans clé Vision, l'import photo affiche une erreur explicite. L'onglet texte reste utilisable sans API.
Les conditions de gratuité et les limites dépendent du [projet Google AI Studio](https://aistudio.google.com/).

Pour vérifier les vraies photos sur une instance, sans simuler l'IA :

```bash
bun scripts/verify-planning-scan.ts https://myplanifai.vercel.app photo1.png photo2.png photo3.png
```

Le script affiche les délais, les erreurs HTTP et les créneaux datés. Il conserve les réponses dans `.data/scan-verification/`, exclu de Git.
Son contrôle de complétude attend sept jours et au moins treize créneaux. Compare aussi les noms et les créneaux à la photo : un statut `PASS` ne mesure pas la fidélité de la transcription.

## Développement local

1. Copie `.env.example` vers `.env.local` :
   ```bash
   cp .env.example .env.local
   ```
2. Remplis les variables Supabase ou utilise le mode hors-ligne :
   ```bash
   DEV_AUTH_BYPASS=1
   ```
3. Installe les dépendances et démarre le serveur de développement :
   ```bash
   pnpm install
   pnpm dev
   ```
4. Ouvre [http://localhost:3000](http://localhost:3000).

---

## Sécurité du flux

- OAuth **PKCE** : le vérificateur est posé en cookie HttpOnly côté serveur (`/auth/google`), échangé dans `/auth/callback`. Aucun token dans l’URL.
- Redirection limitée aux chemins internes (`/semaine`, …).
- Session dans des cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production. Le proxy vérifie le JWT avec `getClaims()` à chaque requête.
- RLS : un utilisateur ne lit et n’écrit que ses lignes.
- Déconnexion : `signOut({ scope: "global" })` révoque les refresh tokens.
- En-têtes : `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Plusieurs comptes

La page **Compte** affiche l’e-mail réel du compte connecté (Google, lien magique ou `dev@planifia.local`).

**Ajouter un compte Google** lance un nouvel OAuth (`prompt=select_account`) sans jeter les comptes déjà mémorisés sur l’appareil. Chaque identité Google a son propre espace repas / semaine / courses (RLS).

La liste locale (e-mail, nom, photo) est un cookie HttpOnly. Le jeton de session de chaque compte est stocké à part, aussi en HttpOnly, pour basculer sans retaper Google. S’il est expiré, MyPlanifAI relance Google avec `login_hint`.

**Déconnexion** quitte seulement le compte actuel et passe au suivant s’il y en a un. **Tout déconnecter** vide la liste de l’appareil.
