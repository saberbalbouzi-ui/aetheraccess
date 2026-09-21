import { countOpenMissing, REASSURANCE_MESSAGE } from '../services/missing-information-engine';

const SEVERITY_META = {
  blocking: { icon: '🔴', label: 'Bloquant' },
  important: { icon: '🟠', label: 'Important' },
  optional: { icon: '🟡', label: 'Optionnel' },
};

// Centre de contrôle : chaque information manquante est actionnable,
// jamais bloquante. « Je ne sais pas » garde l'élément comme point à vérifier plus tard.
export default function MissingCenter({ items = [], onComplete, onDismiss, dismissedMessage }) {
  const openCount = countOpenMissing(items);
  if (!items.length) {
    return (
      <section className="v7-step missing-center">
        <h2>Informations manquantes</h2>
        <p className="missing-center-ok">Votre première synthèse est complète. Les métrés et points techniques restent à confirmer avec l’entreprise.</p>
      </section>
    );
  }

  return (
    <section className="v7-step missing-center">
      <h2>Informations manquantes</h2>
      <p className="missing-center-count">
        {openCount} information{openCount > 1 ? 's' : ''} manquante{openCount > 1 ? 's' : ''} — rien de bloquant, vous pourrez compléter plus tard.
      </p>
      {dismissedMessage ? <p className="missing-center-reassurance">{REASSURANCE_MESSAGE}</p> : null}
      <ul className="missing-center-list">
        {items.map((item) => {
          const meta = SEVERITY_META[item.severity] || SEVERITY_META.optional;
          const dismissed = item.status === 'dismissed';
          return (
            <li key={item.id} className={`missing-item severity-${item.severity} ${dismissed ? 'missing-dismissed' : ''}`}>
              <div className="missing-item-body">
                <strong>{meta.icon} {item.title}</strong>
                <span>{item.description}</span>
                {dismissed ? <small className="missing-item-later">À vérifier plus tard — conservé dans le dossier.</small> : null}
              </div>
              {!dismissed ? (
                <div className="missing-item-actions">
                  <button type="button" className="missing-btn complete" onClick={() => onComplete(item)}>
                    Compléter maintenant
                  </button>
                  <button type="button" className="missing-btn skip" onClick={() => onDismiss(item)}>
                    Je ne sais pas
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
