# PlanifIA

PWA de planning repas : déjeuner et dîner, semaine après semaine.

## Démarrage

1. Crée un projet Supabase Free (région `eu-west-1` ou `eu-central-1`).
2. Exécute `supabase/migrations/001_init.sql` dans l’éditeur SQL.
3. Auth : Magic link seulement, confirmation e-mail désactivée, Google OAuth.
4. Copie `.env.example` vers `.env.local` et renseigne les clés.

```bash
pnpm install
pnpm dev
```

En local, `DEV_AUTH_BYPASS=1` (déjà dans `.env.local`) ouvre un compte de développement : `dev@planifia.local`. Ouvre http://localhost:3000 — pas besoin de Google ni de magic link. Les plats d’exemple (Salade chèvre, Pâtes pesto) sont dans le carnet. Les données restent dans `.data/dev-store.json`. Ce mode est ignoré en production.
