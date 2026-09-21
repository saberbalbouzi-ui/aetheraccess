const labelStatus = {
  confirmed: 'Confirmé',
  recommended: 'Conseillé',
  'to-check': 'À vérifier',
  'not-applicable': 'Non concerné',
};

export function generateProjectDossier(project = {}) {
  const lines = [
    'DOSSIER PROJET AETHERACCESS',
    '',
    '1. IDENTIFICATION',
    `Nom : ${project.name || 'À préciser'}`,
    `Type de projet : ${project.projectType || 'À préciser'}`,
    `Type de bien : ${project.propertyType || 'À préciser'}`,
    '',
    '2. LOCALISATION',
    project.location?.unknown ? 'Localisation : À définir' : `Localisation : ${project.location?.city || 'À préciser'}`,
    '',
    '3. PIÈCES CONCERNÉES',
    ...(project.roomIds?.length ? project.roomIds.map((room) => `- ${room}`) : ['- À préciser']),
    '',
    '4. LOTS DE TRAVAUX',
    ...(project.suggestions?.length ? project.suggestions.map((work) => `- ${work.label} — ${labelStatus[work.status] || 'À préciser'}`) : ['- À générer']),
    '',
    '5. INFORMATIONS MANQUANTES',
    ...(project.missingInformation?.length ? project.missingInformation.map((item) => `- ${item.label}`) : ['- Aucune']),
    '',
    '6. POINTS À CONFIRMER AVEC L’ENTREPRISE',
    '- Les suggestions techniques doivent être vérifiées sur place.',
    '- Les métrés et quantités restent à confirmer.',
    '',
    '7. PROCHAINES ACTIONS',
    '- Compléter les informations manquantes.',
    '- Relire et valider le dossier.',
    '- Préparer une demande de devis.',
  ];
  return lines.join('\\n');
}