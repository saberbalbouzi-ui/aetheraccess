# AetherAccess V3

Assistant de consultation pour professionnels francophones de la rénovation et de l’aménagement intérieur.

## Fonctionnalités V3

- Assistant guidé en quatre étapes : projet, pièces, vérification, dossier.
- Champs adaptés aux informations réellement nécessaires.
- Ajout de plusieurs pièces avec surface et travaux souhaités.
- Détection automatique des lots de travaux.
- Contrôle automatique de complétude.
- Génération d’un dossier de consultation prêt à relire.
- E-mail prêt à relire et copier.
- Formulaire de liste bêta connecté à Supabase (`beta_waitlist`).
- Aucun prix inventé et aucune API IA externe.

## Variables Vercel

```text
VITE_SUPABASE_URL=https://ydujjwnijjjjjjyokmvx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Configurez ces variables pour Production, Preview et Development. N’utilisez jamais la clé `service_role` côté frontend.

## Utilisation

1. Renseignez le projet, le budget et le délai.
2. Ajoutez les pièces concernées.
3. Sélectionnez les travaux souhaités par pièce.
4. Vérifiez les informations manquantes.
5. Générez le dossier final.
6. Relisez et copiez l’e-mail avant de l’envoyer.

Le dossier produit est une base de consultation. Il ne constitue pas un devis contractuel, un diagnostic réglementaire ni une validation des prix ou des travaux.