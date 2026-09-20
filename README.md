# AetherAccess V1

SaaS beta pour professionnels francophones de la rénovation et de l’aménagement intérieur.

## Fonctionnalités V1

- Landing page responsive.
- Formulaire de liste bêta connecté à Supabase (`beta_waitlist`).
- Générateur de brief de rénovation sans API IA externe.
- Sauvegarde locale du dernier brief dans le navigateur.
- Aucun paiement ni clé secrète dans le frontend.

## Variables Vercel

```text
VITE_SUPABASE_URL=https://ydujjwnijjjjjjyokmvx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ces variables doivent être configurées dans Vercel pour Production, Preview et Development. N’utilisez jamais la clé `service_role` côté frontend.

## Développement local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

La V1 ne fournit pas encore d’appel à un modèle IA, de paiement ou de système d’authentification. Ces fonctionnalités seront ajoutées après validation de la bêta.