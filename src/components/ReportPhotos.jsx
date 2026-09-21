import { useEffect, useState } from 'react';
import { getPhotoUrls } from '../services/photo-service';

// Galerie de photos d’un compte rendu : URLs signées (bucket privé), lightbox au clic.
export default function ReportPhotos({ paths = [] }) {
  const [urls, setUrls] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!paths.length) {
      setUrls([]);
      return undefined;
    }
    getPhotoUrls(paths).then(({ urls: signed }) => {
      if (!cancelled) setUrls(signed);
    });
    return () => { cancelled = true; };
  }, [paths]);

  if (!urls.length) return null;

  return (
    <>
      <div className="report-photos">
        {urls.map((url, index) => (
          <button key={url} type="button" className="report-photo" onClick={() => setActive(index)}>
            <img src={url} alt={`Photo du compte rendu ${index + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      {active !== null ? (
        <div className="photo-lightbox" role="dialog" aria-label="Photo agrandie" onClick={() => setActive(null)}>
          <img src={urls[active]} alt={`Photo ${active + 1} en grand`} />
        </div>
      ) : null}
    </>
  );
}
