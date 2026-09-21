import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import RoomSelector from '../../components/Assistant/RoomSelector';
import WorkItemsList from '../../components/Assistant/WorkItemsList';
import DocumentMetadataMock from '../../components/Assistant/DocumentMetadataMock';

export default function ProjectWizard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = searchParams.get('id');
  const step = parseInt(searchParams.get('step')) || 1;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ title: '', location: '', projectType: 'Rénovation', budget: '' });

  useEffect(() => {
    if (projectId) {
      supabase.from('renovation_projects').select('*').eq('id', projectId).single()
        .then(({ data }) => {
          if (data) {
            setFormData({ title: data.title || '', location: data.location || '', projectType: data.notes?.split('|')[0]?.replace('Type: ', '').trim() || 'Rénovation', budget: data.budget || '' });
          }
        });
    }
  }, [projectId]);

  const saveProjectDetails = async (nextStep) => {
    if (!user) return navigate('/login');
    setSaving(true); setError(null);
    const rawCompletion = nextStep === 2 ? 65 : (nextStep === 3 ? 100 : 30);
    const safeCompletion = Math.min(Math.max(rawCompletion, 0), 100);
    const safeNotes = `Type: ${formData.projectType} \n${formData.title || ''}`;
    const payload = { user_id: user.id, title: formData.title, location: formData.location, budget: formData.budget ? parseFloat(formData.budget) : null, status: 'draft', completion_percentage: safeCompletion, notes: safeNotes, updated_at: new Date().toISOString() };
    try {
      if (projectId) {
        const { error: updateErr } = await supabase.from('renovation_projects').update(payload).eq('id', projectId);
        if (updateErr) throw updateErr;
        setSearchParams({ id: projectId, step: nextStep });
      } else {
        const { data, error: insertErr } = await supabase.from('renovation_projects').insert(payload).select().single();
        if (insertErr) throw insertErr;
        setSearchParams({ id: data.id, step: nextStep });
      }
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      <h2>Étape {step} / 3</h2>
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="text" placeholder="Titre du projet" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          <input type="text" placeholder="Localisation" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
          <input type="number" placeholder="Budget indicatif (€)" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} />
          <button onClick={() => saveProjectDetails(2)} disabled={saving}>{saving ? 'Enregistrement...' : 'Valider le projet'}</button>
        </div>
      )}
      {step === 2 && projectId && (
        <div>
          <RoomSelector projectId={projectId} />
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setSearchParams({ id: projectId, step: 1 })}>Retour</button>
            <button onClick={() => saveProjectDetails(3)} disabled={saving}>Valider les pièces</button>
          </div>
        </div>
      )}
      {step === 3 && projectId && (
        <div>
          <WorkItemsList projectId={projectId} />
          <DocumentMetadataMock projectId={projectId} />
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setSearchParams({ id: projectId, step: 2 })}>Retour</button>
            <button onClick={() => navigate('/dashboard')} style={{ background: '#16a34a', color: 'white' }}>Terminer</button>
          </div>
        </div>
      )}
    </div>
  );
}