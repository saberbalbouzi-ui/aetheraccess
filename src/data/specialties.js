import { WORK_CATALOG } from './works';

// Catalogue des spécialités entreprise — aligné sur les lots de travaux
// pour que le moteur de matching compare des libellés identiques.
const EXTRA_SPECIALTIES = [
  { category: 'Généraliste', label: 'Rénovation complète' },
  { category: 'Généraliste', label: 'Tous corps d’état' },
];

export const SPECIALTY_GROUPS = [
  ...EXTRA_SPECIALTIES.map((item) => ({ category: item.category, labels: [item.label] })),
  ...Object.entries(
    WORK_CATALOG.reduce((groups, work) => {
      (groups[work.category] = groups[work.category] || []).push(work.label);
      return groups;
    }, {}),
  ).map(([category, labels]) => ({ category, labels })),
];
