export default function SuggestionCard({ suggestion }) {
  const statusLabels = { confirmed: 'Confirmé', recommended: 'Conseillé', 'to-check': 'À vérifier', 'not-applicable': 'Non concerné' };
  return (
    <article className={`suggestion-card suggestion-${suggestion.status}`}>
      <span>{suggestion.category}</span>
      <strong>{suggestion.label}</strong>
      <small>{statusLabels[suggestion.status] || 'À préciser'}</small>
    </article>
  );
}