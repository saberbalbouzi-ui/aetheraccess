// Moteur de recommandation projet ↔ entreprise.
// Fonction pure, déterministe et explicable — les coefficients restent configurables
// et ne sont jamais affichés comme une vérité absolue à l'utilisateur.

export const MATCHING_WEIGHTS = {
  lots: 0.40,        // compatibilité avec les lots du projet
  distance: 0.25,    // proximité géographique
  zone: 0.15,        // zone d'intervention déclarée
  availability: 0.10, // disponibilité déclarée
  experience: 0.05,  // expérience (projets réalisés)
  profile: 0.05,     // qualité du profil (vérifié, renseigné)
};

// Distance approximative (Haversine) entre deux points — coordonnées de communes,
// jamais d'adresses exactes.
export function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((value) => value == null || Number.isNaN(Number(value)))) return null;
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Normalisation des libellés de lots ↔ spécialités (accents, casse).
const normalize = (text) =>
  (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function lotCompatibility(workLabels = [], specialties = []) {
  const specs = specialties.map(normalize);
  if (!specs.length) return 0;
  if (!workLabels.length) return 0.5; // neutre si le projet n'a pas encore de lots
  const matched = workLabels.filter((label) => {
    const needle = normalize(label);
    return specs.some((spec) => spec.includes(needle) || needle.includes(spec));
  });
  return matched.length / workLabels.length;
}

function distanceScore(distanceKm) {
  if (distanceKm == null) return 0.4; // localisation inconnue : score neutre défavorable
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.8;
  if (distanceKm <= 50) return 0.55;
  if (distanceKm <= 100) return 0.3;
  return 0.1;
}

function zoneScore(contractor, distanceKm) {
  const radius = Number(contractor.intervention_radius_km) || 30;
  if (distanceKm == null) return 0.5;
  return distanceKm <= radius ? 1 : 0.2;
}

function availabilityScore(availability) {
  if (availability === 'available') return 1;
  if (availability === 'busy') return 0.4;
  return 0.6; // non déclaré : neutre
}

function experienceScore(projectsCount) {
  const count = Number(projectsCount) || 0;
  if (count >= 10) return 1;
  if (count >= 5) return 0.75;
  if (count >= 1) return 0.5;
  return 0.3;
}

function profileScore(contractor) {
  let score = 0.4;
  if (contractor.verified) score += 0.4;
  if (contractor.business_name) score += 0.1;
  if (contractor.specialties?.length) score += 0.1;
  return Math.min(score, 1);
}

/**
 * Classe les entreprises par pertinence pour un projet.
 * @param {object} project - projet (location.latitude/longitude, suggestions[])
 * @param {Array} contractors - catalogue (contractor_directory)
 * @param {object} weights - coefficients optionnels (MATCHING_WEIGHTS par défaut)
 * @returns {Array} entreprises triées avec { matchScore (0-100), distanceKm, breakdown }
 */
export function rankContractors(project = {}, contractors = [], weights = MATCHING_WEIGHTS) {
  const workLabels = (project.suggestions || [])
    .filter((work) => work.status !== 'not-applicable')
    .map((work) => work.label);
  const projectLat = project.location?.latitude;
  const projectLon = project.location?.longitude;

  return contractors
    .filter((contractor) => !contractor.consultation_paused)
    .map((contractor) => {
      const distanceKm = haversineKm(projectLat, projectLon, contractor.latitude, contractor.longitude);
      const breakdown = {
        lots: lotCompatibility(workLabels, contractor.specialties || []),
        distance: distanceScore(distanceKm),
        zone: zoneScore(contractor, distanceKm),
        availability: availabilityScore(contractor.availability),
        experience: experienceScore(contractor.projects_count),
        profile: profileScore(contractor),
      };
      const matchScore = Math.round(
        100 *
          (breakdown.lots * weights.lots +
            breakdown.distance * weights.distance +
            breakdown.zone * weights.zone +
            breakdown.availability * weights.availability +
            breakdown.experience * weights.experience +
            breakdown.profile * weights.profile),
      );
      return { ...contractor, matchScore, distanceKm, breakdown };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
