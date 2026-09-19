import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const tools = [
  ['Brief projet', 'Transformez une demande client imprécise en programme de rénovation clair et exploitable.'],
  ['Demande de devis', 'Préparez une demande structurée à envoyer aux artisans et entreprises.'],
  ['Descriptif par lot', 'Organisez les travaux par lots : démolition, plomberie, électricité, revêtements et finitions.'],
  ['Messages clients', 'Rédigez des réponses, relances et comptes rendus professionnels en quelques instants.'],
];

function App() {
  return (
    <main>
      <nav className="nav wrap">
        <a className="brand" href="#top" aria-label="AetherAccess accueil"><span>A</span>etherAccess</a>
        <a className="nav-link" href="#beta">Accès bêta</a>
      </nav>

      <section id="top" className="hero wrap">
        <div className="eyebrow">POUR LA RÉNOVATION & L'AMÉNAGEMENT</div>
        <h1>Vos projets mieux structurés.<br /><em>Vos clients mieux servis.</em></h1>
        <p className="hero-copy">AetherAccess Rénovation est l’assistant de travail conçu pour les artisans, décorateurs et petites entreprises : transformez une idée ou une demande client en livrables clairs, rapidement.</p>
        <div className="actions">
          <a className="button primary" href="mailto:contact@aetheraccess.fr?subject=Demande%20d%27acc%C3%A8s%20b%C3%AAta%20AetherAccess">Rejoindre la bêta <span>→</span></a>
          <a className="button ghost" href="#fonctionnalites">Découvrir les outils</a>
        </div>
        <p className="note">Bêta privée · Places limitées · Pensé pour les professionnels francophones</p>
        <div className="project-card" aria-label="Aperçu d'un brief projet">
          <div className="card-top"><span className="dot"></span><span>PROJET · APPARTEMENT T3</span><span className="status">BRIEF STRUCTURÉ</span></div>
          <div className="card-content">
            <div><small>OBJECTIF</small><strong>Rénover et optimiser un T3 de 68 m²</strong></div>
            <div><small>LOT PRIORITAIRE</small><strong>Cuisine, salle de bains, électricité</strong></div>
            <div><small>PROCHAINE ÉTAPE</small><strong>Préparer une demande de devis</strong></div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="section dark">
        <div className="wrap">
          <div className="section-intro"><span className="eyebrow">UNE MÉTHODE, PAS UN CHAT GÉNÉRALISTE</span><h2>Les tâches répétitives deviennent des livrables utiles.</h2></div>
          <div className="grid">
            {tools.map(([title, text], index) => <article className="tool" key={title}><span className="number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section wrap process">
        <div><span className="eyebrow">COMMENT ÇA FONCTIONNERA</span><h2>De la demande au document prêt à utiliser.</h2></div>
        <ol>
          <li><span>1</span><div><h3>Décrivez le projet</h3><p>Quelques informations sur le bien, le client, les besoins et les contraintes.</p></div></li>
          <li><span>2</span><div><h3>Choisissez le livrable</h3><p>Brief, demande de devis, descriptif de travaux ou message client.</p></div></li>
          <li><span>3</span><div><h3>Relisez et adaptez</h3><p>Vous gardez le contrôle du résultat avant toute utilisation professionnelle.</p></div></li>
        </ol>
      </section>

      <section id="beta" className="cta wrap">
        <div><span className="eyebrow">LANCEMENT BÊTA</span><h2>Construisons l’outil avec les professionnels du terrain.</h2><p>Les membres fondateurs testeront les premiers assistants et influenceront directement les fonctionnalités à venir.</p></div>
        <a className="button light" href="mailto:contact@aetheraccess.fr?subject=Je%20veux%20rejoindre%20la%20b%C3%AAta%20AetherAccess">Demander mon accès <span>→</span></a>
      </section>

      <footer className="wrap"><a className="brand" href="#top"><span>A</span>etherAccess</a><p>© 2026 AetherAccess. Conçu pour structurer le travail, pas pour remplacer l’expertise métier.</p></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);