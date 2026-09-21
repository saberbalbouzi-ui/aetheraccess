import { useMemo, useState } from 'react';
import { PROJECT_TYPES, PROPERTY_TYPES } from '../data/project-types';
import { ROOMS } from '../data/rooms';
import { getMissingInformation, suggestWorks } from '../services/suggestion-engine';
import SuggestionCard from './SuggestionCard';
import LocationSelector from './LocationSelector';

export default function ProjectWizard({ initialProject = {}, onSave }) {
  const [project, setProject] = useState({ name: '', projectType: '', propertyType: '', location: {}, roomIds: [], objectives: [], ...initialProject });
  const suggestions = useMemo(() => suggestWorks(project), [project]);
  const missingInformation = useMemo(() => getMissingInformation({ ...project, suggestions }), [project, suggestions]);
  const update = (patch) => setProject((current) => ({ ...current, ...patch }));
  const toggleRoom = (id) => update({ roomIds: project.roomIds.includes(id) ? project.roomIds.filter((room) => room !== id) : [...project.roomIds, id] });
  const toggleObjective = (id) => update({ objectives: project.objectives.includes(id) ? project.objectives.filter((objective) => objective !== id) : [...project.objectives, id] });

  return (
    <main className="v7-assistant">
      <header className="v7-assistant-header">
        <span className="eyebrow">AETHERACCESS V7</span>
        <h1>Préparons votre projet.</h1>
        <p>Répondez à quelques questions. Nous structurons le reste, à relire et à confirmer.</p>
      </header>
      <section className="v7-step"><h2>1. Que souhaitez-vous faire ?</h2><div className="choice-grid">{PROJECT_TYPES.map((type) => <button type="button" className={project.projectType === type.id ? 'selected' : ''} key={type.id} onClick={() => update({ projectType: type.id })}>{type.label}<small>{type.description}</small></button>)}</div></section>
      <section className="v7-step"><h2>2. Quel type de bien ?</h2><div className="choice-grid">{PROPERTY_TYPES.map((type) => <button type="button" className={project.propertyType === type.id ? 'selected' : ''} key={type.id} onClick={() => update({ propertyType: type.id })}>{type.label}</button>)}</div></section>
      <section className="v7-step"><h2>3. Où se situe le projet ?</h2><LocationSelector value={project.location} onChange={(location) => update({ location })} /></section>
      <section className="v7-step"><h2>4. Quelles pièces sont concernées ?</h2><div className="room-grid">{ROOMS.map((room) => <button type="button" className={project.roomIds.includes(room.id) ? 'selected' : ''} key={room.id} onClick={() => toggleRoom(room.id)}>{room.label}{room.defaultArea ? <small>≈ {room.defaultArea} m²</small> : null}</button>)}</div></section>
      <section className="v7-step"><h2>5. Quels sont vos objectifs ?</h2><div className="choice-grid"><button type="button" className={project.objectives.includes('comfort') ? 'selected' : ''} onClick={() => toggleObjective('comfort')}>Améliorer le confort</button><button type="button" className={project.objectives.includes('energy') ? 'selected' : ''} onClick={() => toggleObjective('energy')}>Réduire les consommations</button><button type="button" className={project.objectives.includes('appearance') ? 'selected' : ''} onClick={() => toggleObjective('appearance')}>Moderniser l’apparence</button></div></section>
      <section className="v7-step"><h2>6. Voici ce que nous avons compris</h2><div className="suggestion-grid">{suggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} />)}</div></section>
      <section className="v7-step missing-information"><h2>Informations manquantes</h2>{missingInformation.length ? <ul>{missingInformation.map((item) => <li key={item.id}>{item.label}</li>)}</ul> : <p>Votre première synthèse est complète. Les métrés et points techniques restent à confirmer avec l’entreprise.</p>}</section>
      <button type="button" className="primary-action" onClick={() => onSave?.({ ...project, suggestions, missingInformation })}>Enregistrer la première synthèse</button>
    </main>
  );
}