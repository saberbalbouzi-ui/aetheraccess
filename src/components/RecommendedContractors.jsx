import { useEffect, useMemo, useState } from 'react';
import { recommendContractors } from '../services/directory-service';

const AVAILABILITY_LABELS = {
  available: 'Disponible',
  busy: 'Disponibilité limitée',
};

function locationHeadline(location = {}) {
  if (location.city) {
    const place = location.postalCode ? `${location.city} (${location.postalCode})` : location.city;
    return location.departmentName ? `${place} — ${location.departmentName}` : place;
  }
  if (location.departmentName) return location.departmentName;
  return 'Localisation à préciser';
}

// « Entreprises recommandées pour votre projet » — affichées AVANT l'invitation par e-mail.
// Le particulier voit d'abord les entreprises adaptées, puis choisit.
// Si onBulkInvite est fourni : sélection multiple possible (diffusion contrôlée,
// toujours avec confirmation explicite avant tout envoi).
export default function RecommendedContractors({ project, alreadyInvitedIds = [], alreadyInvitedEmails = [], onSelect, onBulkInvite, onViewProfile }) {
  const [recommendations, setRecommendations] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('loading'); // loading | ready | empty | error
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    recommendContractors(project).then(({ recommendations: rows, total: count, error }) => {
      if (cancelled) return;
      if (error) {
        setState('error');
        return;
      }
      setRecommendations(rows);
      setTotal(count || rows.length);
      setState(rows.length ? 'ready' : 'empty');
    });
    return () => { cancelled = true; };
  }, [project]);

  const invitedIds = useMemo(() => new Set(alreadyInvitedIds), [alreadyInvitedIds]);
  const invitedEmails = useMemo(() => new Set(alreadyInvitedEmails.map((mail) => (mail || '').toLowerCase())), [alreadyInvitedEmails]);

  const isInvited = (contractor) =>
    invitedIds.has(contractor.user_id) || invitedEmails.has((contractor.email || '').toLowerCase());

  const toggle = (contractor) => {
    setSelected((current) =>
      current.some((item) => item.user_id === contractor.user_id)
        ? current.filter((item) => item.user_id !== contractor.user_id)
        : [...current, contractor],
    );
  };

  const bulkInvite = () => {
    if (!selected.length || !onBulkInvite) return;
    const names = selected.map((contractor) => contractor.business_name || contractor.email).join(', ');
    const confirmed = window.confirm(
      `Vous allez inviter ${selected.length} entreprise${selected.length > 1 ? 's' : ''} : ${names}.\n\n` +
      'Votre messagerie s’ouvrira avec un e-mail professionnel pré-rempli : l’envoi reste entre vos mains. Confirmer ?',
    );
    if (!confirmed) return;
    onBulkInvite(selected);
    setSelected([]);
  };

  if (state === 'loading') {
    return <p className="reco-status">Recherche des entreprises compatibles…</p>;
  }
  if (state === 'error') {
    return <p className="auth-message error">Recommandations indisponibles pour le moment — vous pouvez toujours inviter une entreprise par e-mail ci-dessous.</p>;
  }
  if (state === 'empty') {
    return (
      <p className="reco-status">
        Aucune entreprise inscrite dans le réseau pour le moment. Invitez directement une entreprise par e-mail ci-dessous — elle retrouvera votre dossier à sa première connexion.
      </p>
    );
  }

  return (
    <div className="reco-panel">
      <p className="reco-headline">
        Projet situé à : <strong>{locationHeadline(project.location)}</strong><br />
        Nous avons trouvé {total} entreprise{total > 1 ? 's' : ''} compatible{total > 1 ? 's' : ''} dans votre secteur.
      </p>
      <ul className="reco-list">
        {recommendations.map((contractor, index) => {
          const invited = isInvited(contractor);
          const checked = selected.some((item) => item.user_id === contractor.user_id);
          return (
            <li key={contractor.user_id} className="reco-card">
              {onBulkInvite ? (
                <input
                  type="checkbox"
                  className="reco-check"
                  checked={checked}
                  disabled={invited || !contractor.email}
                  aria-label={`Sélectionner ${contractor.business_name || 'cette entreprise'}`}
                  onChange={() => toggle(contractor)}
                />
              ) : null}
              <div className="reco-card-main">
                <strong>
                  {index + 1}. {contractor.business_name || 'Entreprise'}
                  {contractor.verified ? <span className="reco-verified" title="Profil vérifié">✓ vérifié</span> : null}
                </strong>
                <small>
                  {contractor.city || 'Localisation non précisée'}
                  {contractor.distanceKm != null ? ` · ${contractor.distanceKm} km` : ''}
                  {contractor.availability ? ` · ${AVAILABILITY_LABELS[contractor.availability] || contractor.availability}` : ''}
                </small>
                {contractor.specialties?.length ? (
                  <small className="reco-specialties">{contractor.specialties.slice(0, 4).join(' · ')}</small>
                ) : null}
              </div>
              <div className="reco-card-actions">
                <button type="button" className="work-lot-btn" onClick={() => onViewProfile?.(contractor)}>
                  Voir le profil
                </button>
                <button
                  type="button"
                  className={invited ? 'work-lot-btn restore' : 'work-lot-btn confirm'}
                  disabled={invited}
                  onClick={() => onSelect(contractor)}
                >
                  {invited ? 'Invitée ✓' : 'Sélectionner'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {onBulkInvite ? (
        <div className="reco-bulk-bar">
          <span>{selected.length ? `${selected.length} entreprise${selected.length > 1 ? 's' : ''} sélectionnée${selected.length > 1 ? 's' : ''}` : 'Cochez les entreprises à inviter'}</span>
          <button type="button" className="auth-action" disabled={!selected.length} onClick={bulkInvite}>
            Inviter la sélection
          </button>
        </div>
      ) : null}
      <p className="comparison-note">
        Classement indicatif basé sur la compatibilité avec vos travaux, la proximité, la zone d’intervention et la disponibilité déclarée. Il ne préjuge pas de la qualité des entreprises : le choix vous appartient.
      </p>
    </div>
  );
}
