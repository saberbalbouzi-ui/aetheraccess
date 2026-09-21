import { useCallback, useEffect, useState } from 'react';
import ProjectWizard from './components/ProjectWizard';
import AuthPanel from './components/AuthPanel';
import Dashboard from './components/Dashboard';
import ProfileSettings from './components/ProfileSettings';
import PublishPanel from './components/PublishPanel';
import ConsultationsPanel from './components/ConsultationsPanel';
import ContractorSpace from './components/ContractorSpace';
import { generateProjectDossier } from './services/dossier-generator';
import { exportDossierDocx, exportDossierPdf, exportDossierTxt } from './services/export-service';
import { clearProjectFallback, loadProjectFallback, saveProjectCloud, saveProjectFallback } from './services/project-service';
import { getCurrentSession, onAuthStateChange } from './services/auth-service';
import { getMyProfile } from './services/company-service';
import { supabaseConfigured } from './lib/supabase';

const SYNC_LABELS = {
  saving: 'Enregistrement…',
  cloud: 'Enregistré dans votre espace AetherAccess.',
  local: 'Enregistré sur cet appareil — connectez-vous pour synchroniser votre espace.',
  error: 'Synchronisation impossible — la copie locale est conservée.',
};

const TABS = [
  { id: 'assistant', label: 'Assistant' },
  { id: 'projects', label: 'Mes projets' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'contractor', label: 'Entreprise', contractorOnly: true },
  { id: 'profile', label: 'Profil' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('assistant');
  const [currentProject, setCurrentProject] = useState(() => loadProjectFallback() || {});
  const [wizardKey, setWizardKey] = useState(0);
  const [dossier, setDossier] = useState('');
  const [syncState, setSyncState] = useState(null);
  const [copyState, setCopyState] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    getCurrentSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  const refreshProfile = useCallback(async (userId) => {
    const { profile: data } = await getMyProfile(userId);
    setProfile(data);
  }, []);

  useEffect(() => {
    if (session?.user) {
      refreshProfile(session.user.id);
    } else {
      setProfile(null);
      setTab('assistant');
    }
  }, [session, refreshProfile]);

  const isContractor = profile?.role === 'entreprise';
  const visibleTabs = TABS.filter((item) => !item.contractorOnly || isContractor);

  const save = async (project) => {
    saveProjectFallback(project);
    setDossier(generateProjectDossier(project));
    setCopyState(false);
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
    setTab('assistant');
    setWizardKey((key) => key + 1);
  };

  const newProject = () => {
    clearProjectFallback();
    setCurrentProject({});
    setDossier('');
    setSyncState(null);
    setTab('assistant');
    setWizardKey((key) => key + 1);
  };

  const copyDossier = async () => {
    try {
      await navigator.clipboard?.writeText(dossier);
      setCopyState(true);
      setTimeout(() => setCopyState(false), 2500);
    } catch {
      setCopyState(false);
    }
  };

  return (
    <div className="v7-app-shell">
      <header className="v7-topbar">
        <span className="brand">AetherAccess</span>
        {session?.user ? (
          <nav className="v7-tabs">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'v7-tab active' : 'v7-tab'}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>
      <AuthPanel session={session} />

      {tab === 'assistant' ? (
        <ProjectWizard key={wizardKey} initialProject={currentProject} onSave={save} />
      ) : null}
      {tab === 'projects' && session?.user ? (
        <Dashboard userId={session.user.id} onOpenProject={openProject} onNewProject={newProject} />
      ) : null}
      {tab === 'consultations' && session?.user ? (
        <ConsultationsPanel userId={session.user.id} />
      ) : null}
      {tab === 'contractor' && session?.user && isContractor ? (
        <ContractorSpace userId={session.user.id} email={session.user.email} />
      ) : null}
      {tab === 'profile' && session?.user ? (
        <ProfileSettings session={session} profile={profile} onProfileChange={setProfile} />
      ) : null}

      {syncState && tab === 'assistant' ? <p className={`sync-status sync-${syncState}`}>{SYNC_LABELS[syncState]}</p> : null}
      {dossier && tab === 'assistant' ? (
        <section className="v7-dossier">
          <h2>Dossier projet</h2>
          <pre>{dossier}</pre>
          <div className="dossier-actions">
            <button type="button" className="dossier-action primary" onClick={copyDossier}>{copyState ? 'Copié ✓' : 'Copier'}</button>
            <button type="button" className="dossier-action" onClick={() => exportDossierPdf(currentProject)}>PDF</button>
            <button type="button" className="dossier-action" onClick={() => exportDossierDocx(currentProject)}>DOCX</button>
            <button type="button" className="dossier-action" onClick={() => exportDossierTxt(currentProject)}>TXT</button>
          </div>
          <PublishPanel project={currentProject} session={session} onPublished={() => setTab('consultations')} />
          <small className="dossier-note">Document à relire et à confirmer avec l’entreprise avant utilisation.</small>
        </section>
      ) : null}
    </div>
  );
}
