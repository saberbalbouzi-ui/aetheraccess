import { useCallback, useEffect, useState } from 'react';
import { expressInterest, getContractorBrief, listContractorInvitations, listMyQuotes, listNetworkBriefs, markBriefViewed, saveQuote, setInvitationStatus, submitQuote } from '../services/company-service';

const STATUS_LABELS = { draft: 'Brouillon', submitted: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé' };

const INVITATION_STATUS = {
  invited: 'En attente de réponse',
  viewed: 'Consultée',
  interested: 'Intérêt envoyé — en attente d’invitation',
  accepted: 'Acceptée',
  declined: 'Déclinée',
};

function QuoteForm({ briefId, contractorId, existing, onSaved }) {
  const [amount, setAmount] = useState(existing?.global_amount ?? '');
  const [delayWeeks, setDelayWeeks] = useState(existing?.delay_weeks ?? '');
  const [notes, setNotes] = useState(existing?.proposal_notes ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const persist = async (submit) => {
    setSaving(true);
    setMessage('');
    const { quote, error } = await saveQuote(briefId, contractorId, {
      quoteId: existing?.id,
      amount,
      delayWeeks,
      notes,
    });
    if (error) {
      setSaving(false);
      setMessage(`Enregistrement impossible : ${error.message}`);
      return;
    }
    if (submit) {
      const { error: submitError } = await submitQuote(quote.id);
      if (submitError) {
        setSaving(false);
        setMessage(`Envoi impossible : ${submitError.message}`);
        return;
      }
      setMessage('Devis envoyé au particulier.');
    } else {
      setMessage('Brouillon enregistré.');
    }
    setSaving(false);
    onSaved?.();
  };

  return (
    <form className="quote-form" onSubmit={(event) => { event.preventDefault(); persist(false); }}>
      <div className="quote-fields">
        <label>
          Montant global (€)
          <input type="number" min="0" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 12500" />
        </label>
        <label>
          Délai estimé (semaines)
          <input type="number" min="0" step="1" required value={delayWeeks} onChange={(event) => setDelayWeeks(event.target.value)} placeholder="Ex. 6" />
        </label>
      </div>
      <label>
        Notes pour le particulier (prestations, exclusions, conditions)
        <textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Détaillez votre proposition…" />
      </label>
      <div className="dashboard-actions">
        <button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button>
        <button type="button" className="auth-action" disabled={saving} onClick={() => persist(true)}>Envoyer le devis</button>
      </div>
      {message ? <small className="auth-message sent">{message}</small> : null}
    </form>
  );
}

function ContractorBriefView({ briefId, contractorId, existingQuote, onDone }) {
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { dossier: data, error: loadError } = await getContractorBrief(briefId);
    setDossier(data);
    setError(loadError?.message || null);
  }, [briefId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="auth-message error">{error}</p>;
  if (!dossier) return <p>Chargement du dossier…</p>;

  const snapshot = dossier.snapshot || {};

  return (
    <div className="brief-detail contractor-brief">
      <h3>Dossier client</h3>
      <dl className="brief-facts">
        <div><dt>Projet</dt><dd>{dossier.project?.title}</dd></div>
        <div><dt>Bien</dt><dd>{dossier.project?.property_type || 'À préciser'}</dd></div>
        <div><dt>Localisation</dt><dd>{dossier.project?.location || 'À préciser'}</dd></div>
        <div><dt>Type de projet</dt><dd>{snapshot.projectType || 'À préciser'}</dd></div>
      </dl>

      {dossier.rooms.length ? (
        <>
          <h4>Pièces et lots</h4>
          <ul className="invitation-list">
            {dossier.rooms.map((room) => (
              <li key={room.id}>
                <span>{room.room_name}{room.surface ? ` · ≈ ${room.surface} m²` : ''}</span>
                <small>{(room.room_work_items || []).map((item) => item.description).join(' · ') || 'Lots à définir'}</small>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {snapshot.missingInformation?.length ? (
        <>
          <h4>Points à clarifier avec le client</h4>
          <ul className="invitation-list">
            {snapshot.missingInformation.map((item) => <li key={item.id}><span>{item.label}</span></li>)}
          </ul>
        </>
      ) : null}

      <h4>{existingQuote ? `Mon devis (${STATUS_LABELS[existingQuote.status] || existingQuote.status})` : 'Ma proposition de devis'}</h4>
      {existingQuote && existingQuote.status !== 'draft' ? (
        <p className="brief-empty">Montant : {Number(existingQuote.global_amount).toLocaleString('fr-FR')} € · Délai : {existingQuote.delay_weeks} sem. — devis déjà envoyé, modification possible uniquement par le client.</p>
      ) : (
        <QuoteForm briefId={briefId} contractorId={contractorId} existing={existingQuote} onSaved={onDone} />
      )}
    </div>
  );
}

export default function ContractorSpace({ userId, email }) {
  const [invitations, setInvitations] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [networkBriefs, setNetworkBriefs] = useState([]);
  const [openBrief, setOpenBrief] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ invitations: rows }, { quotes: quoteRows }, { briefs: networkRows }] = await Promise.all([
      listContractorInvitations(userId, email),
      listMyQuotes(userId),
      listNetworkBriefs(),
    ]);
    setInvitations(rows);
    setQuotes(quoteRows);
    // Exclut les consultations déjà liées à l'entreprise (invitée, intéressée…).
    const knownBriefIds = new Set(rows.map((row) => row.brief_id));
    setNetworkBriefs((networkRows || []).filter((brief) => !knownBriefIds.has(brief.id)));
    setLoading(false);
  }, [userId, email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const respond = async (invitationId, status) => {
    const { error } = await setInvitationStatus(invitationId, status);
    if (error) {
      setMessage(`Action impossible : ${error.message}`);
      return;
    }
    setMessage(status === 'accepted' ? 'Invitation acceptée. Vous pouvez consulter le dossier et proposer un devis.' : 'Invitation déclinée.');
    refresh();
  };

  // L'entreprise se signale sur une consultation réseau : le particulier décide ensuite.
  const showInterest = async (briefId) => {
    setMessage('');
    const { error, hint } = await expressInterest(briefId, userId);
    if (error) {
      setMessage(`Action impossible : ${error.message}`);
      return;
    }
    setMessage(hint || 'Intérêt envoyé. Le particulier verra votre profil et pourra vous inviter : vous accéderez alors au dossier complet.');
    refresh();
  };

  const toggleDossier = (invitation) => {
    const next = openBrief === invitation.brief_id ? null : invitation.brief_id;
    setOpenBrief(next);
    if (next && !invitation.viewed_at) markBriefViewed(invitation.id);
  };

  const quoteFor = (briefId) => quotes.find((quote) => quote.brief_id === briefId);

  return (
    <section className="v7-step v7-dashboard">
      <div className="dashboard-header">
        <h2>Espace entreprise — demandes reçues</h2>
        <button type="button" className="auth-action" onClick={refresh}>Actualiser</button>
      </div>
      {message ? <p className="auth-message sent">{message}</p> : null}
      {loading ? <p>Chargement…</p> : null}
      {!loading && !invitations.length ? (
        <p>Aucune invitation pour le moment. Les particuliers vous invitent via votre e-mail ({email}).</p>
      ) : null}
      <div className="dashboard-grid">
        {invitations.map((invitation) => {
          const brief = invitation.specification_briefs;
          const quote = quoteFor(invitation.brief_id);
          const canView = invitation.status === 'accepted' && brief?.status === 'published';
          return (
            <article className="dashboard-card brief-card" key={invitation.id}>
              <strong>{brief?.title || 'Consultation'}</strong>
              <small>Reçue le {new Date(invitation.created_at).toLocaleDateString('fr-FR')} · {brief?.status === 'published' ? 'publiée' : brief?.status || '—'}</small>
              <small>Statut : {INVITATION_STATUS[invitation.status] || invitation.status}{quote ? ` · Devis : ${STATUS_LABELS[quote.status] || quote.status}` : ''}</small>
              <div className="dashboard-actions">
                {invitation.status === 'invited' ? (
                  <>
                    <button type="button" onClick={() => respond(invitation.id, 'accepted')}>Accepter</button>
                    <button type="button" className="danger" onClick={() => respond(invitation.id, 'declined')}>Décliner</button>
                  </>
                ) : null}
                {canView ? (
                  <button type="button" onClick={() => toggleDossier(invitation)}>
                    {openBrief === invitation.brief_id ? 'Refermer le dossier' : 'Voir le dossier client'}
                  </button>
                ) : null}
              </div>
              {canView && openBrief === invitation.brief_id ? (
                <ContractorBriefView briefId={invitation.brief_id} contractorId={userId} existingQuote={quote} onDone={refresh} />
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="dashboard-header network-header">
        <h2>Nouvelles consultations du réseau</h2>
      </div>
      {!loading && !networkBriefs.length ? (
        <p className="brief-empty">Aucune consultation réseau en ce moment. Complétez votre fiche (Profil) pour être mieux recommandé.</p>
      ) : null}
      <div className="dashboard-grid">
        {networkBriefs.map((brief) => (
          <article className="dashboard-card brief-card" key={brief.id}>
            <strong>{brief.title}</strong>
            <small>{brief.renovation_projects?.location || 'Localisation communiquée après invitation'} · publiée le {new Date(brief.created_at).toLocaleDateString('fr-FR')}</small>
            {brief.description ? <small>{brief.description}</small> : null}
            {brief.deadline ? <small>⏳ Réponses avant le {new Date(`${brief.deadline}T00:00:00`).toLocaleDateString('fr-FR')}</small> : null}
            <div className="dashboard-actions">
              <button type="button" onClick={() => showInterest(brief.id)}>Je suis intéressé</button>
            </div>
            <small className="comparison-note">Le dossier complet (pièces, lots, détails) est accessible après invitation du particulier.</small>
          </article>
        ))}
      </div>
    </section>
  );
}
