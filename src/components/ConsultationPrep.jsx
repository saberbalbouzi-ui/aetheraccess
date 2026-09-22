import { useState } from 'react';
import { inviteContractor, publishBrief, updateBriefDiffusion } from '../services/company-service';
import { buildInvitationMailto } from '../services/invitation-email';
import RecommendedContractors from './RecommendedContractors';

// Nombre maximal d'entreprises contactées en une seule action (règle anti-spam).
const BULK_INVITE_LIMIT = 10;

// Écran intermédiaire entre le dossier et l'invitation :
// récapitule ce que contient le dossier, publie la consultation,
// puis propose d'abord les entreprises recommandées par le moteur de matching.
// Deux modes de diffusion : sélection manuelle (par défaut) et publication réseau.
export default function ConsultationPrep({ project, session, onPublished, onGoToMissing }) {
  const [brief, setBrief] = useState(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | publishing | inviting | error
  const [message, setMessage] = useState('');
  const [invitedEmails, setInvitedEmails] = useState([]);
  const [invitedIds, setInvitedIds] = useState([]);
  const [networkRadius, setNetworkRadius] = useState(30);
  const [networkDeadline, setNetworkDeadline] = useState('');
  const [networkMax, setNetworkMax] = useState(10);
  const [networkPublished, setNetworkPublished] = useState(false);

  if (!session?.user) {
    return <p className="publish-hint">Connectez-vous pour publier ce dossier et solliciter des entreprises.</p>;
  }
  if (!project?.cloudId) {
    return <p className="publish-hint">Enregistrez d’abord votre projet (bouton « Créer mon dossier projet ») pour préparer la consultation.</p>;
  }

  const activeWorks = (project.suggestions || []).filter((work) => work.status !== 'not-applicable');
  const toVerify = activeWorks.filter((work) => work.status === 'to-check');
  const openMissing = (project.missingInformation || []).filter((item) => item.status === 'open');

  const checklist = [
    { ok: Boolean(project.name || project.projectType), label: 'Description du projet' },
    { ok: Boolean(project.roomIds?.length), label: 'Pièces concernées' },
    { ok: activeWorks.length > 0, label: `Travaux demandés (${activeWorks.length})` },
    { ok: Boolean(project.objectives?.length), label: 'Objectifs' },
    { ok: Boolean(project.location?.city || project.location?.unknown), label: 'Localisation' },
  ];

  const publish = async () => {
    setState('publishing');
    setMessage('');
    const description = `Type : ${project.projectType || 'à préciser'} — Bien : ${project.propertyType || 'à préciser'} — Pièces : ${(project.roomIds || []).join(', ') || 'à préciser'}.`;
    const { brief: published, error } = await publishBrief(project.cloudId, `Consultation — ${project.name || 'Projet de rénovation'}`, description);
    if (error) {
      setState('error');
      setMessage(`Publication impossible : ${error.message}`);
      return;
    }
    setBrief(published);
    setState('idle');
    onPublished?.(published);
  };

  // Envoi commun : invitation en base + e-mail professionnel pré-rempli.
  const sendInvitation = async (targetEmail, contractorId = null) => {
    setState('inviting');
    setMessage('');
    const { error, hint } = await inviteContractor(brief.id, targetEmail);
    if (error) {
      setState('error');
      setMessage(`Invitation impossible : ${error.message}`);
      return false;
    }
    window.location.href = buildInvitationMailto(targetEmail, project, brief.title);
    setInvitedEmails((current) => [...new Set([...current, targetEmail.toLowerCase()])]);
    if (contractorId) setInvitedIds((current) => [...new Set([...current, contractorId])]);
    setState('idle');
    setMessage(hint || 'Invitation enregistrée. Votre messagerie s’est ouverte avec un message pré-rempli à envoyer.');
    return true;
  };

  const inviteByEmail = async (event) => {
    event.preventDefault();
    if (!brief) return;
    const sent = await sendInvitation(email.trim());
    if (sent) setEmail('');
  };

  const inviteRecommended = (contractor) => {
    if (!brief || !contractor.email) return;
    sendInvitation(contractor.email, contractor.user_id);
  };

  // Diffusion contrôlée : plusieurs entreprises d'un coup, avec quota et confirmation
  // explicite (gérée dans RecommendedContractors). Un seul e-mail groupé s'ouvre.
  const inviteBulk = async (contractors) => {
    if (!brief) return;
    const batch = contractors.filter((contractor) => contractor.email).slice(0, BULK_INVITE_LIMIT);
    if (!batch.length) return;
    setState('inviting');
    setMessage('');
    const sentEmails = [];
    for (const contractor of batch) {
      const { error } = await inviteContractor(brief.id, contractor.email);
      if (!error) {
        sentEmails.push(contractor.email.toLowerCase());
        setInvitedIds((current) => [...new Set([...current, contractor.user_id])]);
      }
    }
    if (sentEmails.length) {
      window.location.href = buildInvitationMailto(sentEmails.join(','), project, brief.title);
      setInvitedEmails((current) => [...new Set([...current, ...sentEmails])]);
      setMessage(`${sentEmails.length} invitation${sentEmails.length > 1 ? 's' : ''} enregistrée${sentEmails.length > 1 ? 's' : ''}. Votre messagerie s’est ouverte avec un message groupé pré-rempli à envoyer.`);
    } else {
      setMessage('Ces entreprises sont déjà invitées sur cette consultation.');
    }
    setState('idle');
  };

  // Publication réseau : visible par les entreprises du secteur, avec date d'expiration.
  const publishNetwork = async () => {
    if (!brief) return;
    const confirmed = window.confirm(
      `Publier cette consultation dans le réseau AetherAccess ?\n\n` +
      `Elle sera visible par les entreprises dans un rayon de ${networkRadius} km` +
      `${networkDeadline ? ` jusqu’au ${new Date(`${networkDeadline}T00:00:00`).toLocaleDateString('fr-FR')}` : ''}.\n` +
      'Votre adresse exacte n’est jamais affichée. Confirmer ?',
    );
    if (!confirmed) return;
    setState('publishing');
    setMessage('');
    const { error } = await updateBriefDiffusion(brief.id, {
      visibility: 'network',
      radiusKm: networkRadius,
      deadline: networkDeadline || null,
      maxRecipients: networkMax,
    });
    if (error) {
      setState('error');
      setMessage(`Publication réseau impossible : ${error.message}`);
      return;
    }
    setNetworkPublished(true);
    setState('idle');
    setMessage('Consultation publiée dans le réseau. Les entreprises intéressées se signaleront : vous les inviterez ensuite.');
  };

  return (
    <section className="v7-result">
      <span className="eyebrow">CONSULTATION</span>
      <h1>Préparer la consultation</h1>

      <p>Votre dossier contient :</p>
      <ul className="v7-result-list">
        {checklist.map((item) => (
          <li key={item.label}>{item.ok ? '✓' : '—'} {item.label}</li>
        ))}
        {toVerify.length ? <li>⚠ {toVerify.length} point{toVerify.length > 1 ? 's' : ''} à vérifier avec l’entreprise</li> : null}
        {openMissing.length ? <li>⚠ {openMissing.length} information{openMissing.length > 1 ? 's' : ''} à compléter</li> : null}
      </ul>

      {openMissing.length ? (
        <button type="button" className="dossier-action" onClick={onGoToMissing}>
          🔎 Vérifier les informations manquantes
        </button>
      ) : null}

      {!brief ? (
        <div className="v7-result-actions">
          <button type="button" className="dossier-action primary" onClick={publish} disabled={state === 'publishing'}>
            {state === 'publishing' ? 'Publication…' : 'Trouver les entreprises adaptées'}
          </button>
        </div>
      ) : (
        <div className="reco-on-dark">
          <h2 className="reco-title">Entreprises recommandées pour votre projet</h2>
          <RecommendedContractors
            project={project}
            alreadyInvitedIds={invitedIds}
            alreadyInvitedEmails={invitedEmails}
            onSelect={inviteRecommended}
            onBulkInvite={inviteBulk}
          />

          <div className="network-panel">
            <h2 className="reco-title">Diffuser dans le réseau AetherAccess</h2>
            {networkPublished ? (
              <p className="publish-hint">
                ✓ Consultation visible dans le réseau{networkRadius ? ` — rayon ${networkRadius} km` : ''}
                {networkDeadline ? `, jusqu’au ${new Date(`${networkDeadline}T00:00:00`).toLocaleDateString('fr-FR')}` : ''}.
                Les entreprises intéressées se signalent : vous gardez la main sur les invitations.
              </p>
            ) : (
              <div className="network-form">
                <label>
                  Rayon de diffusion (km)
                  <input type="number" min="5" max="200" value={networkRadius} onChange={(event) => setNetworkRadius(event.target.value)} />
                </label>
                <label>
                  Date limite de réponse (optionnel)
                  <input type="date" value={networkDeadline} onChange={(event) => setNetworkDeadline(event.target.value)} />
                </label>
                <label>
                  Nombre max. d’entreprises contactées
                  <input type="number" min="1" max={BULK_INVITE_LIMIT} value={networkMax} onChange={(event) => setNetworkMax(event.target.value)} />
                </label>
                <button type="button" className="dossier-action" onClick={publishNetwork} disabled={state === 'publishing'}>
                  {state === 'publishing' ? 'Publication…' : 'Publier dans le réseau'}
                </button>
              </div>
            )}
          </div>

          <form className="invite-form invite-form-dark" onSubmit={inviteByEmail}>
            <label htmlFor="prep-invite-email">Vous connaissez déjà une entreprise ?</label>
            <div className="auth-row">
              <input id="prep-invite-email" type="email" required value={email} placeholder="contact@entreprise.fr"
                onChange={(event) => setEmail(event.target.value)} />
              <button type="submit" className="dossier-action" disabled={state === 'inviting'}>
                {state === 'inviting' ? 'Préparation…' : 'Inviter par e-mail'}
              </button>
            </div>
            <small className="publish-hint">Un e-mail professionnel pré-rempli s’ouvrira dans votre messagerie : vous gardez la main sur l’envoi.</small>
          </form>
        </div>
      )}

      {message ? <small className={`dossier-note ${state === 'error' ? 'publish-error' : ''}`}>{message}</small> : null}
    </section>
  );
}
