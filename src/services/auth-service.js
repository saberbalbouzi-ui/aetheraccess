import { supabase, supabaseConfigured } from '../lib/supabase';

export function isCloudAvailable() {
  return supabaseConfigured;
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('AetherAccess — lecture de session impossible :', error.message);
    return null;
  }
  return data.session ?? null;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data?.subscription?.unsubscribe();
}

export async function sendMagicLink(email) {
  if (!supabase) return { error: new Error('Supabase n’est pas configuré.') };
  const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: true },
  });
  return { error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
