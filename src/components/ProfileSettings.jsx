import { useEffect, useState } from 'react';
import { getMyProfile, registerInDirectory, updateMyProfile } from '../services/company-service';

// Réglages du profil : rôle particulier / entreprise, et inscription à l’annuaire.
export default function ProfileSettings({ session, profile, onProfileChange }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [role, setRole] = useState(profile?.role || 'particulier');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setBusinessName(profile?.business_name || '');
    setRole(profile?.role || 'particulier');
  }, [profile]);

  const save = async (event) => {
    event.preventDefault();
    if (!session?.user) return;
    setSaving(true);
    setMessage('');
    const { error } = await updateMyProfile(session.user.id, { fullName, businessName, role });
    if (error) {
      setMessage(`Enregistrement impossible : ${error.message}`);
      setSaving(false);
      return;
    }
    if (role === 'entreprise') {
      const { error: directoryError } = await registerInDirectory(session.user.id, session.user.email, businessName);
      if (directoryError) {
        setMessage(`Profil enregistré, mais l’annuaire a échoué : ${directoryError.message}`);
        setSaving(false);
        return;
      }
    }
    setMessage('Profil enregistré.');
    setSaving(false);
    const { profile: refreshed } = await getMyProfile(session.user.id);
    onProfileChange?.(refreshed);
  };

  return (
    <section className="v7-step profile-settings">
      <h2>Mon profil</h2>
      <form onSubmit={save} className="profile-form">
        <label>
          Je suis…
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="particulier">Un particulier — je prépare mes travaux</option>
            <option value="entreprise">Une entreprise — je réponds aux demandes</option>
          </select>
        </label>
        <label>
          Nom complet
          <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Prénom Nom" />
        </label>
        {role === 'entreprise' ? (
          <label>
            Nom de l’entreprise
            <input type="text" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ex. BatiPro Rénovation" />
          </label>
        ) : null}
        <button type="submit" className="auth-action" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
        {message ? <small className="auth-message sent">{message}</small> : null}
      </form>
      {role === 'entreprise' ? (
        <p className="profile-hint">Votre e-mail est ajouté à l’annuaire AetherAccess : les particuliers peuvent ainsi vous inviter sur leurs cahiers des charges.</p>
      ) : null}
    </section>
  );
}
