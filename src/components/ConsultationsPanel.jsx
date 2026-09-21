import { useCallback, useEffect, useState } from 'react';
import { decideQuote, inviteContractor, listInvitations, listQuotesForBrief, listMyBriefs } from '../services/company-service';
import { compareQuotes, openWorkSite } from '../services/site-service';
import { buildReminderMailto, isStaleInvitation, markReminded } from '../services/photo-service';

const QUOTE_STATUS = {
  submitted: 'Reçu',
  accepted: 'Accepté',
  rejected: 'Refusé',
};

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} €`;
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Tableau de comparaison structurée des devis d’un cahier des charges.
function QuoteComparison({ briefId }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    compareQuotes(briefId).then(({ quotes, error: loadError }) => {
      setRows(quotes);
      setError(loadError?.message || null);
    });
  }, [briefId]);

  if (error) return <p className="auth-message error">{error}</p>;
  if (!rows.length) return <p className="brief-empty">Aucun devis à comparer pour le moment.</p>;

  const amounts = rows.map((row) => Number(row.global_amount));
  const delays = rows.map((row) => Number(row.delay_weeks));
  const minAmount = Math.min(...amounts);
  const minDelay = Math.min(...delays);

  return (
    <div className="comparison-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Entreprise</th>
            <th>Montant</th>
            <th>Délai</th>
            <th>Postes chiffrés</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.quote_id} className={row.status === 'accepted' ? 'quote-accepted' : ''}>
              <td>{row.contractor_name}</td>
              <td>
                {formatAmount(row.global_amount)}
                {Number(row.global_amount) === minAmount && rows.length > 1 ? <span className="comparison-flag">le moins cher</span> : null}
              </td>
              <td>
                {row.delay_weeks} sem.
                {Number(row.delay_weeks) === minDelay && rows.length > 1 ? <span className="comparison-flag">le plus rapide</span> : null}
              </td>
              <td>{row.items_count > 0 ? `${row.items_count} (${formatAmount(row.items_total)})` : '—'}</td>
              <td>{QUOTE_STATUS[row.status] || row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="comparison-note">Cette grille met en évidence les montants et délais saisis ; elle ne désigne pas automatiquement la meilleure offre. Prestations, exclusions et garanties restent à comparer.</p>
    </div>
  );
}

function BriefCard({ brief }) {
  const [expanded, setExpanded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
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

  const decide = async (quote, decision) => {
    const { error } = await decideQuote(quote.id, decision);
    if (error) {
      setMessage(`Action impossible : ${error.message}`);
      return;
    }
    if (decision === 'accepted') {
      const projectId = brief.renovation_projects?.id || brief.project_id;
      const { error: siteError } = await openWorkSite(projectId, quote.id, quote.contractor_id);
      if (siteError) {
        setMessage(`Devis accepté, mais l’ouverture du chantier a échoué : ${siteError.message}`);
        refresh();
        return;
      }
      setMessage('Devis accepté — le chantier est ouvert dans l’onglet Chantiers.');
    }
    refresh();
  };

  // Relance : ouvre un e-mail pré-rempli et horodate la relance.
  const remind = (invitation) => {
    const projectTitle = brief.renovation_projects?.title || 'Projet de rénovation';
    window.location.href = buildReminderMailto(invitation, brief.title, projectTitle);
    markReminded(invitation.id).then(() => refresh());
  };

  return (
    <article className="dashboard-card brief-card">
      <strong>{brief.title}</strong>
      <small>{brief.renovation_projects?.title} · {brief.renovation_projects?.location || 'Localisation à préciser'}</small>
      <small>Statut : {brief.status === 'published' ? 'Publié' : brief.status === 'closed' ? 'Clôturé' : 'Brouillon'}</small>
      <div className="dashboard-actions">
        <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Refermer' : 'Gérer'}</button>
        <button type="button" onClick={() => { setShowComparison((value) => !value); setExpanded(true); }}>
          {showComparison ? 'Masquer la comparaison' : 'Comparer les devis'}
        </button>
      </div>

      {expanded ? (
        <div className="brief-detail">
          {showComparison ? (
            <>
              <h3>Comparaison des devis</h3>
              <QuoteComparison briefId={brief.id} />
            </>
          ) : null}

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
              {invitations.map((invitation) => {
                const stale = isStaleInvitation(invitation);
                return (
                  <li key={invitation.id} className={stale ? 'invitation-stale' : ''}>
                    <span>{invitation.profiles?.business_name || invitation.profiles?.full_name || invitation.invited_email || 'Entreprise'}</span>
                    <small>
                      {invitation.invited_email ? `${invitation.invited_email} · en attente de compte` : invitation.status === 'accepted' ? 'A accepté' : invitation.status === 'declined' ? 'A décliné' : 'Invitée'}
                      {invitation.last_reminded_at ? ` · relancée le ${formatDate(invitation.last_reminded_at)}` : ''}
                    </small>
                    {stale ? (
                      <button type="button" className="remind-action" onClick={() => remind(invitation)}>Relancer</button>
                    ) : null}
                  </li>
                );
              })}
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
                      <button type="button" onClick={() => decide(quote, 'accepted')}>Accepter</button>
                      <button type="button" className="danger" onClick={() => decide(quote, 'rejected')}>Refuser</button>
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
