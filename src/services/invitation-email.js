// Génère le message d'invitation professionnel à partir des données déjà saisies.
// Utilisé pour pré-remplir l'e-mail envoyé à l'entreprise (mailto:).

const PROJECT_TYPE_LABELS = {
  'full-renovation': 'rénovation complète',
  'room-renovation': 'rénovation de pièces',
  kitchen: 'rénovation de cuisine',
  bathroom: 'rénovation de salle de bains',
  performance: 'amélioration des performances',
};

const PROPERTY_LABELS = {
  house: 'maison',
  apartment: 'appartement',
  commercial: 'local',
};

function locationLabel(location = {}) {
  if (location.city) return location.postalCode ? `${location.city} (${location.postalCode})` : location.city;
  if (location.departmentName) return location.departmentName;
  return null;
}

export function buildInvitationMessage(project = {}, briefTitle = '') {
  const place = locationLabel(project.location);
  const typeLabel = PROJECT_TYPE_LABELS[project.projectType] || 'rénovation';
  const propertyLabel = PROPERTY_LABELS[project.propertyType];

  const subject = place
    ? `Consultation — ${propertyLabel ? `Rénovation d’un ${propertyLabel}` : 'Projet de rénovation'} à ${place}`
    : `Consultation — ${briefTitle || 'Projet de rénovation'}`;

  const works = (project.suggestions || [])
    .filter((work) => work.status !== 'not-applicable')
    .map((work) => work.label);

  const lines = [
    'Bonjour,',
    '',
    `Nous vous transmettons une demande de consultation concernant un projet de ${typeLabel}${place ? ` situé à ${place}` : ''}.`,
    '',
    'Le dossier comprend la description du projet, les pièces concernées et les travaux identifiés.',
  ];

  if (works.length) {
    const listed = works.slice(0, 12).join(', ');
    lines.push('', `Travaux identifiés : ${listed}${works.length > 12 ? '…' : ''}.`);
  }

  lines.push(
    '',
    'Nous vous invitons à consulter le dossier et à transmettre votre proposition.',
    'Pour y accéder, connectez-vous sur AetherAccess avec cette adresse e-mail :',
    'https://aetheraccess.vercel.app',
    '',
    'Cordialement,',
    'AetherAccess',
  );

  return { subject, body: lines.join('\n') };
}

// Lien mailto: pré-rempli — l'utilisateur garde la main sur l'envoi final.
export function buildInvitationMailto(email, project = {}, briefTitle = '') {
  const { subject, body } = buildInvitationMessage(project, briefTitle);
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(email || '')}?${params.toString().replace(/\+/g, '%20')}`;
}
