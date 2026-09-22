import { supabase } from '../lib/supabase';

// ---------- Profil ----------

export async function getMyProfile(userId) {
  if (!supabase || !userId) return { profile: null, error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, role, email')
    .eq('id', userId)
    .maybeSingle();
  return { profile: data || null, error };
}

export async function updateMyProfile(userId, { fullName, businessName, role } = {}) {
  if (!supabase || !userId) return { error: new Error('Supabase indisponible.') };
  const payload = {
    full_name: fullName?.trim() || null,
    business_name: businessName?.trim() || null,
    role: role || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  return { error };
}

// Une entreprise publie sa fiche dans l’annuaire pour être invitée par e-mail.
export async function registerInDirectory(userId, email, businessName) {
  if (!supabase || !userId) return { error: new Error('Supabase indisponible.') };
  const row = { user_id: userId, email: email?.trim().toLowerCase() };
  if (businessName?.trim()) row.business_name = businessName.trim();
  const { error } = await supabase
    .from('contractor_directory')
    .upsert(row, { onConflict: 'user_id' });
  return { error };
}

// ---------- Cahier des charges (specification_briefs) ----------

export async function publishBrief(projectId, title, description) {
  if (!supabase) return { brief: null, error: new Error('Supabase indisponible.') };
  const safeTitle = (title || '').trim().slice(0, 160) || 'Cahier des charges';
  const { data: existing, error: readError } = await supabase
    .from('specification_briefs')
    .select('id, status')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) return { brief: null, error: readError };

  if (existing) {
    const { data, error } = await supabase
      .from('specification_briefs')
      .update({ title: safeTitle, description: description || null, status: 'published', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    return { brief: data || null, error };
  }

  const { data, error } = await supabase
    .from('specification_briefs')
    .insert({ project_id: projectId, title: safeTitle, description: description || null, status: 'published' })
    .select()
    .single();
  return { brief: data || null, error };
}

export async function closeBrief(briefId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('specification_briefs')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', briefId);
  return { error };
}

export async function listMyBriefs(userId) {
  if (!supabase || !userId) return { briefs: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('specification_briefs')
    .select('id, title, description, status, visibility, radius_km, deadline, max_recipients, created_at, renovation_projects!inner(title, location, user_id)')
    .eq('renovation_projects.user_id', userId)
    .order('created_at', { ascending: false });
  return { briefs: data || [], error };
}

// ---------- Diffusion réseau ----------

// Paramètres de diffusion choisis par le particulier (rayon, date limite, quota).
export async function updateBriefDiffusion(briefId, { visibility, radiusKm, deadline, maxRecipients } = {}) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const row = { updated_at: new Date().toISOString() };
  if (visibility) row.visibility = visibility;
  if (radiusKm != null) row.radius_km = Number(radiusKm) || null;
  if (deadline !== undefined) row.deadline = deadline || null;
  if (maxRecipients != null) row.max_recipients = Number(maxRecipients) || null;
  const { error } = await supabase.from('specification_briefs').update(row).eq('id', briefId);
  return { error };
}

// Consultations publiées dans le réseau, non expirées (lecture entreprise, RLS réseau).
export async function listNetworkBriefs() {
  if (!supabase) return { briefs: [], error: new Error('Supabase indisponible.') };
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('specification_briefs')
    .select('id, title, description, deadline, radius_km, created_at, renovation_projects(title, location)')
    .eq('status', 'published')
    .eq('visibility', 'network')
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order('created_at', { ascending: false });
  return { briefs: data || [], error };
}

// L'entreprise exprime son intérêt : le particulier garde la main (il invite ensuite).
export async function expressInterest(briefId, contractorId) {
  if (!supabase || !contractorId) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('brief_contractors')
    .insert({ brief_id: briefId, contractor_id: contractorId, status: 'interested' });
  if (error && error.code === '23505') return { error: null, hint: 'Intérêt déjà signalé pour cette consultation.' };
  return { error };
}

// Le particulier transforme un intérêt en invitation formelle (accès au dossier complet).
export async function confirmInterestInvitation(invitationId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('brief_contractors')
    .update({ status: 'invited', notified_at: new Date().toISOString() })
    .eq('id', invitationId);
  return { error };
}

// Horodatage de lecture du dossier par l'entreprise.
export async function markBriefViewed(invitationId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('brief_contractors')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', invitationId);
  return { error };
}

// ---------- Invitations ----------

export async function inviteContractor(briefId, email) {
  if (!supabase) return { error: new Error('Supabase indisponible.'), hint: null };
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return { error: new Error('E-mail manquant.'), hint: null };

  // L’entreprise a-t-elle déjà un compte référencé dans l’annuaire ?
  const { data: directoryEntry, error: directoryError } = await supabase
    .from('contractor_directory')
    .select('user_id')
    .eq('email', normalized)
    .maybeSingle();
  if (directoryError) return { error: directoryError, hint: null };

  if (directoryEntry?.user_id) {
    const { error } = await supabase.from('brief_contractors').insert({ brief_id: briefId, contractor_id: directoryEntry.user_id });
    if (error && error.code === '23505') return { error: null, hint: 'Cette entreprise est déjà invitée sur ce cahier des charges.' };
    return { error, hint: null };
  }

  // Sinon, invitation en attente rattachée à son e-mail.
  const { error } = await supabase.from('brief_contractors').insert({ brief_id: briefId, invited_email: normalized });
  if (error && error.code === '23505') return { error: null, hint: 'Cette adresse est déjà invitée sur ce cahier des charges.' };
  return { error, hint: error ? null : 'Entreprise sans compte AetherAccess : elle retrouvera l’invitation à sa première connexion avec cet e-mail.' };
}

export async function listInvitations(briefId) {
  if (!supabase) return { invitations: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('brief_contractors')
    .select('id, contractor_id, status, invited_email, viewed_at, last_reminded_at, created_at, profiles(business_name, full_name, email)')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: true });
  return { invitations: data || [], error };
}

// ---------- Devis (contractor_quotes) ----------

export async function saveQuote(briefId, contractorId, { quoteId, amount, delayWeeks, notes } = {}) {
  if (!supabase) return { quote: null, error: new Error('Supabase indisponible.') };
  const row = {
    global_amount: Number(amount) || 0,
    delay_weeks: Number(delayWeeks) || 0,
    proposal_notes: notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (quoteId) {
    const { data, error } = await supabase.from('contractor_quotes').update(row).eq('id', quoteId).select().single();
    return { quote: data || null, error };
  }
  const { data, error } = await supabase
    .from('contractor_quotes')
    .insert({ ...row, brief_id: briefId, contractor_id: contractorId, status: 'draft' })
    .select()
    .single();
  return { quote: data || null, error };
}

export async function submitQuote(quoteId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('contractor_quotes')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  return { error };
}

export async function listQuotesForBrief(briefId) {
  if (!supabase) return { quotes: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('contractor_quotes')
    .select('id, global_amount, delay_weeks, proposal_notes, status, created_at, profiles(business_name, full_name, email)')
    .eq('brief_id', briefId)
    .neq('status', 'draft')
    .order('global_amount', { ascending: true });
  return { quotes: data || [], error };
}

export async function listMyQuotes(contractorId) {
  if (!supabase || !contractorId) return { quotes: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('contractor_quotes')
    .select('id, brief_id, global_amount, delay_weeks, proposal_notes, status, updated_at')
    .eq('contractor_id', contractorId)
    .order('updated_at', { ascending: false });
  return { quotes: data || [], error };
}

export async function decideQuote(quoteId, decision) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  if (!['accepted', 'rejected'].includes(decision)) return { error: new Error('Décision invalide.') };
  const { error } = await supabase
    .from('contractor_quotes')
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  return { error };
}

// ---------- Côté entreprise ----------

export async function listContractorInvitations(contractorId, email) {
  if (!supabase || !contractorId) return { invitations: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('brief_contractors')
    .select('id, brief_id, status, invited_email, viewed_at, created_at, specification_briefs(title, status)')
    .eq('contractor_id', contractorId)
    .order('created_at', { ascending: false });
  return { invitations: data || [], error };
}

export async function setInvitationStatus(invitationId, status) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  if (!['accepted', 'declined'].includes(status)) return { error: new Error('Statut invalide.') };
  const { error } = await supabase.from('brief_contractors').update({ status }).eq('id', invitationId);
  return { error };
}

// Dossier complet d’un cahier des charges publié (lecture entreprise).
export async function getContractorBrief(briefId) {
  if (!supabase) return { dossier: null, error: new Error('Supabase indisponible.') };
  const { data: brief, error: briefError } = await supabase
    .from('specification_briefs')
    .select('id, title, description, status, renovation_projects(id, title, property_type, location)')
    .eq('id', briefId)
    .single();
  if (briefError) return { dossier: null, error: briefError };

  const projectId = brief.renovation_projects?.id;
  const [snapshotResult, roomsResult] = await Promise.all([
    projectId
      ? supabase.from('renovation_briefs').select('generated_content').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? supabase.from('project_rooms').select('id, room_name, surface, room_work_items(description, trade_category, status)').eq('project_id', projectId)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    dossier: {
      brief,
      project: brief.renovation_projects,
      snapshot: snapshotResult.data?.generated_content || null,
      rooms: roomsResult.data || [],
    },
    error: null,
  };
}
