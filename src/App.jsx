import { useState } from 'react';
import ProjectWizard from './components/ProjectWizard';
import { generateProjectDossier } from './services/dossier-generator';
import { loadProjectFallback, saveProjectFallback } from './services/project-service';

export default function App() {
  const [savedProject, setSavedProject] = useState(() => loadProjectFallback());
  const [dossier, setDossier] = useState('');
  const save = (project) => {
    saveProjectFallback(project);
    setSavedProject(project);
    setDossier(generateProjectDossier(project));
  };
  return (
    <div className="v7-app-shell">
      <ProjectWizard initialProject={savedProject || {}} onSave={save} />
      {dossier ? <section className="v7-dossier"><h2>Dossier projet</h2><pre>{dossier}</pre></section> : null}
    </div>
  );
}