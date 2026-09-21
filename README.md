# PlanifIA

PWA de planning repas : déjeuner et dîner, semaine après semaine.

Chaque compte Google a son propre espace. Les repas, courses et semaines restent isolés par `auth.uid()` (RLS).

## Connexion Google (gratuit)

Tout le flux tient dans l’offre gratuite : **Google Cloud** (OAuth) + **Supabase Free**.

Pas de mot de passe stocké, pas de secret Google dans l’app. Seule la **clé publique** Supabase est dans Next.js. Le *client secret* Google reste dans le tableau de bord Supabase.

### 1. Projet Supabase

1. Crée un projet Free (région `eu-west-1` ou `eu-central-1`).
2. Exécute dans l’éditeur SQL, dans l’ordre : `001_init.sql`, `002_families.sql`, puis `003_fix_family_rls.sql` (si `002` a déjà été appliqué avant le correctif RLS).
3. **Authentication → URL Configuration**
   - Site URL : `http://localhost:3000` (puis ton domaine en prod)
   - Redirect URLs : `http://localhost:3000/auth/callback` et `https://ton-domaine/auth/callback`
4. Copie **Project URL** et **Publishable/anon key** (jamais la `service_role`).

### 2. Client OAuth Google

1. [Google Cloud Console](https://console.cloud.google.com/) → nouveau projet.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform)
   - User type : **External**
   - App name : PlanifIA
   - Scopes : `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` uniquement
   - En **Testing**, ajoute ton Gmail dans *Test users* (100 utilisateurs, gratuit). Publier l’app est gratuit pour ces scopes.
3. **Clients → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins : `http://localhost:3000` (et `https://ton-domaine`)
   - Authorized redirect URIs : `https://<ref-projet>.supabase.co/auth/v1/callback`
     (copie l’URL exacte depuis **Supabase → Authentication → Providers → Google**)
4. Enregistre le **Client ID** et le **Client secret**.

### 3. Brancher Google dans Supabase

1. **Authentication → Providers → Google** : Enabled
2. Colle Client ID et Client secret
3. Laisse le *Skip nonce check* **désactivé**

### 4. Variables d’environnement

Copie `.env.example` vers `.env.local` :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEV_AUTH_BYPASS=
```

En production, `NEXT_PUBLIC_APP_URL` doit être l’origine HTTPS publique (`https://ton-domaine`). Laisse `DEV_AUTH_BYPASS` vide : le compte local n’existe pas en prod.

```bash
pnpm install
pnpm dev
```

Ouvre http://localhost:3000 → **Continuer avec Google**.

## Sécurité du flux

- OAuth **PKCE** : le vérificateur est posé en cookie HttpOnly côté serveur (`/auth/google`), échangé dans `/auth/callback`. Aucun token dans l’URL.
- Redirection limitée aux chemins internes (`/semaine`, …).
- Session dans des cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production. Le proxy vérifie le JWT avec `getClaims()` à chaque requête.
- RLS : un utilisateur ne lit et n’écrit que ses lignes.
- Déconnexion : `signOut({ scope: "global" })` révoque les refresh tokens.
- En-têtes : `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

## Mode développement (sans Google)

`DEV_AUTH_BYPASS=1` dans `.env.local` affiche **Continuer en mode développement**. Compte `dev@planifia.local`, données dans `.data/dev-store.json`. Ignoré dès que `NODE_ENV=production`.

## Plusieurs comptes

La page **Compte** affiche l’e-mail réel du compte connecté (Google, lien magique ou `dev@planifia.local`).

**Ajouter un compte Google** lance un nouvel OAuth (`prompt=select_account`) sans jeter les comptes déjà mémorisés sur l’appareil. Chaque identité Google a son propre espace repas / semaine / courses (RLS).

La liste locale (e-mail, nom, photo) est un cookie HttpOnly. Le jeton de session de chaque compte est stocké à part, aussi en HttpOnly, pour basculer sans retaper Google. S’il est expiré, PlanifIA relance Google avec `login_hint`.

**Déconnexion** quitte seulement le compte actuel et passe au suivant s’il y en a un. **Tout déconnecter** vide la liste de l’appareil.

