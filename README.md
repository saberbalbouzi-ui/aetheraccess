# AetherAccess V10

Assistant guidé de structuration de projets de rénovation, avec boucle complète **particulier ↔ entreprise** : préparation du dossier, consultation d’entreprises, comparaison de devis, suivi de chantier partagé avec photos et relances.

## Fonctionnalités

- Wizard guidé : type de projet, type de bien, localisation, pièces, objectifs.
- Localisation hiérarchique non bloquante : Région → Département → Commune → Code postal (API officielle geo.api.gouv.fr), avec option « Je ne connais pas encore la ville ».
- Moteur de suggestions de lots avec statuts (Confirmé, Conseillé, À vérifier).
- Détection des informations manquantes.
- Génération d’un dossier projet structuré avec exports **PDF, DOCX, TXT** et copie en un clic.
- Connexion par e-mail (lien magique) via Supabase Auth.
- Sauvegarde cloud des projets avec fallback localStorage.
- Tableau de bord « Mes projets » : liste, ouverture, suppression.
- **Consultations entreprises** : publication du dossier en cahier des charges, invitation d’entreprises par e-mail, devis reçus, acceptation/refus.
- **Relances** : invitation sans réponse depuis 5 jours → bouton « Relancer » avec e-mail pré-rempli et horodatage.
- **Comparaison de devis structurée** : tableau montant / délai / postes chiffrés, repères « le moins cher » et « le plus rapide » (sans désigner automatiquement une meilleure offre).
- **Espace entreprise** : invitations reçues (y compris avant création du compte), dossier client, devis chiffré (montant, délai, notes).
- **Suivi chantier partagé** : ouverture automatique à l’acceptation d’un devis, comptes rendus (avancement, problèmes, prochaines étapes) **avec photos** (bucket privé, URLs signées, lightbox), actions avec échéances ; le particulier pilote le statut.
- Profil utilisateur : rôle particulier / entreprise, annuaire des entreprises.

## Migrations base de données

Les migrations sont appliquées sur le projet Supabase (réf. `ydujjwnijjjjjjyokmvx`) :

| Migration | Contenu |
|---|---|
| `phase5_contractor_directory_and_email_invites` | Annuaire des entreprises, invitations par e-mail, trigger `handle_new_user` |
| `phase6_site_reports_and_work_sites` | Tables `work_sites`, `site_reports`, `site_actions`, vue `quote_comparison` |
| `phase7_report_photos_and_reminders` | Bucket Storage `site-photos` + politiques, colonne `photos`, `last_reminded_at` |
| `phase8_fix_rls_recursion_and_invite_flow` | **Correctif critique** : récursion infinie des politiques RLS phase 4 résolue via fonctions `SECURITY DEFINER` ; l’entreprise peut désormais accepter/décliner ses invitations |

## Configuration Supabase

1. Copier `.env.example` en `.env.local` (déjà pré-rempli avec l’URL et la clé publishable du projet).
2. Sur Vercel : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans Project Settings → Environment Variables.
3. Dans le dashboard Supabase → Authentication → URL Configuration :
   - Site URL : domaine de production Vercel.
   - Redirect URLs : ajouter le domaine Vercel et `http://localhost:5173/**`.
4. Vérifier que le provider « Email » est activé (Authentication → Providers).

Les données sont protégées par le RLS : chaque utilisateur ne voit que ses propres projets ; une entreprise ne voit que les consultations acceptées et les chantiers dont elle est titulaire ; comptes rendus, actions et photos ne sont partagés qu’entre le particulier et l’entreprise du chantier. Les invitations par e-mail sont rattachées automatiquement au compte à la première connexion (trigger `handle_new_user`).

## Développement

```bash
npm install
npm run dev
```

Les exports PDF/DOCX sont générés côté navigateur (`jspdf`, `docx`) — aucun serveur requis. Les relances utilisent un e-mail pré-rempli (`mailto:`) pour rester fiables sans service d’envoi ; une automatisation complète pourra passer par une Edge Function plus tard.

Les suggestions techniques sont des pistes à confirmer avec l’entreprise. Les fourchettes, surfaces et comparaisons affichées sont des repères de planification, pas des prix de travaux.
