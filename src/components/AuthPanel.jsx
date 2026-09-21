import { useEffect, useState } from 'react';
import { sendMagicLink, signOut } from '../services/auth-service';
import { supabaseConfigured } from '../lib/supabase';

// Clé localStorage : intention de rôle choisie sur l'écran d'accueil,
// appliquée au profil après la première connexion (voir App.jsx).
export const SIGNUP_ROLE_KEY = 'aetheraccess_signup_role';

const ACCESS_MODES = {
  particulier: {
    title: 'Je suis un particulier',
    description: 'Je prépare mes travaux, je génère mon cahier des charges et je consulte des entreprises.',
    formLabel: 'Recevez votre lien de connexion pour ouvrir votre espace particulier.',
  },
  entreprise: {
    title: 'Je suis une entreprise',
    description: 'Je consulte les cahiers des charges, j’envoie mes devis et je suis mes chantiers.',
    formLabel: 'Recevez votre lien de connexion pour ouvrir votre espace entreprise.',
  },
};

const PLATFORM_STEPS = [
  {
    title: 'Décrivez votre projet',
    text: 'Un assistant guidé transforme vos réponses en cahier des charges clair, structuré et exportable (PDF, DOCX).',
  },
  {
    title: 'Consultez les entreprises',
    text: 'Publiez votre cahier des charges, invitez des professionnels et recevez leurs devis détaillés.',
  },
  {
    title: 'Suivez le chantier',
    text: 'Comparez les offres, choisissez votre entreprise et suivez l’avancement avec comptes rendus et photos.',
  },
];

// Détecte un retour d'erreur Supabase dans l'URL (ex. lien expiré ou déjà utilisé)
// et nettoie le hash pour ne pas garder #error=access_denied dans la barre d'adresse.
function readAuthUrlError() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash.includes('error')) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.get('error')) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return params.get('error_code') === 'otp_expired'
    ? 'Ce lien de connexion a expiré ou a déjà été utilisé. Redemandez un lien ci-dessous et ouvrez le message le plus récent.'
    : 'Connexion impossible. Redemandez un lien ci-dessous.';
}

export default function AuthPanel({ session, profile }) {
  const [mode, setMode] = useState(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const [urlError, setUrlError] = useState(null);

  useEffect(() => {
    setUrlError(readAuthUrlError());
  }, []);

  if (!supabaseConfigured) {
    return <p className="auth-panel auth-offline">Sauvegarde locale uniquement — Supabase non configuré.</p>;
  }

  if (session?.user) {
    return (
      <div className="auth-panel auth-connected">
        <span className="auth-email">
          {session.user.email}
          {profile?.role ? (
            <span className="auth-role-badge">{profile.role === 'entreprise' ? 'Accès entreprise' : 'Accès particulier'}</span>
          ) : null}
        </span>
        <button type="button" className="auth-action" onClick={() => signOut()}>Se déconnecter</button>
      </div>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setMessage('');
    setUrlError(null);
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setState('error');
      setMessage(`Connexion impossible : ${error.message}`);
    } else {
      if (mode) localStorage.setItem(SIGNUP_ROLE_KEY, mode);
      setState('sent');
      setMessage('Lien envoyé. Vérifiez votre boîte mail et ouvrez le message le plus récent.');
    }
  };

  const errorBanner = urlError ? <p className="auth-url-error">{urlError}</p> : null;

  if (!mode) {
    return (
      <div className="access-landing">
        {errorBanner}
        <section className="access-hero">
          <span className="eyebrow">AETHERACCESS</span>
          <h1>Vos travaux, du projet au chantier.</h1>
          <p>
            AetherAccess accompagne particuliers et entreprises de rénovation :
            cahier des charges guidé, mise en relation, devis comparés et suivi de chantier.
          </p>
        </section>

        <div className="access-grid">
          {Object.entries(ACCESS_MODES).map(([id, access]) => (
            <button key={id} type="button" className={`access-card access-${id}`} onClick={() => setMode(id)}>
              <strong>{access.title}</strong>
              <span>{access.description}</span>
              <span className="access-cta">Continuer →</span>
            </button>
          ))}
        </div>

        <section className="platform-steps">
          <h2>Comment ça marche ?</h2>
          <div className="platform-steps-grid">
            {PLATFORM_STEPS.map((step, index) => (
              <article key={step.title} className="platform-step">
                <span className="platform-step-number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const current = ACCESS_MODES[mode];
  return (
    <form className="auth-panel" onSubmit={submit}>
      <button
        type="button"
        className="auth-back"
        onClick={() => { setMode(null); setMessage(''); setState('idle'); }}
      >
        ← Changer d’accès
      </button>
      <span className="auth-mode-badge">{current.title}</span>
      {errorBanner}
      <label htmlFor="auth-email">{current.formLabel}</label>
      <div className="auth-row">
        <input
          id="auth-email"
          type="email"
          required
          value={email}
          placeholder="vous@exemple.fr"
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="auth-action" disabled={state === 'sending'}>
          {state === 'sending' ? 'Envoi…' : 'Recevoir mon lien'}
        </button>
      </div>
      {message ? <small className={`auth-message ${state}`}>{message}</small> : null}
    </form>
  );
}
