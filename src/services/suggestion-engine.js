import { WORK_CATALOG, WORK_STATUSES } from '../data/works';

// Justifications générées par les règles — jamais présentées comme des obligations.
const RATIONALES = {
  'project-full-renovation': 'Suggéré car vous avez sélectionné une rénovation complète.',
  'project-room-renovation': 'Suggéré car vous rénovez une ou plusieurs pièces.',
  'project-kitchen': 'Suggéré car vous avez sélectionné une rénovation de cuisine.',
  'project-bathroom': 'Suggéré car vous avez sélectionné une rénovation de salle de bains.',
  'project-performance': 'Suggéré car vous souhaitez améliorer les performances du logement.',
  'room-bathroom': 'Suggéré car la salle de bains fait partie des pièces concernées.',
  'room-kitchen': 'Suggéré car la cuisine fait partie des pièces concernées.',
  'objective-comfort': 'Suggéré car l’amélioration du confort fait partie de vos objectifs.',
  'objective-energy': 'Suggéré car la réduction des consommations fait partie de vos objectifs.',
  'feature-italian-shower': 'À vérifier car vous envisagez une douche à l’italienne (évacuation et pente à confirmer).',
  'existing-poor': 'À vérifier : l’état actuel des installations semble dégradé.',
  'existing-unknown': 'À vérifier : l’état actuel des installations n’est pas encore précisé.',
  default: 'Probablement nécessaire compte tenu des travaux sélectionnés.',
};

// Règles déterministes : [lot, statut, raison]
const rules = {
  bathroom: [
    ['plumbing', WORK_STATUSES.TO_CHECK, 'project-bathroom'],
    ['sanitary', WORK_STATUSES.RECOMMENDED, 'project-bathroom'],
    ['waterproofing', WORK_STATUSES.TO_CHECK, 'project-bathroom'],
    ['tiling', WORK_STATUSES.RECOMMENDED, 'project-bathroom'],
    ['electricity', WORK_STATUSES.TO_CHECK, 'project-bathroom'],
    ['lighting', WORK_STATUSES.RECOMMENDED, 'project-bathroom'],
    ['ventilation', WORK_STATUSES.TO_CHECK, 'project-bathroom'],
    ['painting', WORK_STATUSES.RECOMMENDED, 'project-bathroom'],
  ],
  kitchen: [
    ['kitchen', WORK_STATUSES.CONFIRMED, 'project-kitchen'],
    ['plumbing', WORK_STATUSES.TO_CHECK, 'project-kitchen'],
    ['electricity', WORK_STATUSES.TO_CHECK, 'project-kitchen'],
    ['lighting', WORK_STATUSES.RECOMMENDED, 'project-kitchen'],
    ['flooring', WORK_STATUSES.RECOMMENDED, 'project-kitchen'],
    ['painting', WORK_STATUSES.RECOMMENDED, 'project-kitchen'],
  ],
  'full-renovation': [
    ['protection', WORK_STATUSES.RECOMMENDED, 'project-full-renovation'],
    ['removal', WORK_STATUSES.TO_CHECK, 'project-full-renovation'],
    ['waste-removal', WORK_STATUSES.RECOMMENDED, 'project-full-renovation'],
    ['electricity', WORK_STATUSES.TO_CHECK, 'project-full-renovation'],
    ['plumbing', WORK_STATUSES.TO_CHECK, 'project-full-renovation'],
    ['insulation', WORK_STATUSES.TO_CHECK, 'project-full-renovation'],
    ['painting', WORK_STATUSES.RECOMMENDED, 'project-full-renovation'],
    ['flooring', WORK_STATUSES.RECOMMENDED, 'project-full-renovation'],
  ],
  performance: [
    ['insulation', WORK_STATUSES.TO_CHECK, 'project-performance'],
    ['windows', WORK_STATUSES.TO_CHECK, 'project-performance'],
    ['heating', WORK_STATUSES.TO_CHECK, 'project-performance'],
    ['ventilation', WORK_STATUSES.TO_CHECK, 'project-performance'],
  ],
};

// Salle de bains avec douche à l’italienne : lots contextuels supplémentaires.
const italianShowerRules = [
  ['plumbing', WORK_STATUSES.TO_CHECK, 'feature-italian-shower'],
  ['waterproofing', WORK_STATUSES.TO_CHECK, 'feature-italian-shower'],
  ['tiling', WORK_STATUSES.RECOMMENDED, 'feature-italian-shower'],
];

const STATUS_RANK = {
  [WORK_STATUSES.CONFIRMED]: 4,
  [WORK_STATUSES.RECOMMENDED]: 3,
  [WORK_STATUSES.TO_CHECK]: 2,
  [WORK_STATUSES.NOT_APPLICABLE]: 1,
};

const statusAtLeast = (current, next) =>
  (STATUS_RANK[next] || 0) > (STATUS_RANK[current] || 0) ? next : current;

/**
 * Moteur de suggestions — fonction pure, déterministe et explicable.
 * Retourne des lots { id, label, category, status, rationale } ;
 * les choix utilisateur (workStatuses) sont fusionnés ensuite dans le wizard.
 */
export function suggestWorks({ projectType, roomIds = [], objectives = [], features = [], existingCondition } = {}) {
  const byId = new Map();
  const add = (id, status, reason) => {
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { status, rationale: RATIONALES[reason] || RATIONALES.default });
      return;
    }
    // Garde le statut le plus engagé, mais la première justification explicative.
    byId.set(id, { status: statusAtLeast(existing.status, status), rationale: existing.rationale });
  };

  (rules[projectType] || []).forEach(([id, status, reason]) => add(id, status, reason));

  if (projectType !== 'bathroom' && roomIds.includes('bathroom')) {
    rules.bathroom.forEach(([id, status]) => add(id, status, 'room-bathroom'));
  }
  if (projectType !== 'kitchen' && roomIds.includes('kitchen')) {
    rules.kitchen.forEach(([id, status]) => add(id, status, 'room-kitchen'));
  }
  if (objectives.includes('comfort')) add('ventilation', WORK_STATUSES.TO_CHECK, 'objective-comfort');
  if (objectives.includes('energy')) add('insulation', WORK_STATUSES.TO_CHECK, 'objective-energy');

  if (features.includes('italian-shower') && (projectType === 'bathroom' || roomIds.includes('bathroom'))) {
    italianShowerRules.forEach(([id, status, reason]) => add(id, status, reason));
  }

  // État existant : renforce la prudence sur les lots techniques.
  if (existingCondition === 'poor' || existingCondition === 'unknown') {
    const reason = existingCondition === 'poor' ? 'existing-poor' : 'existing-unknown';
    ['electricity', 'plumbing'].forEach((id) => {
      if (byId.has(id) && byId.get(id).status === WORK_STATUSES.TO_CHECK) {
        byId.set(id, { status: WORK_STATUSES.TO_CHECK, rationale: RATIONALES[reason] });
      }
    });
  }

  return [...byId.entries()]
    .map(([id, meta]) => {
      const work = WORK_CATALOG.find((item) => item.id === id);
      return work ? { ...work, ...meta } : null;
    })
    .filter(Boolean);
}

export { WORK_STATUSES } from '../data/works';
