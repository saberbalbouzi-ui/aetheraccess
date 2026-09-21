import { useState } from 'react';
import { publishBrief } from '../services/company-service';

// CTA de publication affiché sous le dossier projet (utilisateur connecté requis).
export default function PublishPanel({ project, session, onPublished }) {
  const [state, setState] = useState('idle'); // idle | publishing | done | error
  const [message, setMessage] = useState('');

  if (!session?.user) {
    return <p className="publish-hint">Connectez-vous pour publier ce dossier et solliciter des entreprises.</p>;
  }
  if (!project?.cloudId) return null;

  const publish = async () => {
    setState('publishing');
    setMessage('');
    const description = `Type : ${project.projectType || 'à préciser'} — Bien : ${project.propertyType || 'à préciser'} — Pièces : ${(project.roomIds || []).join(', ') || 'à préciser'}.`;
    const { brief, error } = await publishBrief(project.cloudId, `Consultation — ${project.name || 'Projet de rénovation'}`, description);
    if (error) {
      setState('error');
      setMessage(`Publication impossible : ${error.message}`);
      return;
    }
    setState('done');
    setMessage('Cahier des charges publié. Retrouvez-le dans l’onglet Consultations pour inviter des entreprises.');
    onPublished?.(brief);
  };

  return (
    <div className="publish-panel">
      <button type="button" className="dossier-action primary" onClick={publish} disabled={state === 'publishing'}>
        {state === 'publishing' ? 'Publication…' : 'Publier en consultation entreprises'}
      </button>
      {message ? <small className={`dossier-note ${state === 'error' ? 'publish-error' : ''}`}>{message}</small> : null}
    </div>
  );
}
