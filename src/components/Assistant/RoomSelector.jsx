import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function RoomSelector({ projectId }) {
  const [rooms, setRooms] = useState([]);
  const [newRoom, setNewRoom] = useState({ room_name: '', surface: '', notes: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRooms = useCallback(async () => {
    const { data, error: fetchErr } = await supabase.from('project_rooms').select('*').eq('project_id', projectId);
    if (!fetchErr) setRooms(data || []);
  }, [projectId]);

  useEffect(() => { 
    if (projectId) fetchRooms(); 
  }, [projectId, fetchRooms]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newRoom.room_name.trim()) return;
    setSaving(true); 
    setError(null);
    try {
      const { error: insErr } = await supabase.from('project_rooms').insert({
        project_id: projectId, room_name: newRoom.room_name,
        surface: newRoom.surface ? parseFloat(newRoom.surface) : null,
        notes: newRoom.notes
      });
      if (insErr) throw insErr;
      setNewRoom({ room_name: '', surface: '', notes: '' });
      await fetchRooms();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette pièce ? Tous les travaux associés seront également supprimés.')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('project_rooms').delete().eq('id', id);
      if (delErr) throw delErr;
      await fetchRooms();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h3>Pièces du projet</h3>
      {error && <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px', marginBottom: '15px' }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Nom de la pièce (ex: Cuisine)" required value={newRoom.room_name} onChange={e => setNewRoom({...newRoom, room_name: e.target.value})} disabled={saving} />
        <input type="number" placeholder="Surface (m²)" value={newRoom.surface} onChange={e => setNewRoom({...newRoom, surface: e.target.value})} disabled={saving} />
        <button type="submit" disabled={saving}>{saving ? '...' : 'Ajouter la pièce'}</button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rooms.map(r => (
          <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f8fafc', marginBottom: '5px', alignItems: 'center' }}>
            <span><strong>{r.room_name}</strong> {r.surface ? `(${r.surface} m²)` : ''}</span>
            <button onClick={() => handleDelete(r.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Supprimer</button>
          </li>
        ))}
      </ul>
      {rooms.length === 0 && <p style={{ color: '#666' }}>Aucune pièce enregistrée.</p>}
    </div>
  );
}