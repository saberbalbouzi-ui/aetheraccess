import { useState } from 'react';

const STATUS_META = {
  confirmed: { label: 'Confirmé', icon: '🟢' },
  recommended: { label: 'Conseillé', icon: '🟢' },
  'to-check': { label: 'À vérifier', icon: '🟠' },
  'not-applicable': { label: 'Non concerné', icon: '⚪' },
};

// Carte de lot interactive : l'utilisateur garde le contrôle sur chaque suggestion.
// Une hypothèse technique n'est jamais présentée comme une obligation.
export default function WorkLotCard({ work, onStatusChange, onNoteChange }) {
  const [noteOpen, setNoteOpen] = useState(Boolean(work.note));
  const meta = STATUS_META[work.status] || STATUS_META.recommended;
  const dismissed = work.status === 'not-applicable';

  return (
    <article className={`work-lot work-lot-${work.status}`}>
      <header className="work-lot-header">
        <div>
          <span className="work-lot-category">{work.category}</span>
          <strong>{work.label}</strong>
        </div>
        <span className={`work-lot-status status-${work.status}`}>{meta.icon} {meta.label}</span>
      </header>
      {work.rationale ? <p className="work-lot-rationale">{work.rationale}</p> : null}

      <div className="work-lot-actions">
        {dismissed ? (
          <button type="button" className="work-lot-btn restore" onClick={() => onStatusChange(work.id, 'recommended')}>
            ↩ Restaurer ce lot
          </button>
        ) : (
          <>
            {work.status !== 'confirmed' ? (
              <button type="button" className="work-lot-btn confirm" onClick={() => onStatusChange(work.id, 'confirmed')}>
                ✓ Confirmer
              </button>
            ) : null}
            {work.status !== 'to-check' ? (
              <button type="button" className="work-lot-btn check" onClick={() => onStatusChange(work.id, 'to-check')}>
                À vérifier
              </button>
            ) : null}
            <button type="button" className="work-lot-btn dismiss" onClick={() => onStatusChange(work.id, 'not-applicable')}>
              ✕ Ne pas prévoir
            </button>
          </>
        )}
        {!dismissed ? (
          <button type="button" className="work-lot-btn note" onClick={() => setNoteOpen((open) => !open)}>
            {noteOpen ? 'Masquer la note' : 'Ajouter une note'}
          </button>
        ) : null}
      </div>

      {noteOpen && !dismissed ? (
        <textarea
          className="work-lot-note"
          rows={2}
          value={work.note || ''}
          placeholder="Note facultative (ex. contrainte, préférence, question pour l’entreprise)"
          onChange={(event) => onNoteChange(work.id, event.target.value)}
        />
      ) : null}
    </article>
  );
}
