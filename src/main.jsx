import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseConfigured } from './lib/supabase';
import './styles.css';

const tools = [
  ['Brief projet', 'Transformez une demande client imprécise en programme de rénovation clair et exploitable.'],
  ['Demande de devis', 'Préparez une demande structurée à envoyer aux artisans et entreprises.'],
  ['Descriptif par lot', 'Organisez les travaux par lots : démolition, plomberie, électricité, revêtements et finitions.'],
  ['Messages clients', 'Rédigez des réponses, relances et comptes rendus professionnels en quelques instants.'],
];

const initialBrief = { title: '', propertyType: 'Appartement', surface: '', location: '', objectives: '', condition: '', scope: '', constraints: '', recommendations: '' };

function BriefBuilder() {
  const [brief, setBrief] = useState(initialBrief);
  const [saved, setSaved] = useState(false);
  const update = (key, value) => { setSaved(false); setBrief((current) => ({ ...current, [key]: value })); };
  const saveBrief = () => {
    const content = `BRIEF DE RÉNOVATION\n\nProjet : ${brief.title || 'Sans titre'}\nType de bien : ${brief.propertyType}\nSurface : ${brief.surface || 'À préciser'} m²\nLocalisation : ${brief.location || 'À préciser'}\n\nOBJECTIFS\n${brief.objectives || 'À préciser'}\n\nÉTAT EXISTANT\n${brief.condition || 'À préciser'}\n\nPÉRIMÈTRE DES TRAVAUX\n${brief.scope || 'À préciser'}\n\nCONTRAINTES\n${brief.constraints || 'À préciser'}\n\nRECOMMANDATIONS\n${brief.recommendations || 'À compléter après visite.'}`;
    localStorage.setItem('aetheraccess_last_brief', content);
    setSaved(true);
  };
  return <section className="builder wrap" id="outil">
    <div className="builder-head"><div><span className="eyebrow">OUTIL BÊTA · SANS IA EXTERNE</span><h2>Créez votre premier brief de rénovation.</h2><p>Renseignez les informations essentielles puis exportez un document structuré. Vous gardez le contrôle de chaque contenu.</p></div><span className="beta-pill">V1 BÊTA</span></div>
    <div className="form-grid">
      <label>Nom du projet<input value={brief.title} onChange={(e) => update('title', e.target.value)} placeholder="Ex. Rénovation appartement T3" /></label>
      <label>Type de bien<select value={brief.propertyType} onChange={(e) => update('propertyType', e.target.value)}><option>Appartement</option><option>Maison</option><option>Local professionnel</option><option>Autre</option></select></label>
      <label>Surface (m²)<input type="number" min="0" value={brief.surface} onChange={(e) => update('surface', e.target.value)} placeholder="68" /></label>
      <label>Localisation<input value={brief.location} onChange={(e) => update('location', e.target.value)} placeholder="Ville / quartier" /></label>
      <label className="wide">Objectifs du projet<textarea value={brief.objectives} onChange={(e) => update('objectives', e.target.value)} placeholder="Que souhaitez-vous améliorer ?" /></label>
      <label className="wide">État existant<textarea value={brief.condition} onChange={(e) => update('condition', e.target.value)} placeholder="Décrivez l’état actuel du bien." /></label>
      <label className="wide">Périmètre des travaux<textarea value={brief.scope} onChange={(e) => update('scope', e.target.value)} placeholder="Pièces, lots, travaux envisagés..." /></label>
      <label>Contraintes<textarea value={brief.constraints} onChange={(e) => update('constraints', e.target.value)} placeholder="Budget, délais, occupation..." /></label>
      <label>Recommandations<textarea value={brief.recommendations} onChange={(e) => update('recommendations', e.target.value)} placeholder="Premières idées ou points de vigilance." /></label>
    </div>
    <div className="builder-actions"><button className="button primary" onClick={saveBrief}>Enregistrer le brief <span>→</span></button>{saved && <span className="success">Brief enregistré dans ce navigateur.</span>}</div>
  </section>;
}

function Waitlist() {
  const [form, setForm] = useState({ full_name: '', email: '', profession: '', primary_need: '' });
  const [state, setState] = useState({ kind: 'idle', message: '' });
  const submit = async (event) => {
    event.preventDefault();
    setState({ kind: 'loading', message: '' });
    if (!supabaseConfigured || !supabase) {
      setState({ kind: 'error', message: 'Configuration Supabase absente dans le build Vercel.' });
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      profession: form.profession.trim() || null,
      primary_need: form.primary_need.trim() || null,
    };
    const { error } = await supabase.from('beta_waitlist').insert(payload);
    if (!error) {
      setState({ kind: 'success', message: 'Votre demande a bien été enregistrée.' });
      setForm({ full_name: '', email: '', profession: '', primary_need: '' });
      return;
    }
    if (error.code === '23505') {
      setState({ kind: 'info', message: 'Cet e-mail est déjà inscrit.' });
      return;
    }
    setState({ kind: 'error', message: `Erreur Supabase (${error.code || 'sans code'}): ${error.message}` });
  };
  return <div className="waitlist-box"><span className="eyebrow">ACCÈS BÊTA</span><h2>Recevez une invitation.</h2><p>Décrivez votre activité : nous vous contacterons pour tester les premiers outils.</p><form onSubmit={submit}><input required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nom complet" /><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail professionnel" /><input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} placeholder="Métier" /><textarea value={form.primary_need} onChange={(e) => setForm({ ...form, primary_need: e.target.value })} placeholder="Quel outil vous ferait gagner le plus de temps ?" /><button className="button light" disabled={state.kind === 'loading'}>{state.kind === 'loading' ? 'Envoi...' : 'Rejoindre la bêta'} <span>→</span></button></form>{state.message && <p className={`form-message ${state.kind}`}>{state.message}</p>}</div>;
}

function App() {
  return <main><nav className="nav wrap"><a className="brand" href="#top"><span>A</span>etherAccess</a><div className="nav-actions"><a className="nav-link" href="#outil">Tester l’outil</a><a className="nav-link" href="#beta">Accès bêta</a></div></nav><section id="top" className="hero wrap"><div className="eyebrow">POUR LA RÉNOVATION & L'AMÉNAGEMENT</div><h1>Vos projets mieux structurés.<br /><em>Vos clients mieux servis.</em></h1><p className="hero-copy">AetherAccess Rénovation est l’assistant de travail conçu pour les artisans, décorateurs et petites entreprises : transformez une idée ou une demande client en livrables clairs, rapidement.</p><div className="actions"><a className="button primary" href="#outil">Essayer le brief <span>→</span></a><a className="button ghost" href="#fonctionnalites">Découvrir les outils</a></div><p className="note">V1 bêta · Sans paiement · Sans appel IA externe · Pensé pour les professionnels francophones</p><div className="project-card"><div className="card-top"><span className="dot"></span><span>PROJET · APPARTEMENT T3</span><span className="status">BRIEF STRUCTURÉ</span></div><div className="card-content"><div><small>OBJECTIF</small><strong>Rénover et optimiser un T3 de 68 m²</strong></div><div><small>LOT PRIORITAIRE</small><strong>Cuisine, salle de bains, électricité</strong></div><div><small>PROCHAINE ÉTAPE</small><strong>Préparer une demande de devis</strong></div></div></div></section><section id="fonctionnalites" className="section dark"><div className="wrap"><div className="section-intro"><span className="eyebrow">UNE MÉTHODE, PAS UN CHAT GÉNÉRALISTE</span><h2>Les tâches répétitives deviennent des livrables utiles.</h2></div><div className="grid">{tools.map(([title, text], index) => <article className="tool" key={title}><span className="number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section><BriefBuilder /><section id="beta" className="cta wrap"><Waitlist /></section><footer className="wrap"><a className="brand" href="#top"><span>A</span>etherAccess</a><p>© 2026 AetherAccess. V1 bêta · Les contenus doivent être relus avant usage professionnel.</p></footer></main>;
}

createRoot(document.getElementById('root')).render(<App />);