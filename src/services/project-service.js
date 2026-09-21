const STORAGE_KEY = 'aetheraccess_v7_project';

export function saveProjectFallback(project) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
}

export function loadProjectFallback() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearProjectFallback() {
  localStorage.removeItem(STORAGE_KEY);
}