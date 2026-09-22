import { supabase } from '../lib/supabase';
import { rankContractors } from './matching-engine';

// Coordonnées approximatives via geo.api.gouv.fr : centres de communes uniquement,
// jamais d'adresses exactes. Cache mémoire pour éviter les requêtes répétées.
const communeCoordsCache = new Map();

export async function getCommuneCoordinates(departmentCode, cityCode) {
  if (!cityCode) return null;
  const key = `${departmentCode || ''}:${cityCode}`;
  if (communeCoordsCache.has(key)) return communeCoordsCache.get(key);
  try {
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

// Coordonnées approximatives depuis un code postal (centre de la première commune correspondante).
export async function getPostalCodeCoordinates(postalCode) {
  const postal = (postalCode || '').trim();
  if (!/^\d{5}$/.test(postal)) return null;
  const key = `cp:${postal}`;
  if (communeCoordsCache.has(key)) return communeCoordsCache.get(key);
  try {
    const response = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(postal)}&fields=centre&format=json&geometry=centre`,
    );
    if (!response.ok) throw new Error('géolocalisation indisponible');
    const rows = await response.json();
    const centre = rows?.[0]?.centre?.coordinates;
    const coords = centre ? { longitude: centre[0], latitude: centre[1] } : null;
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
// Résout d'abord les coordonnées du projet (centre de commune) si elles ne sont pas déjà connues.
export async function recommendContractors(project = {}, options = {}) {
  const { contractors, error } = await listDirectoryContractors();
  if (error) return { recommendations: [], error, total: 0 };

  let located = project;
  if (project.location?.latitude == null) {
    const coords = project.location?.cityCode
      ? await getCommuneCoordinates(project.location?.departmentCode, project.location.cityCode)
      : await getPostalCodeCoordinates(project.location?.postalCode);
    if (coords) located = { ...project, location: { ...project.location, ...coords } };
  }

  const ranked = rankContractors(located, contractors, options.weights);
  const limit = options.limit || 8;
  return { recommendations: ranked.slice(0, limit), error: null, total: ranked.length };
}

// Mise à jour de la fiche annuaire (clés autorisées uniquement).
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
