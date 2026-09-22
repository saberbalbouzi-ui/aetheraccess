import { supabase } from '../lib/supabase';
import { getCommunesOfDepartment } from './location-service';
import { rankContractors } from './matching-engine';

// Centre de commune : coordonnées approximatives via l'API geo.api.gouv.fr
// (déjà utilisée pour les communes — aucune adresse exacte exposée).
const communeCoordsCache = new Map();

export async function getCommuneCoordinates(departmentCode, cityCode) {
  if (!departmentCode || !cityCode) return null;
  const key = `${departmentCode}:${cityCode}`;
  if (communeCoordsCache.has(key)) return communeCoordsCache.get(key);
  try {
    const communes = await getCommunesOfDepartment(departmentCode);
    // Le service ne remonte pas les coordonnées : requête dédiée à la commune.
    const response = await fetch(
      `https://geo.api.gouv.fr/communes/${encodeURIComponent(cityCode)}?fields=centre&format=json&geometry=centre`,
    );
    if (!response.ok) throw new Error('géolocalisation indisponible');
    const data = await response.json();
    const coords = data?.centre?.coordinates
      ? { longitude: data.centre.coordinates[0], latitude: data.centre.coordinates[1] }
      : null;
    communeCoordsCache.set(key, coords);
    return coords;
  } catch {
    communeCoordsCache.set(key, null);
    return null;
  }
}

// Catalogue des entreprises actives (pas en pause), toutes zones confondues :
// le moteur de matching fait le tri par pertinence et distance.
export async function listDirectoryContractors() {
  if (!supabase) return { contractors: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('contractor_directory')
    .select('user_id, email, business_name, specialties, city, postal_code, department_code, intervention_radius_km, availability, verified, consultation_paused, last_activity_at, latitude, longitude')
    .eq('consultation_paused', false);
  return { contractors: data || [], error };
}

// Recommandations pour un projet : classement par pertinence (lots + proximité + zone…).
export async function recommendContractors(project = {}, options = {}) {
  const { contractors, error } = await listDirectoryContractors();
  if (error) return { recommendations: [], error };
  const ranked = rankContractors(project, contractors, options.weights);
  const limit = options.limit || 8;
  return { recommendations: ranked.slice(0, limit), error: null, total: ranked.length };
}

// Fiche entreprise complète (pour le matching géographique précis).
export async function updateDirectoryEntry(userId, patch) {
  if (!supabase || !userId) return { error: new Error('Supabase indisponible.') };
  const allowed = ['business_name', 'specialties', 'city', 'postal_code', 'department_code', 'intervention_radius_km', 'availability', 'latitude', 'longitude', 'consultation_paused'];
  const row = { updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() };
  allowed.forEach((key) => {
    if (patch[key] !== undefined) row[key] = patch[key];
  });
  const { error } = await supabase.from('contractor_directory').update(row).eq('user_id', userId);
  return { error };
}

export async function getMyDirectoryEntry(userId) {
  if (!supabase || !userId) return { entry: null, error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('contractor_directory')
    .select('user_id, email, business_name, specialties, city, postal_code, department_code, intervention_radius_km, availability, verified, consultation_paused')
    .eq('user_id', userId)
    .maybeSingle();
  return { entry: data || null, error };
}
