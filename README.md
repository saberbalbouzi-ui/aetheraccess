# AetherAccess V7.1

Assistant guidé de structuration de projets de rénovation : l’utilisateur répond à quelques questions, AetherAccess propose les pièces, les lots de travaux et un dossier projet à relire.

## Fonctionnalités

- Wizard guidé : type de projet, type de bien, localisation, pièces, objectifs.
- Localisation hiérarchique non bloquante : Région → Département → Commune → Code postal (API officielle geo.api.gouv.fr), avec option « Je ne connais pas encore la ville ».
- Moteur de suggestions de lots avec statuts (Confirmé, Conseillé, À vérifier).
- Détection des informations manquantes.
- Génération d’un dossier projet structuré.
- Connexion par e-mail (lien magique) via Supabase Auth.
- Sauvegarde cloud des projets (projets, pièces, lots, brief) avec fallback localStorage.
- Tableau de bord « Mes projets » : liste, ouverture, suppression.

## Configuration Supabase

1. Copier `.env.example` en `.env.local` (déjà pré-rempli avec l’URL et la clé publishable du projet).
2. Sur Vercel : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans Project Settings → Environment Variables.
3. Dans le dashboard Supabase → Authentication → URL Configuration :
   - Site URL : domaine de production Vercel.
   - Redirect URLs : ajouter le domaine Vercel et `http://localhost:5173/**`.
4. Vérifier que le provider « Email » est activé (Authentication → Providers).

Les données sont protégées par le RLS : chaque utilisateur ne voit que ses propres projets (`renovation_projects`, `project_rooms`, `room_work_items`, `renovation_briefs`).

## Développement

```bash
npm install
npm run dev
```

Les suggestions techniques sont des pistes à confirmer avec l’entreprise. Les fourchettes et surfaces affichées sont des repères de planification, pas des prix de travaux.
