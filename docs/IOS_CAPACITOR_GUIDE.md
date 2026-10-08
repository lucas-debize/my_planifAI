# Guide Technique : Déploiement de PlanifIA sur l'App Store Apple (via Capacitor)

Ce document décrit l'architecture, la faisabilité et les étapes pas-à-pas pour transformer PlanifIA en application native iOS téléchargeable directement sur l'App Store d'Apple.

---

## 1. Deux solutions pour iPhone : Comparatif

| Critère | Solution 1 : PWA (Déjà active) | Solution 2 : App Store iOS (Capacitor) |
| :--- | :--- | :--- |
| **Coût annuel** | **0 € (Totalement gratuit)** | **99 $/an (Compte Apple Developer)** |
| **Disponibilité** | Immédiate (Safari iOS → « Sur l'écran d'accueil ») | Téléchargeable sur l'App Store officiel |
| **Matériel requis** | Aucun (fonctionne sur tout smartphone) | Un Mac avec macOS et Xcode |
| **Accès Appareil Photo** | Oui (via `<input capture="environment">`) | Oui (accès caméra natif & photo picker) |
| **Mises à jour** | Instantanées dès le déploiement Vercel | Mises à jour web instantanées via WebView |
| **Validation Apple** | Aucune censure ni délai de review | Soumission et review Apple (24 à 48h) |

---

## 2. Architecture Technique avec Capacitor

**Capacitor** (développé par l'équipe Ionic) est la solution standard de l'industrie pour empaqueter une application web Next.js/React dans un conteneur natif iOS (Swift/Xcode).

```
┌────────────────────────────────────────────────────────┐
│                   App Store Apple                      │
└──────────────────────────┬─────────────────────────────┘
                           │ Téléchargement
                           ▼
┌────────────────────────────────────────────────────────┐
│             iPhone (Application Native iOS)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │               Capacitor Container                │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │            WKWebView iOS (Apple)           │  │  │
│  │  │  PlanifIA UI & Logique                     │  │  │
│  │  │  - Next.js / React 19                      │  │  │
│  │  │  - Synchronisation Supabase Temps Réel     │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  Plugins natifs :                                │  │
│  │  - @capacitor/camera (Scan recette OCR)          │  │
│  │  - @capacitor/haptics (Vibrations tactiles)      │  │
│  │  - @capacitor/status-bar (Intégration encoche)   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Prérequis exigés par Apple

1. **Compte Apple Developer Program** :
   - Inscription sur [developer.apple.com](https://developer.apple.com/).
   - Coût : **99 USD par an**.
   - Permet de créer un Bundle Identifier (ex: `com.planifia.app`) et de signer les certificats.
2. **Mac avec Xcode** :
   - macOS récent avec Xcode installé depuis le Mac App Store.
3. **Identité visuelle de l'app** :
   - Icône App Store en 1024x1024 px PNG (sans transparence).

---

## 4. Procédure de mise en place (Quand le compte Apple sera souscrit)

### Étape 1 : Installer Capacitor dans le projet

Dans le terminal du projet :

```bash
bun add @capacitor/core @capacitor/cli @capacitor/ios
bun x cap init "PlanifIA" "com.planifia.app" --web-dir "out"
```

### Étape 2 : Configurer `capacitor.config.ts`

Créer ou ajuster `capacitor.config.ts` à la racine :

```ts
import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.planifia.app",
  appName: "PlanifIA",
  webDir: "out",
  server: {
    // En production, Capacitor peut charger directement l'URL Vercel
    // pour garantir des mises à jour instantanées sans ré-uploader sur l'App Store :
    url: "https://myplanifai.vercel.app",
    cleartext: false,
  },
}

export default config
```

### Étape 3 : Générer le projet natif Xcode

```bash
bun x cap add ios
bun x cap sync ios
```

Cette commande génère le dossier `ios/App/App.xcworkspace`.

### Étape 4 : Ouvrir et compiler dans Xcode

```bash
bun x cap open ios
```

1. Dans Xcode, sélectionner la cible **App**.
2. Dans l'onglet **Signing & Capabilities**, choisir votre équipe Apple Developer (**Team**).
3. Connecter un iPhone par câble ou choisir un simulateur iPhone 15/16.
4. Appuyer sur **Play (▶)** pour tester l'application en conditions réelles sur l'iPhone.

### Étape 5 : Soumission sur App Store Connect

1. Dans Xcode : **Product** → **Archive**.
2. Cliquer sur **Distribute App** → **App Store Connect** → **Upload**.
3. Se rendre sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com/).
4. Renseigner les captures d'écran, la description et la politique de confidentialité.
5. Cliquer sur **Soumettre pour vérification**.

---

## 5. Recommandation

- Pour une utilisation immédiate et sans frais avec vos proches : **la PWA via Safari iOS est opérationnelle à 100 %**.
- Dès que le compte Apple Developer (99 $/an) et un Mac avec Xcode sont prêts, le passage sur Capacitor s'effectue en moins de 30 minutes grâce à la configuration ci-dessus.
