# MyPlanifAI 🥗
> 🚀 **Live Demo:** Try the app at [myplanifai.vercel.app](https://myplanifai.vercel.app/).
> **Modern, AI-powered weekly meal planner and smart grocery list PWA.**  
> Plan lunch & dinner, scan handwritten meal schedules with vision AI, extract recipes from URLs or text, collaborate with your family, and automatically organize groceries by supermarket aisle.

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20RLS-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Bun Test](https://img.shields.io/badge/Tests-129%20Passing-success?logo=bun)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)


### Demo Video

**Full walkthrough**: Photo scan of handwritten meal schedule → AI transcription & slot assignment → Auto-categorized grocery list by supermarket aisle.

https://github.com/user-attachments/assets/20f7ae9f-f51c-45ab-a304-f01f58445851


## Highlights & Features

### 📅 Weekly Meal Planning (`/semaine`, `/aujourdhui`)
* **Dual-Slot Calendar**: Dedicated lunch and dinner slots for every day of the week, with effortless past and future week navigation.
* **Today Dashboard (`/aujourdhui`)**: Instant quick view of today's scheduled meals.
* **Leftovers ("Restes") Management**: One-click leftover assignment creating zero-ingredient placeholder meals to avoid redundant grocery items.
* **Interactive Slot Actions**: Pick meals from your catalog, swap between days, edit portions, or clear slots with instant feedback.
* **Printable A4 PDF Export**: Export your weekly schedule into an elegant, fridge-ready A4 PDF menu using `@react-pdf/renderer`.

### 👨‍👩‍👧‍👦 Personal vs Family Workspaces
* **Dual Planning Scope**: Switch seamlessly between **Personal Mode** (strictly private to your user ID) and **Family Mode** (shared group calendar).
* **Up to 10 Family Members**: Strict limit enforced both in SQL (`public.join_family`) and UI, with simple invite code sharing.
* **Live Shared Shopping List**: Synchronized checklist across all family members in real time.
* **Conflict-Free Recipe Import**: Automatically adds author attribution (e.g. `Apple Pie (by Sophie)`) when copying personal recipes into the family collection.

### 🤖 Multimodal AI & Smart Automation
* **Handwritten Meal Plan Scanner**:
  * Take a photo or upload an image of a handwritten meal calendar or white-board.
  * Powered by **Cloudflare Workers AI** (`@cf/google/gemma-4-26b-a4b-it` on 10k free daily neurons) or **Google Gemini Vision** (`gemini-3.5-flash` / `gemini-3.8-flash`), with OpenAI and GLM fallbacks.
  * Intelligent chronological multi-week parsing that preserves day sequences even across week boundaries.
  * Browser-side JPEG compression for lightning-fast uploads and minimal data usage.
  * Batch meal creation and schedule assignment in a single operation.
* **Magic Fill Auto-Planner**:
  * Automatically fills empty week slots respecting nutritional balance (alternating proteins, carbs, and vegetables), preventing repetition, and prioritizing your existing recipe catalog.
  * Interactive preview dialog with individual slot re-roll (🎲).
* **Magic Recipe Extractor**:
  * Extract title and structured ingredients from raw unstructured text, cooking notes, or web recipe links (Schema.org/Recipe JSON-LD).
  * Built-in local Tesseract.js OCR fallback for offline scanning.
* **Smart Supermarket Aisle Sorting**:
  * Automatically categorizes grocery ingredients into supermarket departments (*Produce, Dairy & Eggs, Meat & Fish, Bakery, Pantry, Frozen, Beverages, Household*).
  * Fast client-side *Longest Match First* NLP algorithm running with 0 latency, 0 API quota, and 0 external cost.

### 🔒 Privacy, Security & Multi-Account
* **Row Level Security (RLS)**: Enforced on 100% of PostgreSQL tables. Users can only view and modify their own data or their family group's data.
* **Google OAuth with PKCE**: Server-side HttpOnly cookies with CSRF state verification and PKCE exchange—no access tokens exposed in client URLs.
* **Multi-Account Vault**: Switch between multiple Google accounts on the same device without logging out.
* **Offline Dev Mode (`DEV_AUTH_BYPASS=1`)**: Fully functional offline mock account (`dev@planifia.local`) backed by a local JSON store, enabling complete development without Supabase or Google credentials.


## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict mode) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons, Sonner |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security, Google OAuth) |
| **AI Vision & NLP** | Cloudflare Workers AI (`gemma-4-26b`), Google Gemini Flash, OpenAI Vision, Local NLP |
| **PDF Generation** | [@react-pdf/renderer](https://react-pdf.org/) |
| **Testing** | [Bun Test](https://bun.sh/) (129 unit tests in ~1.5s) |
| **Hosting & CI** | [Vercel](https://vercel.com/), GitHub Actions (Automated CI, Migrations & Keepalive) |


## Architecture & Database Schema

All database migrations are located in `supabase/migrations/`:
* `001_init.sql`: Core tables (`meals`, `ingredients`, `meal_ingredients`, `plan_slots`, `shopping_checks`), triggers, and RLS policies.
* `002_families.sql`: Collaboration tables (`families`, `family_members`), membership functions, and group RLS.
* `003_fix_family_rls.sql`: Hardened `SECURITY DEFINER` functions and recursion prevention.
* `004_separate_personal_and_family.sql`: Scope separation (`family_id`, `created_by_user_id`), partial unique indexes, 10-member family cap, and unified RLS.
* `005_ingredient_quantity.sql`: Backward-compatible optional ingredient quantities for recipes.

A consolidated setup script is also available at `supabase/full_setup.sql`.


## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (>= 20.x) or [Bun](https://bun.sh/) (recommended)
* [pnpm](https://pnpm.io/) or `bun`

### 1. Clone the repository
```bash
git clone https://github.com/lucas-debize/PlanifIA.git
cd PlanifIA
```

### 2. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

For **instant local development without third-party services**, enable offline bypass mode:
```env
DEV_AUTH_BYPASS=1
```
This activates the local mock user `dev@planifia.local` using `.data/dev-store.json`.

For **full production or Supabase-connected local development**, fill in your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: AI Vision Scanning (Cloudflare or Gemini)
CLOUDFLARE_ACCOUNT_ID=your-32-char-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
# or
GEMINI_API_KEY=your-google-ai-studio-key
```

### 3. Install Dependencies
```bash
bun install
# or
pnpm install
```

### 4. Run the Development Server
```bash
bun dev
# or
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.


## 24/7 Zero-Cost Production Deployment

This project is configured to run 100% free with continuous availability:
* **Frontend & SSR**: Vercel Hobby Tier ($0/month)
* **Database & Auth**: Supabase Free Tier ($0/month)
* **OAuth**: Google Cloud Console ($0/month)
* **AI Vision**: Cloudflare Workers Free (10,000 neurons/day) or Google AI Studio Free Tier
* **Anti-Pause Keepalive**: GitHub Actions Scheduled Ping ($0/month)

### Step 1: Supabase Setup
1. Create a free project on [supabase.com](https://supabase.com).
2. Run the database migrations in order from `supabase/migrations/` (or execute `supabase/full_setup.sql` in the SQL Editor).
3. Retrieve your **Project URL** and **anon public key** from *Project Settings → API*.

### Step 2: Google Cloud OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. In **APIs & Services → OAuth consent screen**, select **External** and configure app details.
3. In **Credentials → Create Credentials → OAuth client ID**:
   * Type: **Web application**
   * **Authorized redirect URIs**: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
4. In **Supabase Dashboard → Authentication → Providers → Google**:
   * Enable Google provider.
   * Paste your **Client ID** and **Client Secret**.

### Step 3: Vercel Deployment
1. Import your repository into [Vercel](https://vercel.com).
2. Set the Environment Variables:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   * `NEXT_PUBLIC_APP_URL` (e.g. `https://myplanifai.vercel.app`)
   * *(Optional)* `CLOUDFLARE_ACCOUNT_ID` & `CLOUDFLARE_API_TOKEN` or `GEMINI_API_KEY`
3. Deploy!
4. Complete redirect URLs:
   * **Supabase → Authentication → URL Configuration**: set **Site URL** to `https://your-domain.vercel.app` and add `https://your-domain.vercel.app/auth/callback` to **Redirect URLs**.
   * **Google Cloud Console → Credentials**: add `https://your-domain.vercel.app` to **Authorized JavaScript origins**.

### Step 4: Supabase Keepalive (Preventing Inactivity Pause)
Supabase Free pauses projects after 7 days of inactivity. This repository includes `.github/workflows/supabase-keepalive.yml` which pings your database every 3 days:
1. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Add the following repository secrets:
   * `SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   * `SUPABASE_ANON_KEY`: Your Supabase anon public key
3. The keepalive workflow runs automatically every 3 days.


## Environment Variables Reference

| Variable | Required | Context | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (Prod) | Client/Server | Supabase project URL (`https://<id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes (Prod) | Client/Server | Supabase public publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | Yes (Prod) | Client/Server | Public URL used for OAuth redirects and links |
| `DEV_AUTH_BYPASS` | No | Server (Dev) | Set to `1` to bypass OAuth and use offline mock user |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | Server | 32-character Cloudflare account ID for Workers AI |
| `CLOUDFLARE_API_TOKEN` | Optional | Server | Cloudflare API token with Workers AI permissions |
| `GEMINI_API_KEY` | Optional | Server | Google AI Studio API key for Gemini Vision |
| `OPENAI_API_KEY` | Optional | Server | OpenAI API key for GPT-4o Vision |
| `GLM_API_KEY` | Optional | Server | Zhipu / GLM API key for GLM-4.5v / 5.3 Vision |


## License

MIT © [Lucas Debize](https://github.com/lucas-debize)
