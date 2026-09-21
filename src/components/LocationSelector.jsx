import { useEffect, useRef, useState } from 'react';
import { REGIONS } from '../data/france-regions';
import { departmentsOfRegion } from '../data/france-departments';
import { filterCommunes, getCommunesOfDepartment } from '../services/location-service';

// Pays extensible : France par défaut, l'API de localisation peut en accueillir d'autres.
const COUNTRIES = [{ code: 'FR', label: 'France' }];

export default function LocationSelector({ value = {}, onChange }) {
  const [query, setQuery] = useState(value.city || '');
  const [communes, setCommunes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const listRef = useRef(null);

  const departments = value.regionCode ? departmentsOfRegion(value.regionCode) : [];
  const unknown = Boolean(value.unknown);

  useEffect(() => {
    let cancelled = false;
    if (!value.departmentCode || unknown) {
      setCommunes([]);
      return undefined;
    }
    setLoading(true);
    setApiError('');
    getCommunesOfDepartment(value.departmentCode)
      .then((list) => { if (!cancelled) setCommunes(list); })
      .catch((error) => { if (!cancelled) setApiError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [value.departmentCode, unknown]);

  useEffect(() => {
    setResults(filterCommunes(communes, query));
  }, [communes, query]);

  const selectRegion = (event) => {
    const region = REGIONS.find((item) => item.code === event.target.value);
    setQuery('');
    setResults([]);
    onChange({ unknown: false, country: { code: 'FR', label: 'France' }, regionCode: region?.code || '', regionName: region?.name || '' });
  };

  const selectDepartment = (event) => {
    const department = departments.find((item) => item.code === event.target.value);
    setQuery('');
    setResults([]);
    onChange({ ...value, departmentCode: department?.code || '', departmentName: department?.name || '', city: '', cityCode: '', postalCode: '' });
  };

  const selectCommune = (commune) => {
    setQuery(commune.name);
    setResults([]);
    onChange({
      ...value,
      city: commune.name,
      cityCode: commune.code,
      postalCode: commune.postalCodes.length === 1 ? commune.postalCodes[0] : value.postalCode && commune.postalCodes.includes(value.postalCode) ? value.postalCode : '',
      postalCodes: commune.postalCodes,
    });
  };

  const selectPostalCode = (event) => {
    onChange({ ...value, postalCode: event.target.value });
  };

  const toggleUnknown = (event) => {
    if (event.target.checked) {
      setQuery('');
      setResults([]);
      onChange({ unknown: true });
    } else {
      onChange({ unknown: false });
    }
  };

  const postalCodes = value.postalCodes || [];

  return (
    <section className="location-selector">
      <label className="location-unknown">
        <input type="checkbox" checked={unknown} onChange={toggleUnknown} />
        Je ne connais pas encore la ville
      </label>
      {unknown ? (
        <p className="location-later">La localisation pourra être complétée plus tard.</p>
      ) : null}

      {!unknown ? (
        <div className="location-grid">
          <label>
            Pays
            <select value={value.country?.code || 'FR'} disabled={COUNTRIES.length === 1} onChange={() => {}}>
              {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
            </select>
          </label>

          <label>
            Région
            <select value={value.regionCode || ''} onChange={selectRegion}>
              <option value="">Choisir une région</option>
              {REGIONS.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </label>

          <label>
            Département
            <select value={value.departmentCode || ''} onChange={selectDepartment} disabled={!value.regionCode}>
              <option value="">{value.regionCode ? 'Choisir un département' : 'Sélectionnez d’abord une région'}</option>
              {departments.map((department) => <option key={department.code} value={department.code}>{department.code} — {department.name}</option>)}
            </select>
          </label>

          <label className="location-city">
            Ville ou commune
            <input
              type="text"
              value={query}
              placeholder={loading ? 'Chargement des communes…' : 'Commencez à taper le nom'}
              disabled={!value.departmentCode || loading}
              onChange={(event) => {
                setQuery(event.target.value);
                if (value.city) onChange({ ...value, city: '', cityCode: '', postalCode: '', postalCodes: [] });
              }}
              onBlur={() => setTimeout(() => setResults([]), 150)}
            />
            {results.length ? (
              <ul className="commune-results" ref={listRef}>
                {results.map((commune) => (
                  <li key={commune.code}>
                    <button type="button" onMouseDown={(event) => { event.preventDefault(); selectCommune(commune); }}>
                      {commune.name}<small>{commune.postalCodes.join(', ')}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {apiError ? <small className="location-error">{apiError} Vous pourrez préciser la ville plus tard.</small> : null}
          </label>

          {postalCodes.length > 1 ? (
            <label>
              Code postal
              <select value={value.postalCode || ''} onChange={selectPostalCode}>
                <option value="">Choisir</option>
                {postalCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
          ) : null}
          {postalCodes.length === 1 && value.city ? (
            <p className="location-postal-auto">Code postal : {postalCodes[0]}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
