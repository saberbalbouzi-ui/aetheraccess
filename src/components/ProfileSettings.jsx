import { useEffect, useState } from 'react';
import { getMyProfile, registerInDirectory, updateMyProfile } from '../services/company-service';
import { getMyDirectoryEntry, getPostalCodeCoordinates, updateDirectoryEntry } from '../services/directory-service';

// Réglages du profil : rôle particulier / entreprise, inscription à l’annuaire
// et fiche de recommandation (spécialités, zone, disponibilité) pour le matching.
export default function ProfileSettings({ session, profile, onProfileChange }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [role, setRole] = useState(profile?.role || 'particulier');
  const [specialties, setSpecialties] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [radius, setRadius] = useState(30);
  const [availability, setAvailability] = useState('available');
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setBusinessName(profile?.business_name || '');
    setRole(profile?.role || 'particulier');
  }, [profile]);

  // Fiche annuaire existante : pré-remplit les champs de recommandation.
  useEffect(() => {
    if (role !== 'entreprise' || !session?.user) return;
    getMyDirectoryEntry(session.user.id).then(({ entry }) => {
      if (!entry) return;
      setSpecialties((entry.specialties || []).join(', '));
      setCity(entry.city || '');
      setPostalCode(entry.postal_code || '');
      setRadius(entry.intervention_radius_km || 30);
      setAvailability(entry.availability || 'available');
      setPaused(Boolean(entry.consultation_paused));
    });
  }, [role, session]);

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
      // Position approximative : centre de la commune (code postal), jamais d'adresse exacte.
      const coords = await getPostalCodeCoordinates(postalCode);
      const postalOk = /^\d{5}$/.test(postalCode.trim());
      const { error: updateError } = await updateDirectoryEntry(session.user.id, {
        business_name: businessName,
        specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
        city: city.trim(),
        postal_code: postalCode.trim(),
        department_code: postalOk ? postalCode.trim().slice(0, 2) : undefined,
        intervention_radius_km: Number(radius) || 30,
        availability,
        consultation_paused: paused,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
      if (updateError) {
        setMessage(`Profil enregistré, mais la fiche de recommandation a échoué : ${updateError.message}`);
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
          <>
            <label>
              Nom de l’entreprise
              <input type="text" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ex. BatiPro Rénovation" />
            </label>

            <h3 className="profile-section-title">Fiche de recommandation</h3>
            <label>
              Spécialités (séparées par des virgules)
              <input type="text" value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Ex. plomberie, électricité, carrelage" />
            </label>
            <label>
              Ville
              <input type="text" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex. Cachan" />
            </label>
            <label>
              Code postal
              <input type="text" inputMode="numeric" maxLength={5} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Ex. 94230" />
            </label>
            <label>
              Rayon d’intervention (km)
              <input type="number" min="1" max="300" value={radius} onChange={(event) => setRadius(event.target.value)} />
            </label>
            <label>
              Disponibilité
              <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
                <option value="available">Disponible — j’accepte de nouvelles consultations</option>
                <option value="busy">Disponibilité limitée — charge importante en ce moment</option>
              </select>
            </label>
            <label className="wizard-checkbox">
              <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
              Mettre mes consultations en pause (je n’apparais plus dans les recommandations)
            </label>
          </>
        ) : null}
        <button type="submit" className="auth-action" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
        {message ? <small className="auth-message sent">{message}</small> : null}
      </form>
      {role === 'entreprise' ? (
        <p className="profile-hint">
          Ces informations alimentent le moteur de recommandation : plus votre fiche est complète, mieux vous serez classé auprès des particuliers.
          Seule votre commune est utilisée pour la distance — jamais votre adresse exacte. Vous pouvez mettre en pause à tout moment.
        </p>
      ) : null}
    </section>
  );
}
