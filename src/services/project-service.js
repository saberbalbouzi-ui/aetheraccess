import { supabase } from '../lib/supabase';
import { ROOMS } from '../data/rooms';

const STORAGE_KEY = 'aetheraccess_v7_project';

// ---------- Fallback local (conservé) ----------

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

// ---------- Mapping projet V7 ↔ schéma Supabase ----------

const roomLabel = (id) => ROOMS.find((room) => room.id === id)?.label || id;
const roomArea = (id) => ROOMS.find((room) => room.id === id)?.defaultArea ?? null;

function locationLabel(location = {}) {
  if (location.unknown) return null;
  return location.city?.trim() || null;
}

function safeTitle(name) {
  const title = (name || '').trim().slice(0, 160);
  return title.length >= 2 ? title : 'Projet de rénovation';
}

function completionPercentage(project = {}) {
  const checks = [project.projectType, project.propertyType, project.location?.city || project.location?.unknown, project.roomIds?.length, project.objectives?.length];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function projectSnapshot(project = {}) {
  return {
    name: project.name || '',
    projectType: project.projectType || '',
    propertyType: project.propertyType || '',
    location: project.location || {},
    roomIds: project.roomIds || [],
    objectives: project.objectives || [],
    suggestions: (project.suggestions || []).map(({ id, label, category, status }) => ({ id, label, category, status })),
    missingInformation: project.missingInformation || [],
  };
}

// Répartition simple des lots suggérés vers les pièces correspondantes.
const BATHROOM_WORKS = new Set(['plumbing', 'sanitary', 'waterproofing', 'tiling', 'ventilation']);
const KITCHEN_WORKS = new Set(['kitchen', 'plumbing', 'lighting']);

// ---------- Sauvegarde cloud ----------

export async function saveProjectCloud(project, userId) {
  if (!supabase || !userId) return { project, error: new Error('Supabase indisponible.') };
  try {
    // 1. Projet
    const row = {
      user_id: userId,
      title: safeTitle(project.name),
      property_type: project.propertyType || null,
      location: locationLabel(project.location),
      status: 'draft',
      completion_percentage: completionPercentage(project),
    };
    let projectId = project.cloudId;
    if (projectId) {
      const { error } = await supabase.from('renovation_projects').update(row).eq('id', projectId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('renovation_projects').insert(row).select('id').single();
      if (error) throw error;
      projectId = data.id;
    }

    // 2. Pièces et lots : remplacement propre de l’existant
    const { data: existingRooms, error: roomsReadError } = await supabase.from('project_rooms').select('id').eq('project_id', projectId);
    if (roomsReadError) throw roomsReadError;
    if (existingRooms?.length) {
      const ids = existingRooms.map((room) => room.id);
      const { error: deleteItemsError } = await supabase.from('room_work_items').delete().in('room_id', ids);
      if (deleteItemsError) throw deleteItemsError;
      const { error: deleteRoomsError } = await supabase.from('project_rooms').delete().in('id', ids);
      if (deleteRoomsError) throw deleteRoomsError;
    }

    const roomIds = project.roomIds || [];
    const suggestions = project.suggestions || [];
    if (roomIds.length) {
      const { data: insertedRooms, error: insertRoomsError } = await supabase
        .from('project_rooms')
        .insert(roomIds.map((id) => ({ project_id: projectId, room_name: roomLabel(id), surface: roomArea(id) })))
        .select('id, room_name');
      if (insertRoomsError) throw insertRoomsError;

      if (suggestions.length && insertedRooms?.length) {
        const bathroomRoom = insertedRooms.find((room) => room.room_name === 'Salle de bains');
        const kitchenRoom = insertedRooms.find((room) => room.room_name === 'Cuisine');
        const fallbackRoom = insertedRooms[0];
        const items = suggestions.map((suggestion) => {
          let target = fallbackRoom;
          if (bathroomRoom && BATHROOM_WORKS.has(suggestion.id)) target = bathroomRoom;
          else if (kitchenRoom && KITCHEN_WORKS.has(suggestion.id)) target = kitchenRoom;
          return {
            room_id: target.id,
            trade_category: suggestion.category || 'Divers',
            description: suggestion.label,
            is_ai_suggested: true,
            status: suggestion.status || 'proposed',
          };
        });
        const { error: insertItemsError } = await supabase.from('room_work_items').insert(items);
        if (insertItemsError) throw insertItemsError;
      }
    }

    // 3. Brief structuré (source de restauration du wizard)
    const briefRow = {
      project_id: projectId,
      user_id: userId,
      objectives: (project.objectives || []).join(', ') || null,
      generated_content: { ...projectSnapshot(project), savedAt: new Date().toISOString() },
    };
    const { data: existingBrief, error: briefReadError } = await supabase
      .from('renovation_briefs')
      .select('id')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (briefReadError) throw briefReadError;
    if (existingBrief) {
      const { error } = await supabase.from('renovation_briefs').update(briefRow).eq('id', existingBrief.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('renovation_briefs').insert(briefRow);
      if (error) throw error;
    }

    return { project: { ...projectSnapshot(project), cloudId: projectId }, error: null };
  } catch (error) {
    return { project, error };
  }
}

// ---------- Lecture cloud ----------

export async function listCloudProjects(userId) {
  if (!supabase || !userId) return { projects: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('renovation_projects')
    .select('id, title, property_type, location, status, completion_percentage, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  return { projects: data || [], error };
}

export async function loadCloudProject(projectId) {
  if (!supabase) return { project: null, error: new Error('Supabase indisponible.') };
  const { data: brief, error } = await supabase
    .from('renovation_briefs')
    .select('generated_content')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { project: null, error };

  const snapshot = brief?.generated_content;
  if (snapshot && typeof snapshot === 'object') {
    const { savedAt, ...rest } = snapshot;
    return {
      project: { name: '', projectType: '', propertyType: '', location: {}, roomIds: [], objectives: [], ...rest, cloudId: projectId },
      error: null,
    };
  }

  // Repli minimal si aucun brief n’existe encore
  const { data: row, error: projectError } = await supabase
    .from('renovation_projects')
    .select('title, property_type, location')
    .eq('id', projectId)
    .single();
  if (projectError) return { project: null, error: projectError };
  return {
    project: {
      name: row.title,
      projectType: '',
      propertyType: row.property_type || '',
      location: row.location ? { city: row.location } : {},
      roomIds: [],
      objectives: [],
      cloudId: projectId,
    },
    error: null,
  };
}

export async function deleteCloudProject(projectId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  try {
    const { data: rooms, error: roomsError } = await supabase.from('project_rooms').select('id').eq('project_id', projectId);
    if (roomsError) throw roomsError;
    if (rooms?.length) {
      const ids = rooms.map((room) => room.id);
      const { error: itemsError } = await supabase.from('room_work_items').delete().in('room_id', ids);
      if (itemsError) throw itemsError;
      const { error: deleteRoomsError } = await supabase.from('project_rooms').delete().in('id', ids);
      if (deleteRoomsError) throw deleteRoomsError;
    }
    const { error: briefsError } = await supabase.from('renovation_briefs').delete().eq('project_id', projectId);
    if (briefsError) throw briefsError;
    const { error: projectError } = await supabase.from('renovation_projects').delete().eq('id', projectId);
    if (projectError) throw projectError;
    return { error: null };
  } catch (error) {
    return { error };
  }
}
