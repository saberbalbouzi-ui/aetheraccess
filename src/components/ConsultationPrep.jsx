import { useState } from 'react';
import { inviteContractor, publishBrief } from '../services/company-service';
import { buildInvitationMailto } from '../services/invitation-email';

// Écran intermédiaire entre le dossier et l'invitation :
// récapitule ce que contient le dossier, publie la consultation,
// puis prépare un e-mail professionnel pré-rempli pour chaque entreprise.
export default function ConsultationPrep({ project, session, onPublished, onGoToMissing }) {
  const [brief, setBrief] = useState(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | publishing | inviting | error
  const [message, setMessage] = useState('');

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

  const invite = async (event) => {
    event.preventDefault();
    if (!brief) return;
    setState('inviting');
    setMessage('');
    const { error, hint } = await inviteContractor(brief.id, email);
    if (error) {
      setState('error');
      setMessage(`Invitation impossible : ${error.message}`);
      return;
    }
    // Ouvre l'e-mail pré-rempli dans le client de l'utilisateur : il garde la main sur l'envoi.
    window.location.href = buildInvitationMailto(email, project, brief.title);
    setEmail('');
    setState('idle');
    setMessage(hint || 'Invitation enregistrée. Votre messagerie s’est ouverte avec un message pré-rempli à envoyer.');
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
            {state === 'publishing' ? 'Publication…' : 'Publier la consultation'}
          </button>
        </div>
      ) : (
        <>
          <p className="v7-result-hint">Consultation publiée ✓ — invitez maintenant des entreprises :</p>
          <form className="invite-form invite-form-dark" onSubmit={invite}>
            <label htmlFor="prep-invite-email">Entreprises à consulter</label>
            <div className="auth-row">
              <input id="prep-invite-email" type="email" required value={email} placeholder="contact@entreprise.fr"
                onChange={(event) => setEmail(event.target.value)} />
              <button type="submit" className="dossier-action primary" disabled={state === 'inviting'}>
                {state === 'inviting' ? 'Préparation…' : '+ Inviter une entreprise'}
              </button>
            </div>
            <small className="publish-hint">Un e-mail professionnel pré-rempli s’ouvrira dans votre messagerie : vous gardez la main sur l’envoi.</small>
          </form>
        </>
      )}

      {message ? <small className={`dossier-note ${state === 'error' ? 'publish-error' : ''}`}>{message}</small> : null}
    </section>
  );
}
