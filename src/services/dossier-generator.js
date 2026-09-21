const labelStatus = {
  confirmed: 'Confirmé',
  recommended: 'Conseillé',
  'to-check': 'À vérifier',
  'not-applicable': 'Non concerné',
};

const labelRoom = (room) => room;

function locationLine(location = {}) {
  if (location.unknown) return 'Localisation : À définir';
  const parts = [];
  if (location.city) parts.push(location.postalCode ? `${location.city} (${location.postalCode})` : location.city);
  if (location.departmentName) parts.push(location.departmentName);
  if (location.regionName) parts.push(location.regionName);
  return `Localisation : ${parts.length ? parts.join(', ') : 'À préciser'}`;
}

// Dossier structuré : source unique pour l’aperçu texte et les exports PDF/DOCX.
export function generateProjectDossierSections(project = {}) {
  return [
    {
      heading: '1. Identification',
      lines: [
        `Nom : ${project.name || 'À préciser'}`,
        `Type de projet : ${project.projectType || 'À préciser'}`,
        `Type de bien : ${project.propertyType || 'À préciser'}`,
      ],
    },
    {
      heading: '2. Localisation',
      lines: [locationLine(project.location)],
    },
    {
      heading: '3. Pièces concernées',
      lines: project.roomIds?.length ? project.roomIds.map((room) => `- ${labelRoom(room)}`) : ['- À préciser'],
    },
    {
      heading: '4. Lots de travaux',
      lines: project.suggestions?.length
        ? project.suggestions.map((work) => `- ${work.label} — ${labelStatus[work.status] || 'À préciser'}`)
        : ['- À générer'],
    },
    {
      heading: '5. Informations manquantes',
      lines: project.missingInformation?.length ? project.missingInformation.map((item) => `- ${item.label}`) : ['- Aucune'],
    },
    {
      heading: '6. Points à confirmer avec l’entreprise',
      lines: [
        '- Les suggestions techniques doivent être vérifiées sur place.',
        '- Les métrés et quantités restent à confirmer.',
      ],
    },
    {
      heading: '7. Prochaines actions',
      lines: [
        '- Compléter les informations manquantes.',
        '- Relire et valider le dossier.',
        '- Préparer une demande de devis.',
      ],
    },
  ];
}

export function generateProjectDossier(project = {}) {
  const sections = generateProjectDossierSections(project);
  return [
    'DOSSIER PROJET AETHERACCESS',
    ...sections.flatMap((section) => ['', section.heading.toUpperCase(), ...section.lines]),
  ].join('\n');
}
