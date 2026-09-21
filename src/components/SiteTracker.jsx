import { useCallback, useEffect, useRef, useState } from 'react';
import { addSiteAction, addSiteReport, listSiteActions, listSiteReports, toggleSiteAction, updateWorkSiteStatus } from '../services/site-service';
import { attachPhotosToReport, uploadReportPhoto } from '../services/photo-service';
import ReportPhotos from './ReportPhotos';

const SITE_STATUS = { active: 'En cours', completed: 'Terminé', suspended: 'Suspendu' };
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function ReportForm({ workSiteId, userId, role, onSaved }) {
  const [progressNotes, setProgressNotes] = useState('');
  const [issues, setIssues] = useState('');
  const [nextActions, setNextActions] = useState('');
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const { error } = await addSiteReport(workSiteId, userId, role, { progressNotes, issues, nextActions });
    if (error) {
      setSaving(false);
      setMessage(`Enregistrement impossible : ${error.message}`);
      return;
    }

    const attachedFiles = files;
    setProgressNotes('');
    setIssues('');
    setNextActions('');
    setFiles([]);
    if (fileInput.current) fileInput.current.value = '';
    setMessage('Compte rendu ajouté.');
    setSaving(false);
    onSaved?.(attachedFiles);
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
      <label>
        Photos (facultatif)
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
        />
        <small>JPG, PNG, WebP ou HEIC — 8 Mo maximum par photo.</small>
      </label>
      <button type="submit" className="auth-action" disabled={saving}>{saving ? 'Envoi…' : 'Ajouter le compte rendu'}</button>
      {message ? <small className="auth-message sent">{message}</small> : null}
    </form>
  );
}

// Fil de suivi d’un chantier : statut, actions, comptes rendus avec photos. Partagé particulier/entreprise.
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

  // Appelé par ReportForm après création : attache les photos au dernier compte rendu.
  const onReportSaved = async (files = []) => {
    if (!files.length) {
      refresh();
      return;
    }
    const { reports: latest } = await listSiteReports(workSite.id);
    const reportId = latest?.[0]?.id;
    if (reportId) {
      const paths = [];
      for (const file of files) {
        const { path, error } = await uploadReportPhoto(workSite.id, reportId, file);
        if (error) setMessage(error.message);
        else if (path) paths.push(path);
      }
      if (paths.length) await attachPhotosToReport(reportId, paths);
    }
    refresh();
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
              {report.photos?.length ? <ReportPhotos paths={report.photos} /> : null}
            </li>
          ))}
        </ul>
      ) : <p className="brief-empty">Aucun compte rendu pour le moment.</p>}

      <ReportForm workSiteId={workSite.id} userId={userId} role={role} onSaved={onReportSaved} />
    </div>
  );
}
