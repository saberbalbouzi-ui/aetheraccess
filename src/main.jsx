import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseConfigured } from './lib/supabase';
import './styles.css';

const tools = [
  ['Pré-diagnostic', 'Structurez rapidement un projet, ses priorités, ses contraintes et les informations manquantes.'],
  ['Demande de devis', 'Préparez une consultation claire, organisée par lots, à envoyer aux entreprises.'],
  ['Compte rendu', 'Transformez vos notes de visite ou de chantier en synthèse exploitable.'],
  ['Suivi client', 'Préparez des messages, relances et prochaines étapes sans repartir de zéro.'],
];

const initialForm = { title: '', propertyType: 'Appartement', surface: '', location: '', rooms: '', condition: '', objectives: '', budget: '', timeline: '' };

function buildAnalysis(form) {
  const rooms = form.rooms || 'les pièces à préciser';
  const objectives = form.objectives || 'Clarifier les objectifs avec le client avant chiffrage.';
  const condition = form.condition || 'Réaliser une visite détaillée et documenter l’état existant.';
  const budget = form.budget || 'Budget à confirmer';
  const timeline = form.timeline || 'Délai à confirmer';
  const priorities = [
    'Documenter l’état existant et les désordres visibles.',
    `Définir précisément le périmètre des travaux pour ${rooms}.`,
    'Vérifier les contraintes techniques, administratives et de planning.',
    'Obtenir plusieurs offres comparables sur la même base.',
  ];
  const missing = ['Plans ou métrés disponibles', 'Photos récentes de l’état existant', 'Budget maximal et niveau de finition', 'Délai souhaité et contraintes d’occupation'];
  const vigilance = ['Le pré-diagnostic ne remplace pas une visite ni un diagnostic réglementaire.', 'Les quantités et prix doivent être vérifiés par un professionnel.', 'Toute intervention structurelle ou technique doit faire l’objet d’une vérification adaptée.'];
  const scenarios = {
    Essentiel: 'Traiter les urgences, sécuriser le logement et réaliser les travaux indispensables.',
    Confort: 'Ajouter l’amélioration fonctionnelle, les finitions et l’optimisation des usages.',
    Complet: 'Prévoir une rénovation globale avec performance, cohérence esthétique et anticipation des besoins futurs.',
  };
  const quote = `DEMANDE DE DEVIS — ${form.title || 'Projet de rénovation'}\n\nBien : ${form.propertyType}${form.surface ? ` · ${form.surface} m²` : ''}\nLocalisation : ${form.location || 'À préciser'}\nPièces concernées : ${rooms}\nObjectifs : ${objectives}\nÉtat existant : ${condition}\nBudget indicatif : ${budget}\nDélai souhaité : ${timeline}\n\nMerci de préciser dans votre offre : les travaux par lot, les matériaux proposés, les quantités, les délais, les exclusions et les conditions de réalisation.`;
  return { summary: `${form.title || 'Projet de rénovation'} — ${form.propertyType}${form.surface ? ` de ${form.surface} m²` : ''}. Objectif : ${objectives}`, priorities, missing, vigilance, scenarios, quote };
}

function DiagnosticBuilder() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const generate = (event) => { event.preventDefault(); setResult(buildAnalysis(form)); };
  const copy = async (text) => { await navigator.clipboard?.writeText(text); };
  return <section className="builder wrap" id="outil"><div className="builder-head"><div><span className="eyebrow">OUTIL BÊTA · PRÉ-DIAGNOSTIC</span><h2>Clarifiez le projet avant de demander des devis.</h2><p>Un cadre de travail simple pour identifier les priorités, les informations manquantes et les prochaines étapes. Aucun résultat ne remplace l’expertise ou les diagnostics nécessaires.</p></div><span className="beta-pill">V2 BÊTA</span></div><form className="form-grid" onSubmit={generate}><label>Nom du projet<input required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Ex. Rénovation appartement T3" /></label><label>Type de bien<select value={form.propertyType} onChange={(e) => update('propertyType', e.target.value)}><option>Appartement</option><option>Maison</option><option>Local professionnel</option><option>Autre</option></select></label><label>Surface (m²)<input type="number" min="0" value={form.surface} onChange={(e) => update('surface', e.target.value)} placeholder="68" /></label><label>Localisation<input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Ville / quartier" /></label><label className="wide">Pièces concernées<input value={form.rooms} onChange={(e) => update('rooms', e.target.value)} placeholder="Cuisine, salle de bains, séjour..." /></label><label className="wide">État existant<textarea value={form.condition} onChange={(e) => update('condition', e.target.value)} placeholder="État général, installations, désordres visibles..." /></label><label className="wide">Objectifs<textarea value={form.objectives} onChange={(e) => update('objectives', e.target.value)} placeholder="Ce que le client souhaite améliorer ou transformer." /></label><label>Budget indicatif<input value={form.budget} onChange={(e) => update('budget', e.target.value)} placeholder="Ex. 30 000 à 50 000 €" /></label><label>Délai souhaité<input value={form.timeline} onChange={(e) => update('timeline', e.target.value)} placeholder="Ex. démarrage en septembre" /></label><div className="builder-actions wide"><button className="button primary">Générer le pré-diagnostic <span>→</span></button></div></form>{result && <Analysis result={result} copy={copy} />}</section>;
}

function Analysis({ result, copy }) {
  const text = `${result.summary}\n\nTRAVAUX PRIORITAIRES\n${result.priorities.map((item) => `- ${item}`).join('\n')}\n\nINFORMATIONS MANQUANTES\n${result.missing.map((item) => `- ${item}`).join('\n')}\n\nPOINTS DE VIGILANCE\n${result.vigilance.map((item) => `- ${item}`).join('\n')}\n\nSCÉNARIOS\n${Object.entries(result.scenarios).map(([key, value]) => `${key}: ${value}`).join('\n')}`;
  return <div className="analysis"><div className="analysis-title"><div><span className="eyebrow">RÉSULTAT STRUCTURÉ</span><h3>Pré-diagnostic du projet</h3></div><button className="button ghost small" onClick={() => copy(text)}>Copier le résultat</button></div><p className="summary">{result.summary}</p><div className="analysis-grid"><article><h4>Travaux prioritaires</h4><ul>{result.priorities.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h4>Informations manquantes</h4><ul>{result.missing.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h4>Points de vigilance</h4><ul>{result.vigilance.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h4>Scénarios</h4>{Object.entries(result.scenarios).map(([key, value]) => <p key={key}><strong>{key}.</strong> {value}</p>)}</article></div><div className="quote-box"><div><h4>Demande de devis structurée</h4><pre>{result.quote}</pre></div><button className="button primary small" onClick={() => copy(result.quote)}>Copier la demande</button></div></div>;
}

function Waitlist() {
  const [form, setForm] = useState({ full_name: '', email: '', profession: '', primary_need: '' });
  const [state, setState] = useState({ kind: 'idle', message: '' });
  const submit = async (event) => { event.preventDefault(); setState({ kind: 'loading', message: '' }); if (!supabaseConfigured || !supabase) { setState({ kind: 'error', message: 'Configuration Supabase absente dans le build Vercel.' }); return; } const payload = { full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), profession: form.profession.trim() || null, primary_need: form.primary_need.trim() || null }; const { error } = await supabase.from('beta_waitlist').insert(payload); if (!error) { setState({ kind: 'success', message: 'Votre demande a bien été enregistrée.' }); setForm({ full_name: '', email: '', profession: '', primary_need: '' }); return; } if (error.code === '23505') { setState({ kind: 'info', message: 'Cet e-mail est déjà inscrit.' }); return; } setState({ kind: 'error', message: `Erreur Supabase (${error.code || 'sans code'}): ${error.message}` }); };
  return <div className="waitlist-box"><span className="eyebrow">ACCÈS BÊTA</span><h2>Recevez une invitation.</h2><p>Décrivez votre activité : nous vous contacterons pour tester les premiers outils.</p><form onSubmit={submit}><input required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nom complet" /><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail professionnel" /><input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} placeholder="Métier" /><textarea value={form.primary_need} onChange={(e) => setForm({ ...form, primary_need: e.target.value })} placeholder="Quel outil vous ferait gagner le plus de temps ?" /><button className="button light" disabled={state.kind === 'loading'}>{state.kind === 'loading' ? 'Envoi...' : 'Rejoindre la bêta'} <span>→</span></button></form>{state.message && <p className={`form-message ${state.kind}`}>{state.message}</p>}</div>;
}

function App() { return <main><nav className="nav wrap"><a className="brand" href="#top"><span>A</span>etherAccess</a><div className="nav-actions"><a className="nav-link" href="#outil">Pré-diagnostic</a><a className="nav-link" href="#beta">Accès bêta</a></div></nav><section id="top" className="hero wrap"><div className="eyebrow">POUR LA RÉNOVATION & L'AMÉNAGEMENT</div><h1>Vos projets mieux structurés.<br /><em>Vos clients mieux servis.</em></h1><p className="hero-copy">AetherAccess aide les professionnels de la rénovation à transformer leurs visites, notes et demandes clients en documents structurés et actions concrètes.</p><div className="actions"><a className="button primary" href="#outil">Essayer le pré-diagnostic <span>→</span></a><a className="button ghost" href="#fonctionnalites">Voir les outils</a></div><p className="note">V2 bêta · Sans paiement · Sans appel IA externe · Résultats à relire</p><div className="project-card"><div className="card-top"><span className="dot"></span><span>PROJET · RÉNOVATION T3</span><span className="status">PRÉ-DIAGNOSTIC</span></div><div className="card-content"><div><small>OBJECTIF</small><strong>Clarifier les travaux et préparer la consultation</strong></div><div><small>PIÈCES</small><strong>Cuisine, salle de bains, séjour</strong></div><div><small>PROCHAINE ÉTAPE</small><strong>Comparer des offres comparables</strong></div></div></div></section><section id="fonctionnalites" className="section dark"><div className="wrap"><div className="section-intro"><span className="eyebrow">UNE MÉTHODE, PAS UN CHAT GÉNÉRALISTE</span><h2>Les tâches répétitives deviennent des livrables utiles.</h2></div><div className="grid">{tools.map(([title, text], index) => <article className="tool" key={title}><span className="number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section><DiagnosticBuilder /><section id="beta" className="cta wrap"><Waitlist /></section><footer className="wrap"><a className="brand" href="#top"><span>A</span>etherAccess</a><p>© 2026 AetherAccess. V2 bêta · Les contenus doivent être relus avant usage professionnel.</p></footer></main>; }

createRoot(document.getElementById('root')).render(<App />);