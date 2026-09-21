export default function LocationSelector({ value = {}, onChange }) {
  return (
    <section className="location-selector">
      <label htmlFor="v7-location-city">Ville ou commune</label>
      <input
        id="v7-location-city"
        value={value.city || ''}
        placeholder="Ville ou commune"
        disabled={value.unknown}
        onChange={(event) => onChange({ ...value, city: event.target.value, unknown: false })}
      />
      <label className="location-unknown">
        <input type="checkbox" checked={Boolean(value.unknown)} onChange={(event) => onChange({ ...value, unknown: event.target.checked, city: '' })} />
        Je ne connais pas encore la ville
      </label>
    </section>
  );
}