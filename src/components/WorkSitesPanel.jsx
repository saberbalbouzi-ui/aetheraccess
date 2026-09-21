import { useCallback, useEffect, useState } from 'react';
import { listOwnerWorkSites, listContractorWorkSites } from '../services/site-service';
import SiteTracker from './SiteTracker';

const SITE_STATUS = { active: 'En cours', completed: 'Terminé', suspended: 'Suspendu' };
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Onglet Chantiers : liste des chantiers ouverts (devis acceptés), visible des deux côtés.
export default function WorkSitesPanel({ userId, isContractor }) {
  const [workSites, setWorkSites] = useState([]);
  const [openSite, setOpenSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { workSites: rows, error: loadError } = isContractor
      ? await listContractorWorkSites(userId)
      : await listOwnerWorkSites(userId);
    setWorkSites(rows);
    setError(loadError?.message || null);
    setLoading(false);
  }, [userId, isContractor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="v7-step v7-dashboard">
      <div className="dashboard-header">
        <h2>Chantiers</h2>
        <button type="button" className="auth-action" onClick={refresh}>Actualiser</button>
      </div>
      {loading ? <p>Chargement…</p> : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      {!loading && !workSites.length ? (
        <p>{isContractor
          ? 'Aucun chantier en cours. Un chantier s’ouvre automatiquement quand un particulier accepte votre devis.'
          : 'Aucun chantier ouvert. Un chantier s’ouvre automatiquement quand vous acceptez un devis.'}</p>
      ) : null}
      <div className="dashboard-grid">
        {workSites.map((site) => (
          <article className="dashboard-card brief-card" key={site.id}>
            <strong>{site.renovation_projects?.title || 'Chantier'}</strong>
            <small>{site.renovation_projects?.location || 'Localisation à préciser'}</small>
            <small>
              {SITE_STATUS[site.status] || site.status} · depuis le {formatDate(site.started_at)}
              {!isContractor && site.profiles ? ` · ${site.profiles.business_name || site.profiles.full_name || 'Entreprise'}` : ''}
            </small>
            <div className="dashboard-actions">
              <button type="button" onClick={() => setOpenSite(openSite === site.id ? null : site.id)}>
                {openSite === site.id ? 'Refermer le suivi' : 'Suivre le chantier'}
              </button>
            </div>
            {openSite === site.id ? (
              <SiteTracker
                workSite={site}
                userId={userId}
                role={isContractor ? 'entreprise' : 'particulier'}
                isOwner={!isContractor}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
