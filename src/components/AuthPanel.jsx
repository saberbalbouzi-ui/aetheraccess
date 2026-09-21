import { useState } from 'react';
import { sendMagicLink, signOut } from '../services/auth-service';
import { supabaseConfigured } from '../lib/supabase';

export default function AuthPanel({ session }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  if (!supabaseConfigured) {
    return <p className="auth-panel auth-offline">Sauvegarde locale uniquement — Supabase non configuré.</p>;
  }

  if (session?.user) {
    return (
      <div className="auth-panel auth-connected">
        <span className="auth-email">{session.user.email}</span>
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
      setState('sent');
      setMessage('Lien envoyé. Vérifiez votre boîte mail pour vous connecter.');
    }
  };

  return (
    <form className="auth-panel" onSubmit={submit}>
      <label htmlFor="auth-email">Connectez-vous pour enregistrer vos projets dans votre espace</label>
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
