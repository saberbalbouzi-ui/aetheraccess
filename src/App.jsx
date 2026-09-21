import { useEffect, useState } from 'react';
import ProjectWizard from './components/ProjectWizard';
import AuthPanel from './components/AuthPanel';
import Dashboard from './components/Dashboard';
import { generateProjectDossier } from './services/dossier-generator';
import { clearProjectFallback, loadProjectFallback, saveProjectCloud, saveProjectFallback } from './services/project-service';
import { getCurrentSession, onAuthStateChange } from './services/auth-service';
import { supabaseConfigured } from './lib/supabase';

const SYNC_LABELS = {
  saving: 'Enregistrement…',
  cloud: 'Enregistré dans votre espace AetherAccess.',
  local: 'Enregistré sur cet appareil — connectez-vous pour synchroniser votre espace.',
  error: 'Synchronisation impossible — la copie locale est conservée.',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [currentProject, setCurrentProject] = useState(() => loadProjectFallback() || {});
  const [wizardKey, setWizardKey] = useState(0);
  const [dossier, setDossier] = useState('');
  const [syncState, setSyncState] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    getCurrentSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  const save = async (project) => {
    saveProjectFallback(project);
    setDossier(generateProjectDossier(project));
    if (session?.user) {
      setSyncState('saving');
      const { project: saved, error } = await saveProjectCloud(project, session.user.id);
      if (error) {
        console.warn('AetherAccess — synchronisation Supabase impossible :', error.message);
        setSyncState('error');
        setCurrentProject(project);
      } else {
        setSyncState('cloud');
        setCurrentProject(saved);
      }
    } else {
      setSyncState('local');
      setCurrentProject(project);
    }
  };

  const openProject = (project) => {
    setCurrentProject(project);
    setDossier('');
    setSyncState(null);
    setShowDashboard(false);
    setWizardKey((key) => key + 1);
  };

  const newProject = () => {
    clearProjectFallback();
    setCurrentProject({});
    setDossier('');
    setSyncState(null);
    setShowDashboard(false);
    setWizardKey((key) => key + 1);
  };

  return (
    <div className="v7-app-shell">
      <header className="v7-topbar">
        <span className="brand">AetherAccess</span>
        {session?.user ? (
          <button type="button" className="auth-action" onClick={() => setShowDashboard((visible) => !visible)}>
            {showDashboard ? 'Retour à l’assistant' : 'Mes projets'}
          </button>
        ) : null}
      </header>
      <AuthPanel session={session} />
      {showDashboard && session?.user ? (
        <Dashboard userId={session.user.id} onOpenProject={openProject} onNewProject={newProject} />
      ) : (
        <ProjectWizard key={wizardKey} initialProject={currentProject} onSave={save} />
      )}
      {syncState ? <p className={`sync-status sync-${syncState}`}>{SYNC_LABELS[syncState]}</p> : null}
      {dossier ? <section className="v7-dossier"><h2>Dossier projet</h2><pre>{dossier}</pre></section> : null}
    </div>
  );
}
