import { useCallback, useEffect, useState } from 'react';
import ProjectWizard from './components/ProjectWizard';
import AuthPanel, { SIGNUP_ROLE_KEY } from './components/AuthPanel';
import Dashboard from './components/Dashboard';
import ProfileSettings from './components/ProfileSettings';
import PublishPanel from './components/PublishPanel';
import ConsultationsPanel from './components/ConsultationsPanel';
import ContractorSpace from './components/ContractorSpace';
import WorkSitesPanel from './components/WorkSitesPanel';
import { generateProjectDossier } from './services/dossier-generator';
import { exportDossierDocx, exportDossierPdf, exportDossierTxt } from './services/export-service';
import { clearProjectFallback, loadProjectFallback, saveProjectCloud, saveProjectFallback } from './services/project-service';
import { getCurrentSession, onAuthStateChange } from './services/auth-service';
import { getMyProfile, registerInDirectory, updateMyProfile } from './services/company-service';
import { supabaseConfigured } from './lib/supabase';

const SYNC_LABELS = {
  saving: 'Enregistrement…',
  cloud: 'Enregistré dans votre espace AetherAccess.',
  local: 'Enregistré sur cet appareil — connectez-vous pour synchroniser votre espace.',
  error: 'Synchronisation impossible — la copie locale est conservée.',
};

// Chaque profil ne voit que ce qui le concerne :
// - ownerOnly : réservé aux particuliers (création de projet, cahier des charges, consultation des entreprises)
// - contractorOnly : réservé aux entreprises (invitations reçues, briefs, devis à envoyer)
// - sans marqueur : commun (suivi des chantiers, profil)
const TABS = [
  { id: 'assistant', label: 'Assistant', ownerOnly: true },
  { id: 'projects', label: 'Mes projets', ownerOnly: true },
  { id: 'consultations', label: 'Consultations', ownerOnly: true },
  { id: 'contractor', label: 'Entreprise', contractorOnly: true },
  { id: 'sites', label: 'Chantiers' },
  { id: 'profile', label: 'Profil' },
];

const OWNER_ONLY_TABS = TABS.filter((item) => item.ownerOnly).map((item) => item.id);

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = session en cours de vérification
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('assistant');
  const [currentProject, setCurrentProject] = useState(() => loadProjectFallback() || {});
  const [wizardKey, setWizardKey] = useState(0);
  const [dossier, setDossier] = useState('');
  const [syncState, setSyncState] = useState(null);
  const [copyState, setCopyState] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setSession(null);
      return undefined;
    }
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

  // Redirige une entreprise vers son espace si elle se trouve sur un onglet réservé aux particuliers.
  useEffect(() => {
    if (isContractor && OWNER_ONLY_TABS.includes(tab)) {
      setTab('contractor');
    }
  }, [isContractor, tab]);

  // Applique l'intention choisie sur l'écran d'accueil (particulier / entreprise)
  // dès que le profil est chargé, sans jamais écraser un rôle déjà défini.
  useEffect(() => {
    if (!session?.user || !profile) return;
    const intent = localStorage.getItem(SIGNUP_ROLE_KEY);
    if (!intent || profile.role) return;
    localStorage.removeItem(SIGNUP_ROLE_KEY);
    (async () => {
      await updateMyProfile(session.user.id, {
        fullName: profile.full_name,
        businessName: profile.business_name,
        role: intent,
      });
      if (intent === 'entreprise') {
        await registerInDirectory(session.user.id, session.user.email, profile.business_name);
      }
      await refreshProfile(session.user.id);
      setTab(intent === 'entreprise' ? 'contractor' : 'assistant');
    })();
  }, [session, profile, refreshProfile]);

  const visibleTabs = TABS.filter((item) => {
    if (item.contractorOnly) return isContractor;
    if (item.ownerOnly) return !isContractor;
    return true;
  });

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

  const isGuest = session === null;

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

      {isGuest ? (
        // Page d'accueil publique : uniquement l'accès et la présentation de la plateforme.
        <AuthPanel session={session} profile={profile} />
      ) : (
        // Espace dédié : toutes les fonctionnalités après connexion.
        <>
          <AuthPanel session={session} profile={profile} />
          {tab === 'assistant' && !isContractor ? (
            <ProjectWizard key={wizardKey} initialProject={currentProject} onSave={save} />
          ) : null}
          {tab === 'projects' && session?.user && !isContractor ? (
            <Dashboard userId={session.user.id} onOpenProject={openProject} onNewProject={newProject} />
          ) : null}
          {tab === 'consultations' && session?.user && !isContractor ? (
            <ConsultationsPanel userId={session.user.id} />
          ) : null}
          {tab === 'contractor' && session?.user && isContractor ? (
            <ContractorSpace userId={session.user.id} email={session.user.email} />
          ) : null}
          {tab === 'sites' && session?.user ? (
            <WorkSitesPanel userId={session.user.id} isContractor={isContractor} />
          ) : null}
          {tab === 'profile' && session?.user ? (
            <ProfileSettings session={session} profile={profile} onProfileChange={setProfile} />
          ) : null}

          {syncState && tab === 'assistant' && !isContractor ? <p className={`sync-status sync-${syncState}`}>{SYNC_LABELS[syncState]}</p> : null}
          {dossier && tab === 'assistant' && !isContractor ? (
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
        </>
      )}
    </div>
  );
}
