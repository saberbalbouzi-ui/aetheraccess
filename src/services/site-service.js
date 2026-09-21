import { supabase } from '../lib/supabase';

// ---------- Ouverture et lecture des chantiers ----------

export async function openWorkSite(projectId, quoteId, contractorId) {
  if (!supabase) return { workSite: null, error: new Error('Supabase indisponible.') };
  const { data: existing, error: readError } = await supabase
    .from('work_sites')
    .select()
    .eq('quote_id', quoteId)
    .maybeSingle();
  if (readError) return { workSite: null, error: readError };
  if (existing) return { workSite: existing, error: null };

  const { data, error } = await supabase
    .from('work_sites')
    .insert({ project_id: projectId, quote_id: quoteId, contractor_id: contractorId })
    .select()
    .single();
  return { workSite: data || null, error };
}

export async function listOwnerWorkSites(userId) {
  if (!supabase || !userId) return { workSites: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('work_sites')
    .select('id, status, started_at, quote_id, contractor_id, renovation_projects!inner(title, location, user_id), profiles(business_name, full_name)')
    .eq('renovation_projects.user_id', userId)
    .order('started_at', { ascending: false });
  return { workSites: data || [], error };
}

export async function listContractorWorkSites(contractorId) {
  if (!supabase || !contractorId) return { workSites: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('work_sites')
    .select('id, status, started_at, quote_id, renovation_projects(title, location)')
    .eq('contractor_id', contractorId)
    .order('started_at', { ascending: false });
  return { workSites: data || [], error };
}

export async function updateWorkSiteStatus(workSiteId, status) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  if (!['active', 'completed', 'suspended'].includes(status)) return { error: new Error('Statut invalide.') };
  const { error } = await supabase.from('work_sites').update({ status }).eq('id', workSiteId);
  return { error };
}

// ---------- Comptes rendus ----------

export async function addSiteReport(workSiteId, authorId, authorRole, { progressNotes, issues, nextActions } = {}) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase.from('site_reports').insert({
    work_site_id: workSiteId,
    author_id: authorId,
    author_role: authorRole,
    progress_notes: progressNotes?.trim() || null,
    issues: issues?.trim() || null,
    next_actions: nextActions?.trim() || null,
  });
  return { error };
}

export async function listSiteReports(workSiteId) {
  if (!supabase) return { reports: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('site_reports')
    .select('id, author_role, progress_notes, issues, next_actions, created_at, profiles(full_name, business_name)')
    .eq('work_site_id', workSiteId)
    .order('created_at', { ascending: false });
  return { reports: data || [], error };
}

// ---------- Actions ----------

export async function addSiteAction(workSiteId, userId, label, dueDate) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase.from('site_actions').insert({
    work_site_id: workSiteId,
    created_by: userId,
    label: label.trim(),
    due_date: dueDate || null,
  });
  return { error };
}

export async function listSiteActions(workSiteId) {
  if (!supabase) return { actions: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('site_actions')
    .select('id, label, due_date, done, created_at')
    .eq('work_site_id', workSiteId)
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });
  return { actions: data || [], error };
}

export async function toggleSiteAction(actionId, done) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase.from('site_actions').update({ done }).eq('id', actionId);
  return { error };
}

// ---------- Comparaison de devis ----------

export async function compareQuotes(briefId) {
  if (!supabase) return { quotes: [], error: new Error('Supabase indisponible.') };
  const { data, error } = await supabase
    .from('quote_comparison')
    .select('*')
    .eq('brief_id', briefId)
    .order('global_amount', { ascending: true });
  return { quotes: data || [], error };
}
