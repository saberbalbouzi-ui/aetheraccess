// Recherche des communes via l’API officielle française (geo.api.gouv.fr).
// Les régions et départements sont embarqués en local ; seules les communes
// sont chargées à la demande, département par département, avec cache mémoire.

const GEO_API = 'https://geo.api.gouv.fr';
const communesCache = new Map();

const normalize = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export async function getCommunesOfDepartment(departmentCode) {
  if (!departmentCode) return [];
  if (communesCache.has(departmentCode)) return communesCache.get(departmentCode);

  const response = await fetch(
    `${GEO_API}/departements/${departmentCode}/communes?fields=nom,code,codesPostaux&format=json&geometry=centre`,
  );
  if (!response.ok) throw new Error('Service de localisation momentanément indisponible.');

  const communes = (await response.json()).map((commune) => ({
    code: commune.code,
    name: commune.nom,
    postalCodes: commune.codesPostaux || [],
  }));
  communes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  communesCache.set(departmentCode, communes);
  return communes;
}

export function filterCommunes(communes, query, limit = 8) {
  const needle = normalize(query);
  if (!needle) return [];
  const startsWith = [];
  const contains = [];
  for (const commune of communes) {
    const name = normalize(commune.name);
    if (name.startsWith(needle)) startsWith.push(commune);
    else if (name.includes(needle)) contains.push(commune);
    if (startsWith.length >= limit) break;
  }
  return [...startsWith, ...contains].slice(0, limit);
}

export function formatLocationLabel(location = {}) {
  if (location.unknown) return '';
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.postalCode) parts.push(`(${location.postalCode})`);
  if (location.departmentName) parts.push(`— ${location.departmentName}`);
  return parts.join(' ');
}
