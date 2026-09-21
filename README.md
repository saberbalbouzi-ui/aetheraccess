# AetherAccess V8

Assistant guidé de structuration de projets de rénovation, avec boucle complète **particulier ↔ entreprise** : le particulier prépare son dossier, le publie en consultation, invite des entreprises et reçoit leurs devis.

## Fonctionnalités

- Wizard guidé : type de projet, type de bien, localisation, pièces, objectifs.
- Localisation hiérarchique non bloquante : Région → Département → Commune → Code postal (API officielle geo.api.gouv.fr), avec option « Je ne connais pas encore la ville ».
- Moteur de suggestions de lots avec statuts (Confirmé, Conseillé, À vérifier).
- Détection des informations manquantes.
- Génération d’un dossier projet structuré avec exports **PDF, DOCX, TXT** et copie en un clic.
- Connexion par e-mail (lien magique) via Supabase Auth.
- Sauvegarde cloud des projets avec fallback localStorage.
- Tableau de bord « Mes projets » : liste, ouverture, suppression.
- **Consultations entreprises** : publication du dossier en cahier des charges, invitation d’entreprises par e-mail, suivi des devis reçus, acceptation/refus.
- **Espace entreprise** : invitations reçues (y compris avant création du compte), consultation du dossier client, devis chiffré (montant, délai, notes) en brouillon puis envoi.
- Profil utilisateur : rôle particulier / entreprise, annuaire des entreprises.

## Configuration Supabase

1. Copier `.env.example` en `.env.local` (déjà pré-rempli avec l’URL et la clé publishable du projet).
2. Sur Vercel : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans Project Settings → Environment Variables.
3. Dans le dashboard Supabase → Authentication → URL Configuration :
   - Site URL : domaine de production Vercel.
   - Redirect URLs : ajouter le domaine Vercel et `http://localhost:5173/**`.
4. Vérifier que le provider « Email » est activé (Authentication → Providers).

Les données sont protégées par le RLS : chaque utilisateur ne voit que ses propres projets ; une entreprise ne voit que les cahiers des charges sur lesquels elle est invitée et qu’elle a acceptés. Les invitations par e-mail sont rattachées automatiquement au compte à la première connexion (trigger `handle_new_user`).

## Développement

```bash
npm install
npm run dev
```

Les exports PDF/DOCX sont générés côté navigateur (`jspdf`, `docx`) à partir du dossier structuré — aucun serveur requis.

Les suggestions techniques sont des pistes à confirmer avec l’entreprise. Les fourchettes et surfaces affichées sont des repères de planification, pas des prix de travaux.
