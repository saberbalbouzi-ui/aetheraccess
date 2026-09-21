import { useMemo, useState } from 'react';
import { PROJECT_TYPES, PROPERTY_TYPES } from '../data/project-types';
import { ROOMS } from '../data/rooms';
import { suggestWorks } from '../services/suggestion-engine';
import { getMissingItems, countOpenMissing, REASSURANCE_MESSAGE } from '../services/missing-information-engine';
import WorkLotCard from './WorkLotCard';
import MissingCenter from './MissingCenter';
import LocationSelector from './LocationSelector';
import ConsultationPrep from './ConsultationPrep';

const EXISTING_CONDITIONS = [
  { id: 'good', label: 'Bon état' },
  { id: 'average', label: 'État moyen' },
  { id: 'poor', label: 'Dégradé / ancien' },
  { id: 'unknown', label: 'Je ne sais pas' },
];

const BATHROOM_FEATURES = [
  { id: 'italian-shower', label: 'Douche à l’italienne' },
  { id: 'ventilation-confirmed', label: 'Ventilation déjà présente' },
  { id: 'bathtub', label: 'Baignoire' },
];

const OBJECTIVES = [
  { id: 'comfort', label: 'Améliorer le confort' },
  { id: 'energy', label: 'Réduire les consommations' },
  { id: 'appearance', label: 'Moderniser l’apparence' },
];

const labelOf = (list, id) => list.find((item) => item.id === id)?.label || id;

// Résumé dynamique : « Appartement · Cuisine · Séjour · Chambre »
function buildSummaryChips(project) {
  const chips = [];
  if (project.propertyType && project.propertyType !== 'unknown') chips.push(labelOf(PROPERTY_TYPES, project.propertyType));
  (project.roomIds || []).forEach((id) => chips.push(labelOf(ROOMS, id)));
  if (project.location?.city) chips.push(project.location.city);
  else if (project.location?.unknown) chips.push('Localisation à définir');
  return chips;
}

function resultHeadline(project) {
  const parts = [];
  if (project.projectType && project.projectType !== 'unknown') parts.push(labelOf(PROJECT_TYPES, project.projectType));
  if (project.propertyType && project.propertyType !== 'unknown') parts.push(labelOf(PROPERTY_TYPES, project.propertyType));
  if (project.location?.city) parts.push(project.location.postalCode ? `${project.location.city} (${project.location.postalCode})` : project.location.city);
  return parts.join(' · ') || 'Votre projet';
}

export default function ProjectWizard({ initialProject = {}, session, onSave, onGoToConsultations }) {
  const [project, setProject] = useState({
    name: '',
    projectType: '',
    propertyType: '',
    location: {},
    roomIds: [],
    objectives: [],
    surface: '',
    existingCondition: '',
    features: [],
    workStatuses: {},
    workNotes: {},
    missingDismissed: [],
    ...initialProject,
  });
  const [step, setStep] = useState(1);
  const [reassurance, setReassurance] = useState('');
  const [result, setResult] = useState(null);
  const [view, setView] = useState('wizard'); // wizard | result | consultation

  const suggestions = useMemo(() => suggestWorks(project), [project]);
  // Les choix utilisateur priment toujours sur la suggestion du moteur.
  const lots = useMemo(
    () => suggestions.map((work) => ({
      ...work,
      status: project.workStatuses[work.id] || work.status,
      note: project.workNotes[work.id] || '',
    })),
    [suggestions, project.workStatuses, project.workNotes],
  );
  const missingItems = useMemo(() => getMissingItems(project, project.missingDismissed), [project]);

  const finalProject = useMemo(
    () => ({ ...project, suggestions: lots, missingInformation: missingItems }),
    [project, lots, missingItems],
  );

  const update = (patch) => {
    setProject((current) => ({ ...current, ...patch }));
    setResult(null);
  };
  const toggle = (key, id) =>
    update({ [key]: project[key].includes(id) ? project[key].filter((item) => item !== id) : [...project[key], id] });

  const showReassurance = () => {
    setReassurance(REASSURANCE_MESSAGE);
    setTimeout(() => setReassurance(''), 5000);
  };

  const setWorkStatus = (workId, status) =>
    update({ workStatuses: { ...project.workStatuses, [workId]: status } });
  const setWorkNote = (workId, note) =>
    update({ workNotes: { ...project.workNotes, [workId]: note } });

  // Centre de contrôle : « Compléter maintenant » renvoie vers l'étape concernée,
  // « Je ne sais pas » conserve l'élément comme point à vérifier plus tard.
  const completeMissing = (item) => {
    const targetStep = Number(String(item.source || '').replace('step-', '')) || 1;
    setView('wizard');
    setStep(targetStep);
  };
  const dismissMissing = (item) => {
    update({ missingDismissed: [...new Set([...project.missingDismissed, item.id])] });
    showReassurance();
  };

  const createDossier = () => {
    onSave?.(finalProject);
    setResult({
      headline: resultHeadline(finalProject),
      rooms: (finalProject.roomIds || []).length,
      works: lots.filter((lot) => lot.status !== 'not-applicable').length,
      toVerify: lots.filter((lot) => lot.status === 'to-check').length,
      missing: countOpenMissing(missingItems),
      dismissed: missingItems.filter((item) => item.status === 'dismissed').length,
    });
    setView('result');
  };

  // --- Écran 3 : préparer la consultation (chaîne dossier → entreprises) ---
  if (view === 'consultation') {
    return (
      <main className="v7-assistant">
        <ConsultationPrep
          project={finalProject}
          session={session}
          onPublished={() => {}}
          onGoToMissing={() => { setView('wizard'); setStep(6); }}
        />
        <nav className="wizard-nav">
          <button type="button" className="wizard-nav-btn" onClick={() => setView('result')}>
            ← Retour au dossier
          </button>
          <button type="button" className="wizard-nav-btn next" onClick={() => onGoToConsultations?.()}>
            Suivre la consultation →
          </button>
        </nav>
      </main>
    );
  }

  // --- Écran 2 : résultat ---
  if (view === 'result' && result) {
    return (
      <main className="v7-assistant">
        <section className="v7-result">
          <span className="eyebrow">DOSSIER PROJET</span>
          <h1>Votre projet est prêt</h1>
          <p className="v7-result-headline">{result.headline}</p>
          <p>AetherAccess a préparé :</p>
          <ul className="v7-result-list">
            <li>✓ {result.rooms} pièce{result.rooms > 1 ? 's' : ''}</li>
            <li>✓ {result.works} lot{result.works > 1 ? 's' : ''} de travaux</li>
            <li>✓ {result.toVerify} point{result.toVerify > 1 ? 's' : ''} à vérifier</li>
            <li>✓ {result.missing} information{result.missing > 1 ? 's' : ''} manquante{result.missing > 1 ? 's' : ''}{result.dismissed ? ` (+${result.dismissed} à compléter plus tard)` : ''}</li>
          </ul>
          <p className="v7-result-hint">Votre dossier détaillé est disponible juste en dessous, exportable en PDF ou DOCX.</p>
          <div className="v7-result-actions">
            <button type="button" className="dossier-action" onClick={() => document.querySelector('.v7-dossier')?.scrollIntoView({ behavior: 'smooth' })}>
              📄 Voir mon dossier
            </button>
            <button type="button" className="dossier-action primary" onClick={() => setView('consultation')}>
              📨 Consulter des entreprises
            </button>
            <button type="button" className="dossier-action" onClick={() => { setView('wizard'); setStep(6); }}>
              🔎 Vérifier les informations manquantes
            </button>
            <button type="button" className="dossier-action" onClick={() => { setResult(null); setView('wizard'); }}>
              Modifier mes réponses
            </button>
          </div>
        </section>
      </main>
    );
  }

  // --- Écran 1 : wizard pas à pas ---
  const TOTAL_STEPS = 6;
  const chips = buildSummaryChips(project);
  const bathroomSelected = project.roomIds.includes('bathroom') || project.projectType === 'bathroom';

  return (
    <main className="v7-assistant">
      <header className="v7-assistant-header">
        <span className="eyebrow">AETHERACCESS</span>
        <h1>Préparons votre projet.</h1>
        <p>Répondez à quelques questions. Nous structurons le reste, à relire et à confirmer.</p>
        <div className="wizard-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          <span className="wizard-progress-label">{step} / {TOTAL_STEPS}</span>
          <div className="wizard-progress-bar"><span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
        </div>
      </header>

      {chips.length ? (
        <p className="wizard-summary">{chips.join(' · ')}</p>
      ) : null}
      {reassurance ? <p className="wizard-reassurance">{reassurance}</p> : null}

      {step === 1 ? (
        <section className="v7-step">
          <h2>Votre projet — quel type de travaux ?</h2>
          <div className="choice-grid">
            {PROJECT_TYPES.map((type) => (
              <button type="button" className={project.projectType === type.id ? 'selected' : ''} key={type.id}
                onClick={() => { update({ projectType: type.id }); if (type.id === 'unknown') showReassurance(); }}>
                {type.label}<small>{type.description}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="v7-step">
          <h2>Votre logement — quel type de bien ?</h2>
          <div className="choice-grid">
            {PROPERTY_TYPES.map((type) => (
              <button type="button" className={project.propertyType === type.id ? 'selected' : ''} key={type.id}
                onClick={() => { update({ propertyType: type.id }); if (type.id === 'unknown') showReassurance(); }}>
                {type.label}
              </button>
            ))}
          </div>
          <label className="wizard-field">
            Surface approximative (facultatif)
            <input type="number" min="0" value={project.surface} placeholder="Ex. 68"
              onChange={(event) => update({ surface: event.target.value })} />
            {project.surface ? <small>≈ {project.surface} m²</small> : null}
          </label>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="v7-step">
          <h2>Localisation — où se trouve-t-il ?</h2>
          <LocationSelector value={project.location} onChange={(location) => update({ location })} />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="v7-step">
          <h2>Quelles pièces sont concernées ?</h2>
          <div className="room-grid">
            {ROOMS.map((room) => (
              <button type="button" className={project.roomIds.includes(room.id) ? 'selected' : ''} key={room.id}
                onClick={() => toggle('roomIds', room.id)}>
                {room.label}{room.defaultArea ? <small>≈ {room.defaultArea} m²</small> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="v7-step">
          <h2>Vos objectifs et l’existant</h2>
          <div className="choice-grid">
            {OBJECTIVES.map((objective) => (
              <button type="button" className={project.objectives.includes(objective.id) ? 'selected' : ''} key={objective.id}
                onClick={() => toggle('objectives', objective.id)}>
                {objective.label}
              </button>
            ))}
          </div>
          <label className="wizard-field">
            État actuel des installations
            <select value={project.existingCondition} onChange={(event) => { update({ existingCondition: event.target.value }); if (event.target.value === 'unknown') showReassurance(); }}>
              <option value="">Choisir</option>
              {EXISTING_CONDITIONS.map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}
            </select>
          </label>
          {bathroomSelected ? (
            <fieldset className="wizard-features">
              <legend>Salle de bains — particularités (facultatif)</legend>
              {BATHROOM_FEATURES.map((feature) => (
                <label key={feature.id} className="wizard-checkbox">
                  <input type="checkbox" checked={project.features.includes(feature.id)} onChange={() => toggle('features', feature.id)} />
                  {feature.label}
                </label>
              ))}
            </fieldset>
          ) : null}
        </section>
      ) : null}

      {step === 6 ? (
        <>
          <section className="v7-step">
            <h2>Voici ce que nous avons compris</h2>
            {lots.length ? (
              <div className="work-lot-grid">
                {lots.map((lot) => (
                  <WorkLotCard key={lot.id} work={lot} onStatusChange={setWorkStatus} onNoteChange={setWorkNote} />
                ))}
              </div>
            ) : (
              <p className="brief-empty">Répondez aux étapes précédentes pour générer des suggestions — vous pourrez toutes les ajuster ici.</p>
            )}
          </section>
          <MissingCenter items={missingItems} onComplete={completeMissing} onDismiss={dismissMissing} dismissedMessage={reassurance} />
        </>
      ) : null}

      <nav className="wizard-nav">
        {step > 1 ? (
          <button type="button" className="wizard-nav-btn" onClick={() => setStep((current) => current - 1)}>
            ← Étape précédente
          </button>
        ) : <span />}
        {step < TOTAL_STEPS ? (
          <button type="button" className="wizard-nav-btn next" onClick={() => setStep((current) => current + 1)}>
            Étape suivante →
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={createDossier}>
            Créer mon dossier projet →
          </button>
        )}
      </nav>
    </main>
  );
}
