import { useState } from 'react';
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

export default function AuthPanel({ session, profile }) {
  const [mode, setMode] = useState(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

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
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setState('error');
      setMessage(`Connexion impossible : ${error.message}`);
    } else {
      if (mode) localStorage.setItem(SIGNUP_ROLE_KEY, mode);
      setState('sent');
      setMessage('Lien envoyé. Vérifiez votre boîte mail pour vous connecter.');
    }
  };

  if (!mode) {
    return (
      <section className="access-landing">
        <h2>Bienvenue sur AetherAccess</h2>
        <p>Choisissez votre accès pour continuer :</p>
        <div className="access-grid">
          {Object.entries(ACCESS_MODES).map(([id, access]) => (
            <button key={id} type="button" className={`access-card access-${id}`} onClick={() => setMode(id)}>
              <strong>{access.title}</strong>
              <span>{access.description}</span>
              <span className="access-cta">Continuer →</span>
            </button>
          ))}
        </div>
      </section>
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
