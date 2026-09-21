const labelStatus = {
  confirmed: 'Confirmé',
  recommended: 'Conseillé',
  'to-check': 'À vérifier',
  'not-applicable': 'Non concerné',
};

const labelSeverity = {
  blocking: 'Bloquant',
  important: 'Important',
  optional: 'Optionnel',
};

const labelRoom = (room) => room;

function locationLine(location = {}) {
  if (location.unknown) return 'Localisation : à définir (pourra être complétée plus tard)';
  const parts = [];
  if (location.city) parts.push(location.postalCode ? `${location.city} (${location.postalCode})` : location.city);
  if (location.departmentName) parts.push(location.departmentName);
  if (location.regionName) parts.push(location.regionName);
  const country = location.country?.label || (location.city || location.regionName ? 'France' : '');
  if (country) parts.push(country);
  return `Localisation : ${parts.length ? parts.join(', ') : 'À préciser'}`;
}

// Dossier structuré : source unique pour l’aperçu texte et les exports PDF/DOCX.
export function generateProjectDossierSections(project = {}) {
  const toVerify = (project.suggestions || []).filter((work) => work.status === 'to-check');
  const dismissed = (project.missingInformation || []).filter((item) => item.status === 'dismissed');

  return [
    {
      heading: '1. Identification',
      lines: [
        `Nom : ${project.name || 'À préciser'}`,
        `Type de projet : ${project.projectType || 'À préciser'}`,
        `Type de bien : ${project.propertyType || 'À préciser'}`,
        project.surface ? `Surface approximative : ${project.surface} m²` : null,
        project.existingCondition ? `État de l’existant : ${project.existingCondition}` : null,
      ].filter(Boolean),
    },
    {
      heading: '2. Localisation',
      lines: [locationLine(project.location)],
    },
    {
      heading: '3. Objectifs',
      lines: project.objectives?.length ? project.objectives.map((objective) => `- ${objective}`) : ['- À préciser'],
    },
    {
      heading: '4. Pièces concernées',
      lines: project.roomIds?.length ? project.roomIds.map((room) => `- ${labelRoom(room)}`) : ['- À préciser'],
    },
    {
      heading: '5. Lots de travaux',
      lines: project.suggestions?.length
        ? project.suggestions.map((work) => {
            const rationale = work.rationale ? ` — ${work.rationale}` : '';
            const note = work.note ? ` (note : ${work.note})` : '';
            return `- ${work.label} — ${labelStatus[work.status] || 'À préciser'}${rationale}${note}`;
          })
        : ['- À générer'],
    },
    {
      heading: '6. Points à vérifier',
      lines: toVerify.length
        ? toVerify.map((work) => `- ${work.label} : ${work.rationale || 'à confirmer avec l’entreprise'}`)
        : ['- Aucun'],
    },
    {
      heading: '7. Informations manquantes',
      lines: project.missingInformation?.length
        ? project.missingInformation.map((item) => {
            const severity = item.severity ? `[${labelSeverity[item.severity] || item.severity}] ` : '';
            const later = item.status === 'dismissed' ? ' — à compléter plus tard' : '';
            return `- ${severity}${item.title || ''} : ${item.description || item.label || ''}${later}`;
          })
        : ['- Aucune'],
    },
    {
      heading: '8. Prochaines actions',
      lines: [
        dismissed.length ? `- Compléter plus tard : ${dismissed.map((item) => (item.title || item.id).toLowerCase()).join(', ')}.` : null,
        '- Relire et valider le dossier.',
        '- Préparer une demande de devis.',
      ].filter(Boolean),
    },
  ];
}

// Représentation structurée du dossier (prête pour Supabase / exports).
export function buildDossierModel(project = {}) {
  return {
    identification: {
      name: project.name || '',
      projectType: project.projectType || '',
      surface: project.surface || '',
      existingCondition: project.existingCondition || '',
    },
    location: project.location || {},
    property: { type: project.propertyType || '' },
    objectives: project.objectives || [],
    rooms: project.roomIds || [],
    workItems: project.suggestions || [],
    missingInformation: project.missingInformation || [],
    verificationPoints: (project.suggestions || []).filter((work) => work.status === 'to-check'),
    requestedDocuments: ['dossier-pdf', 'dossier-docx', 'dossier-txt', 'demande-de-devis'],
    nextActions: ['Compléter les informations manquantes', 'Relire et valider le dossier', 'Préparer une demande de devis'],
  };
}

export function generateProjectDossier(project = {}) {
  const sections = generateProjectDossierSections(project);
  return [
    'DOSSIER PROJET AETHERACCESS',
    ...sections.flatMap((section) => ['', section.heading.toUpperCase(), ...section.lines]),
  ].join('\n');
}
