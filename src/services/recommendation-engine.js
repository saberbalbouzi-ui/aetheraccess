// Moteur de recommandation projet ↔ entreprise — fonction pure, déterministe et explicable.
// Les coefficients restent configurables ici ; ils ne sont jamais affichés comme
// une vérité absolue à l'utilisateur (on montre des raisons, pas des pourcentages).

export const MATCH_WEIGHTS = {
  specialties: 40, // compatibilité avec les lots du projet
  distance: 25, // proximité géographique (dans la zone d'intervention)
  zone: 15, // zone d'intervention déclarée (département couvert)
  availability: 10, // disponibilité déclarée
  experience: 5, // projets réalisés sur la plateforme
  profileQuality: 5, // profil vérifié / complet
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

// Correspondance lots du projet ↔ spécialités d'annuaire.
// Les spécialités d'annuaire utilisent les ids du WORK_CATALOG.
function specialtyScore(projectWorkIds = [], contractorSpecialties = []) {
  if (!projectWorkIds.length) return { score: 0.5, matched: [] }; // pas de lots = neutre
  const matched = projectWorkIds.filter((id) => contractorSpecialties.includes(id));
  return { score: matched.length / projectWorkIds.length, matched };
}

function distanceScore(distanceKm, radiusKm) {
  if (distanceKm == null) return 0.3; // localisation entreprise inconnue = neutre bas
  if (radiusKm && distanceKm > radiusKm) return 0;
  // 0 km → 1, radius → 0 (linéaire)
  return clamp01(1 - distanceKm / Math.max(radiusKm || 25, 1));
}

function zoneScore(projectDepartment, contractorDepartment, contractorRadiusKm) {
  if (!projectDepartment || !contractorDepartment) return 0.5;
  return projectDepartment === contractorDepartment ? 1 : 0.3;
}

function availabilityScore(availability) {
  return { available: 1, busy: 0.4, unavailable: 0 }[availability] ?? 0.5;
}

function experienceScore(projectsCount) {
  // 0 → 0, 10+ → 1 (progression douce)
  return clamp01((projectsCount || 0) / 10);
}

function profileQualityScore(entry) {
  let score = 0;
  if (entry.verified) score += 0.6;
  if (entry.business_name) score += 0.2;
  if ((entry.specialties || []).length) score += 0.2;
  return clamp01(score);
}

// Distance approximative entre deux codes postaux français (mêmes 2 premiers chiffres ≈ proche).
// Suffisant pour un classement de pertinence sans exposer d'adresse exacte.
export function approximateDistanceKm(projectPostal, contractorPostal) {
  if (!projectPostal || !contractorPostal) return null;
  const pDept = String(projectPostal).slice(0, 2);
  const cDept = String(contractorPostal).slice(0, 2);
  if (pDept === cDept) {
    const delta = Math.abs(parseInt(projectPostal, 10) - parseInt(contractorPostal, 10));
    return Math.max(1, Math.round(delta / 100) || 2); // même département : 1–30 km estimés
  }
  return null; // départements différents : distance inconnue (le score zone tranchera)
}

/**
 * Classe les entreprises de l'annuaire pour un projet donné.
 * Retourne [{ ...entry, matchScore (0-100), distanceKm, matchedSpecialties, reasons[] }]
 * trié par pertinence décroissante. La proximité seule ne gagne jamais :
 * la compatibilité des lots pèse 40 % du score.
 */
export function rankContractors(project = {}, directoryEntries = [], weights = MATCH_WEIGHTS) {
  const projectWorkIds = (project.suggestions || [])
    .filter((work) => work.status !== 'not-applicable')
    .map((work) => work.id);
  const projectPostal = project.location?.postalCode || '';
  const projectDepartment = project.location?.departmentCode || (projectPostal ? String(projectPostal).slice(0, 2) : '');

  return directoryEntries
    .filter((entry) => !entry.consultation_paused && entry.availability !== 'unavailable')
    .map((entry) => {
      const specialties = Array.isArray(entry.specialties) ? entry.specialties : [];
      const distanceKm = approximateDistanceKm(projectPostal, entry.postal_code);
      const radiusKm = entry.intervention_radius_km || 30;

      const parts = {
        specialties: specialtyScore(projectWorkIds, specialties),
        distance: distanceScore(distanceKm, radiusKm),
        zone: zoneScore(projectDepartment, entry.department_code, radiusKm),
        availability: availabilityScore(entry.availability),
        experience: experienceScore(entry.projects_completed),
        profileQuality: profileQualityScore(entry),
      };

      const total = weights.specialties + weights.distance + weights.zone + weights.availability + weights.experience + weights.profileQuality;
      const score = Math.round(
        ((parts.specialties.score * weights.specialties +
          parts.distance * weights.distance +
          parts.zone * weights.zone +
          parts.availability * weights.availability +
          parts.experience * weights.experience +
          parts.profileQuality * weights.profileQuality) / total) * 100,
      );

      // Raisons lisibles — affichées à l'utilisateur à la place des coefficients.
      const reasons = [];
      if (parts.specialties.matched.length) reasons.push(`Spécialités compatibles : ${parts.specialties.matched.length}/${projectWorkIds.length || 1} lots`);
      if (distanceKm != null) reasons.push(`${distanceKm} km du chantier`);
      else if (projectDepartment && entry.department_code === projectDepartment) reasons.push('Intervient dans votre département');
      if (entry.availability === 'available') reasons.push('Disponible');
      if (entry.verified) reasons.push('Profil vérifié');

      return {
        ...entry,
        matchScore: score,
        distanceKm,
        matchedSpecialties: parts.specialties.matched,
        reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Résumé affiché AVANT l'envoi automatique contrôlé (confirmation explicite obligatoire).
export function summarizeSelection(ranked = [], count = 5) {
  const picked = ranked.slice(0, count);
  const near = picked.filter((entry) => entry.distanceKm != null && entry.distanceKm <= 10).length;
  const specialized = picked.filter((entry) => entry.matchedSpecialties?.length > 0).length;
  const active = picked.filter((entry) => entry.availability === 'available').length;
  return {
    picked,
    lines: [
      `${near} à moins de 10 km`,
      `${specialized} spécialisée${specialized > 1 ? 's' : ''} dans vos lots principaux`,
      `${active} profil${active > 1 ? 's' : ''} disponible${active > 1 ? 's' : ''}`,
    ],
  };
}
