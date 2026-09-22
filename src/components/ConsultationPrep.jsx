import { useState } from 'react';
import { inviteContractor, publishBrief } from '../services/company-service';
import { buildInvitationMailto } from '../services/invitation-email';
import RecommendedContractors from './RecommendedContractors';

// Écran intermédiaire entre le dossier et l'invitation :
// récapitule ce que contient le dossier, publie la consultation,
// puis propose d'abord les entreprises recommandées par le moteur de matching.
export default function ConsultationPrep({ project, session, onPublished, onGoToMissing }) {
  const [brief, setBrief] = useState(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | publishing | inviting | error
  const [message, setMessage] = useState('');
  const [invitedEmails, setInvitedEmails] = useState([]);
  const [invitedIds, setInvitedIds] = useState([]);

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
          />

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
