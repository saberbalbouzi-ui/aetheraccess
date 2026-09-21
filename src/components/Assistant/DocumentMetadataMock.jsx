import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DocumentMetadataMock({ projectId }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleMockUpload = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: insErr } = await supabase.from('consultation_documents').insert({
        project_id: projectId,
        file_name: 'dossier-test.txt',
        file_path: 'mock/path/dossier-test.txt',
        file_type: 'text/plain'
      });
      if (insErr) throw insErr;
      setSuccess('Métadonnée enregistrée. Fichier physique non hébergé.');
    } catch (err) {
      setError("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '6px' }}>
      <h4>Documents du projet</h4>
      {error && <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '8px', marginBottom: '10px', borderRadius: '4px' }}>{error}</div>}
      {success && <div style={{ color: '#15803d', background: '#dcfce7', padding: '8px', marginBottom: '10px', borderRadius: '4px' }}>{success}</div>}
      <p style={{ fontSize: '13px', color: '#475569' }}>Enregistrement des métadonnées de documents (stockage physique non configuré).</p>
      <button onClick={handleMockUpload} disabled={saving}>
        {saving ? 'Enregistrement...' : 'Simuler ajout Document'}
      </button>
    </div>
  );
}