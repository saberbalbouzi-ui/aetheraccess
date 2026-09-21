import { supabase } from '../lib/supabase';

const BUCKET = 'site-photos';
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// ---------- Photos des comptes rendus ----------

export async function uploadReportPhoto(workSiteId, reportId, file) {
  if (!supabase) return { path: null, error: new Error('Supabase indisponible.') };
  if (!ACCEPTED_TYPES.includes(file.type)) return { path: null, error: new Error('Format non pris en charge (JPG, PNG, WebP ou HEIC).') };
  if (file.size > MAX_SIZE_BYTES) return { path: null, error: new Error('Photo trop lourde (8 Mo maximum).') };

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${workSiteId}/${reportId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  return { path: error ? null : path, error };
}

// URLs signées (1 h) pour afficher les photos d’un compte rendu.
export async function getPhotoUrls(paths = []) {
  if (!supabase || !paths.length) return { urls: [], error: null };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) return { urls: [], error };
  return { urls: (data || []).map((entry) => entry.signedUrl).filter(Boolean), error: null };
}

export async function attachPhotosToReport(reportId, paths) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { data: current, error: readError } = await supabase
    .from('site_reports')
    .select('photos')
    .eq('id', reportId)
    .single();
  if (readError) return { error: readError };
  const { error } = await supabase
    .from('site_reports')
    .update({ photos: [...(current?.photos || []), ...paths] })
    .eq('id', reportId);
  return { error };
}

// ---------- Relances des entreprises ----------

// Invitation sans réponse depuis N jours ?
export function isStaleInvitation(invitation, days = 5) {
  if (invitation.status !== 'invited') return false;
  const reference = invitation.last_reminded_at || invitation.created_at;
  return Date.now() - new Date(reference).getTime() > days * 24 * 3600 * 1000;
}

export async function markReminded(invitationId) {
  if (!supabase) return { error: new Error('Supabase indisponible.') };
  const { error } = await supabase
    .from('brief_contractors')
    .update({ last_reminded_at: new Date().toISOString() })
    .eq('id', invitationId);
  return { error };
}

// Génère un e-mail de relance pré-rempli (mailto) — fiable sans serveur d’envoi.
export function buildReminderMailto(invitation, briefTitle, projectTitle) {
  const recipient = invitation.invited_email || invitation.profiles?.email || '';
  const subject = `Relance — consultation « ${briefTitle} »`;
  const body = [
    'Bonjour,',
    '',
    `Nous vous avons invité à consulter le dossier « ${projectTitle} » sur AetherAccess et nous n’avons pas encore reçu de réponse.`,
    '',
    'Si le projet vous intéresse, connectez-vous à AetherAccess avec cette adresse e-mail pour consulter le dossier et proposer un devis. Sinon, vous pouvez simplement décliner l’invitation.',
    '',
    'Cordialement',
  ].join('\n');
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
