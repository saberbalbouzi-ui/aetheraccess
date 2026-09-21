import { useCallback, useEffect, useState } from 'react';
import { addSiteAction, addSiteReport, listSiteActions, listSiteReports, toggleSiteAction, updateWorkSiteStatus } from '../services/site-service';

const SITE_STATUS = { active: 'En cours', completed: 'Terminé', suspended: 'Suspendu' };
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function ReportForm({ workSiteId, userId, role, onSaved }) {
  const [progressNotes, setProgressNotes] = useState('');
  const [issues, setIssues] = useState('');
  const [nextActions, setNextActions] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await addSiteReport(workSiteId, userId, role, { progressNotes, issues, nextActions });
    setSaving(false);
    if (error) {
      setMessage(`Enregistrement impossible : ${error.message}`);
      return;
    }
    setProgressNotes('');
    setIssues('');
    setNextActions('');
    setMessage('Compte rendu ajouté.');
    onSaved?.();
  };

  return (
    <form className="quote-form" onSubmit={submit}>
      <label>
        Avancement
        <textarea rows="2" value={progressNotes} onChange={(event) => setProgressNotes(event.target.value)} placeholder="Travaux réalisés depuis le dernier point…" />
      </label>
      <label>
        Problèmes et réserves
        <textarea rows="2" value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="Défauts, retards, points bloquants…" />
      </label>
      <label>
        Prochaines étapes
        <textarea rows="2" value={nextActions} onChange={(event) => setNextActions(event.target.value)} placeholder="Ce qui est prévu ensuite…" />
      </label>
      <button type="submit" className="auth-action" disabled={saving}>{saving ? 'Envoi…' : 'Ajouter le compte rendu'}</button>
      {message ? <small className="auth-message sent">{message}</small> : null}
    </form>
  );
}

// Fil de suivi d’un chantier : statut, actions, comptes rendus. Partagé particulier/entreprise.
export default function SiteTracker({ workSite, userId, role, isOwner }) {
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [newAction, setNewAction] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [{ reports: reportRows }, { actions: actionRows }] = await Promise.all([
      listSiteReports(workSite.id),
      listSiteActions(workSite.id),
    ]);
    setReports(reportRows);
    setActions(actionRows);
  }, [workSite.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addAction = async (event) => {
    event.preventDefault();
    if (!newAction.trim()) return;
    const { error } = await addSiteAction(workSite.id, userId, newAction, dueDate);
    if (error) {
      setMessage(`Action impossible : ${error.message}`);
      return;
    }
    setNewAction('');
    setDueDate('');
    refresh();
  };

  const toggle = async (action) => {
    const { error } = await toggleSiteAction(action.id, !action.done);
    if (error) setMessage(`Mise à jour impossible : ${error.message}`);
    refresh();
  };

  const changeStatus = async (event) => {
    const { error } = await updateWorkSiteStatus(workSite.id, event.target.value);
    if (error) setMessage(`Mise à jour impossible : ${error.message}`);
  };

  return (
    <div className="brief-detail site-tracker">
      <div className="dashboard-header">
        <h3>Suivi du chantier — {SITE_STATUS[workSite.status] || workSite.status}</h3>
        {isOwner ? (
          <select defaultValue={workSite.status} onChange={changeStatus} className="site-status-select">
            <option value="active">En cours</option>
            <option value="suspended">Suspendu</option>
            <option value="completed">Terminé</option>
          </select>
        ) : null}
      </div>
      {message ? <p className="auth-message error">{message}</p> : null}

      <h4>Actions</h4>
      <form className="action-form" onSubmit={addAction}>
        <input type="text" value={newAction} onChange={(event) => setNewAction(event.target.value)} placeholder="Ex. Commander les menuiseries" />
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <button type="submit" className="auth-action">Ajouter</button>
      </form>
      {actions.length ? (
        <ul className="action-list">
          {actions.map((action) => (
            <li key={action.id} className={action.done ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={action.done} onChange={() => toggle(action)} />
                <span>{action.label}</span>
              </label>
              {action.due_date ? <small>pour le {formatDate(action.due_date)}</small> : null}
            </li>
          ))}
        </ul>
      ) : <p className="brief-empty">Aucune action pour le moment.</p>}

      <h4>Comptes rendus</h4>
      {reports.length ? (
        <ul className="report-list">
          {reports.map((report) => (
            <li key={report.id}>
              <header>
                <strong>{report.profiles?.business_name || report.profiles?.full_name || (report.author_role === 'entreprise' ? 'Entreprise' : 'Particulier')}</strong>
                <small>{formatDate(report.created_at)} · {report.author_role === 'entreprise' ? 'Entreprise' : 'Particulier'}</small>
              </header>
              {report.progress_notes ? <p><em>Avancement :</em> {report.progress_notes}</p> : null}
              {report.issues ? <p><em>Problèmes :</em> {report.issues}</p> : null}
              {report.next_actions ? <p><em>Suite :</em> {report.next_actions}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="brief-empty">Aucun compte rendu pour le moment.</p>}

      <ReportForm workSiteId={workSite.id} userId={userId} role={role} onSaved={refresh} />
    </div>
  );
}
