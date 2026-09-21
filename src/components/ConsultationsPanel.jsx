import { useCallback, useEffect, useState } from 'react';
import { decideQuote, inviteContractor, listInvitations, listMyBriefs, listQuotesForBrief } from '../services/company-service';

const QUOTE_STATUS = {
  submitted: 'Reçu',
  accepted: 'Accepté',
  rejected: 'Refusé',
};

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} €`;

function BriefCard({ brief }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [{ invitations: rows }, { quotes: quoteRows }] = await Promise.all([
      listInvitations(brief.id),
      listQuotesForBrief(brief.id),
    ]);
    setInvitations(rows);
    setQuotes(quoteRows);
  }, [brief.id]);

  useEffect(() => {
    if (expanded) refresh();
  }, [expanded, refresh]);

  const invite = async (event) => {
    event.preventDefault();
    setMessage('');
    const { error, hint } = await inviteContractor(brief.id, email);
    if (error) {
      setMessage(`Invitation impossible : ${error.message}`);
      return;
    }
    setEmail('');
    setMessage(hint || 'Invitation envoyée.');
    refresh();
  };

  const decide = async (quoteId, decision) => {
    const { error } = await decideQuote(quoteId, decision);
    if (error) setMessage(`Action impossible : ${error.message}`);
    refresh();
  };

  return (
    <article className="dashboard-card brief-card">
      <strong>{brief.title}</strong>
      <small>{brief.renovation_projects?.title} · {brief.renovation_projects?.location || 'Localisation à préciser'}</small>
      <small>Statut : {brief.status === 'published' ? 'Publié' : brief.status === 'closed' ? 'Clôturé' : 'Brouillon'}</small>
      <div className="dashboard-actions">
        <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Refermer' : 'Gérer'}</button>
      </div>

      {expanded ? (
        <div className="brief-detail">
          <form className="invite-form" onSubmit={invite}>
            <label htmlFor={`invite-${brief.id}`}>Inviter une entreprise par e-mail</label>
            <div className="auth-row">
              <input id={`invite-${brief.id}`} type="email" required value={email} placeholder="contact@entreprise.fr" onChange={(event) => setEmail(event.target.value)} />
              <button type="submit" className="auth-action">Inviter</button>
            </div>
          </form>
          {message ? <small className="auth-message sent">{message}</small> : null}

          <h3>Entreprises invitées</h3>
          {invitations.length ? (
            <ul className="invitation-list">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <span>{invitation.profiles?.business_name || invitation.profiles?.full_name || invitation.invited_email || 'Entreprise'}</span>
                  <small>{invitation.invited_email ? `${invitation.invited_email} · en attente de compte` : invitation.status === 'accepted' ? 'A accepté' : invitation.status === 'declined' ? 'A décliné' : 'Invitée'}</small>
                </li>
              ))}
            </ul>
          ) : <p className="brief-empty">Aucune entreprise invitée pour le moment.</p>}

          <h3>Devis reçus</h3>
          {quotes.length ? (
            <ul className="quote-list">
              {quotes.map((quote) => (
                <li key={quote.id} className={`quote-item quote-${quote.status}`}>
                  <div>
                    <strong>{quote.profiles?.business_name || quote.profiles?.full_name || 'Entreprise'}</strong>
                    <small>{formatAmount(quote.global_amount)} · {quote.delay_weeks} sem. · {QUOTE_STATUS[quote.status] || quote.status}</small>
                    {quote.proposal_notes ? <small>{quote.proposal_notes}</small> : null}
                  </div>
                  {quote.status === 'submitted' ? (
                    <div className="dashboard-actions">
                      <button type="button" onClick={() => decide(quote.id, 'accepted')}>Accepter</button>
                      <button type="button" className="danger" onClick={() => decide(quote.id, 'rejected')}>Refuser</button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : <p className="brief-empty">Aucun devis reçu pour le moment.</p>}
        </div>
      ) : null}
    </article>
  );
}

export default function ConsultationsPanel({ userId }) {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { briefs: rows, error: loadError } = await listMyBriefs(userId);
    setBriefs(rows);
    setError(loadError?.message || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="v7-step v7-dashboard">
      <div className="dashboard-header">
        <h2>Consultations entreprises</h2>
        <button type="button" className="auth-action" onClick={refresh}>Actualiser</button>
      </div>
      {loading ? <p>Chargement…</p> : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      {!loading && !briefs.length ? (
        <p>Aucune consultation publiée. Depuis un projet enregistré, utilisez « Publier en consultation entreprises » sous le dossier.</p>
      ) : null}
      <div className="dashboard-grid">
        {briefs.map((brief) => <BriefCard key={brief.id} brief={brief} />)}
      </div>
    </section>
  );
}
