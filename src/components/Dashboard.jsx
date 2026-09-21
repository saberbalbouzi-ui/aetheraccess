import { useCallback, useEffect, useState } from 'react';
import { deleteCloudProject, listCloudProjects, loadCloudProject } from '../services/project-service';

const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Dashboard({ userId, onOpenProject, onNewProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { projects: rows, error: loadError } = await listCloudProjects(userId);
    setProjects(rows);
    setError(loadError?.message || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = async (id) => {
    setError(null);
    const { project, error: loadError } = await loadCloudProject(id);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    onOpenProject(project);
  };

  const remove = async (id) => {
    setError(null);
    const { error: deleteError } = await deleteCloudProject(id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    refresh();
  };

  return (
    <section className="v7-step v7-dashboard">
      <div className="dashboard-header">
        <h2>Mes projets enregistrés</h2>
        <button type="button" className="auth-action" onClick={onNewProject}>+ Nouveau projet</button>
      </div>
      {loading ? <p>Chargement…</p> : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      {!loading && !projects.length ? (
        <p>Aucun projet enregistré pour le moment. Votre première synthèse apparaîtra ici après enregistrement.</p>
      ) : null}
      <div className="dashboard-grid">
        {projects.map((project) => (
          <article className="dashboard-card" key={project.id}>
            <strong>{project.title}</strong>
            <small>{project.location || 'Localisation à préciser'} · {project.property_type || 'Bien à préciser'}</small>
            <small>Complétude : {project.completion_percentage ?? 0}% · mis à jour le {formatDate(project.updated_at)}</small>
            <div className="dashboard-actions">
              <button type="button" onClick={() => open(project.id)}>Ouvrir</button>
              <button type="button" className="danger" onClick={() => remove(project.id)}>Supprimer</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
