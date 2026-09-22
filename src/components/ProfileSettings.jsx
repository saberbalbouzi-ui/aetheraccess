import { useEffect, useState } from 'react';
import { getMyProfile, registerInDirectory, updateMyProfile } from '../services/company-service';
import { getCommuneCoordinates, getMyDirectoryEntry, getPostalCodeCoordinates, updateDirectoryEntry } from '../services/directory-service';
import { SPECIALTY_GROUPS } from '../data/specialties';
import LocationSelector from './LocationSelector';

// Correspondances simples entre anciens libellés saisis à la main et le catalogue.
const SPECIALTY_ALIASES = [
  [/plomb/i, 'Plomberie'],
  [/electr/i, 'Électricité'],
  [/carrel/i, 'Carrelage / faïence'],
  [/peint/i, 'Peinture'],
  [/menuis/i, 'Menuiseries'],
  [/macon|maçon/i, 'Maçonnerie / reprises'],
  [/couvert|toit/i, 'Toiture / étanchéité extérieure'],
  [/chauff/i, 'Chauffage'],
  [/isolat/i, 'Isolation'],
  [/salle de bain|sanitair/i, 'Sanitaires'],
  [/cuisin/i, 'Cuisine'],
  [/complet|general|général|tous corps/i, 'Rénovation complète'],
  [/sol|parquet/i, 'Sols / parquet'],
  [/ventil/i, 'Ventilation'],
  [/facad|façad/i, 'Façade'],
];

const ALL_SPECIALTIES = SPECIALTY_GROUPS.flatMap((group) => group.labels);

function normalizeSpecialty(label) {
  const exact = ALL_SPECIALTIES.find((item) => item.toLowerCase() === (label || '').toLowerCase());
  if (exact) return exact;
  const alias = SPECIALTY_ALIASES.find(([pattern]) => pattern.test(label));
  return alias ? alias[1] : null;
}

// Réglages du profil : rôle particulier / entreprise, inscription à l’annuaire
// et fiche de recommandation (spécialités, zone, disponibilité) pour le matching.
export default function ProfileSettings({ session, profile, onProfileChange }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [role, setRole] = useState(profile?.role || 'particulier');
  const [specialties, setSpecialties] = useState([]);
  const [location, setLocation] = useState({});
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
      // Convertit les anciens libellés (texte libre) vers le catalogue.
      setSpecialties((entry.specialties || []).map(normalizeSpecialty).filter(Boolean));
      setLocation({
        city: entry.city || '',
        postalCode: entry.postal_code || '',
        departmentCode: entry.department_code || '',
      });
      setRadius(entry.intervention_radius_km || 30);
      setAvailability(entry.availability || 'available');
      setPaused(Boolean(entry.consultation_paused));
    });
  }, [role, session]);

  const toggleSpecialty = (label) => {
    setSpecialties((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  };

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
      // Position approximative : centre de la commune, jamais d'adresse exacte.
      let coords = location.cityCode
        ? await getCommuneCoordinates(location.departmentCode, location.cityCode)
        : await getPostalCodeCoordinates(location.postalCode);
      const { error: updateError } = await updateDirectoryEntry(session.user.id, {
        business_name: businessName,
        specialties,
        city: location.city || '',
        postal_code: location.postalCode || '',
        department_code: location.departmentCode || (location.postalCode ? location.postalCode.slice(0, 2) : undefined),
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
        {profile?.role ? (
          // Rôle déjà défini : affichage en lecture seule, pas de bascule accidentelle.
          <p className="profile-role-fixed">
            {role === 'entreprise'
              ? 'Compte entreprise — vous répondez aux demandes des particuliers.'
              : 'Compte particulier — vous préparez vos travaux.'}
          </p>
        ) : (
          <label>
            Je suis…
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="particulier">Un particulier — je prépare mes travaux</option>
              <option value="entreprise">Une entreprise — je réponds aux demandes</option>
            </select>
          </label>
        )}
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
            <fieldset className="wizard-features">
              <legend>Spécialités — cochez celles qui correspondent à vos interventions</legend>
              {SPECIALTY_GROUPS.map((group) => (
                <div key={group.category} className="specialty-group">
                  <small className="specialty-category">{group.category}</small>
                  {group.labels.map((label) => (
                    <label key={label} className="wizard-checkbox">
                      <input
                        type="checkbox"
                        checked={specialties.includes(label)}
                        onChange={() => toggleSpecialty(label)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ))}
            </fieldset>

            <div className="profile-location">
              <small className="specialty-category">Ville d’intervention</small>
              <LocationSelector value={location} onChange={setLocation} />
            </div>

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
