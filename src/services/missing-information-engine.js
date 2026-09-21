// Centre de contrôle des informations manquantes — fonction pure, recalculée après chaque réponse.
// severity: 'blocking' | 'important' | 'optional'
// status:   'open' | 'dismissed' (je ne sais pas) | 'resolved'

export const MISSING_SEVERITIES = {
  BLOCKING: 'blocking',
  IMPORTANT: 'important',
  OPTIONAL: 'optional',
};

export const REASSURANCE_MESSAGE = 'Pas de problème. Nous continuerons avec les informations disponibles.';

const checks = [
  {
    id: 'project-type',
    title: 'Type de projet',
    description: 'Type de travaux à préciser',
    severity: MISSING_SEVERITIES.IMPORTANT,
    source: 'step-1',
    test: (project) => !project.projectType || project.projectType === 'unknown',
  },
  {
    id: 'property-type',
    title: 'Type de bien',
    description: 'Type de bien à préciser',
    severity: MISSING_SEVERITIES.IMPORTANT,
    source: 'step-2',
    test: (project) => !project.propertyType || project.propertyType === 'unknown',
  },
  {
    id: 'location-city',
    title: 'Localisation',
    description: 'Ville ou commune à préciser',
    severity: MISSING_SEVERITIES.IMPORTANT,
    source: 'step-3',
    test: (project) => !project.location?.city && !project.location?.unknown,
  },
  {
    id: 'surface',
    title: 'Surface',
    description: 'Surface du logement inconnue',
    severity: MISSING_SEVERITIES.OPTIONAL,
    source: 'step-2',
    test: (project) => !project.surface,
  },
  {
    id: 'existing-condition',
    title: 'État actuel',
    description: 'État des installations non précisé',
    severity: MISSING_SEVERITIES.OPTIONAL,
    source: 'step-5',
    test: (project) => !project.existingCondition || project.existingCondition === 'unknown',
  },
  {
    id: 'rooms',
    title: 'Pièces',
    description: 'Pièces concernées à préciser',
    severity: MISSING_SEVERITIES.IMPORTANT,
    source: 'step-4',
    test: (project) => !project.roomIds?.length,
  },
  {
    id: 'bathroom-ventilation',
    title: 'Salle de bains',
    description: 'Présence d’une ventilation à confirmer',
    severity: MISSING_SEVERITIES.OPTIONAL,
    source: 'step-6',
    test: (project) =>
      (project.roomIds || []).includes('bathroom') && !project.features?.includes('ventilation-confirmed'),
  },
];

/**
 * Recalcule les informations manquantes après chaque réponse.
 * dismissed = ids marqués « Je ne sais pas » par l'utilisateur :
 * ils restent visibles dans le dossier comme points à vérifier plus tard.
 */
export function getMissingItems(project = {}, dismissedIds = []) {
  return checks
    .filter((check) => check.test(project))
    .map((check) => ({
      id: check.id,
      title: check.title,
      description: check.description,
      severity: check.severity,
      source: check.source,
      status: dismissedIds.includes(check.id) ? 'dismissed' : 'open',
    }));
}

export function countOpenMissing(items = []) {
  return items.filter((item) => item.status === 'open').length;
}
