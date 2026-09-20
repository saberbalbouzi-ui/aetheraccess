# AetherAccess V2

SaaS beta pour professionnels francophones de la rénovation et de l’aménagement intérieur.

## Fonctionnalités V2

- Landing page responsive.
- Pré-diagnostic rénovation guidé.
- Résumé, travaux prioritaires, informations manquantes et points de vigilance.
- Trois scénarios : essentiel, confort et complet.
- Demande de devis structurée par lots.
- Copie des résultats et de la demande de devis.
- Formulaire de liste bêta connecté à Supabase (`beta_waitlist`).
- Génération déterministe sans API IA externe.

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

Les résultats sont des aides à la préparation de projet et doivent être relus et validés par un professionnel. Aucun diagnostic réglementaire, devis contractuel ou conseil technique définitif n’est produit.