import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function WorkItemsList({ projectId }) {
  const [rooms, setRooms] = useState([]);
  const [newItem, setNewItem] = useState({ room_id: '', trade_category: '', description: '', is_ai_suggested: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoomsAndWorks = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('project_rooms')
      .select('id, room_name, room_work_items(*)')
      .eq('project_id', projectId);
    if (!fetchErr) {
      setRooms(data || []);
      if (data?.length > 0 && !newItem.room_id) setNewItem(p => ({ ...p, room_id: data[0].id }));
    }
  }, [projectId, newItem.room_id]);

  useEffect(() => { if (projectId) fetchRoomsAndWorks(); }, [projectId, fetchRoomsAndWorks]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.room_id || !newItem.trade_category.trim()) return;
    setSaving(true); setError(null);
    try {
      const { error: insErr } = await supabase.from('room_work_items').insert({
        room_id: newItem.room_id,
        trade_category: newItem.trade_category,
        description: newItem.description,
        is_ai_suggested: newItem.is_ai_suggested,
        status: 'proposed'
      });
      if (insErr) throw insErr;
      setNewItem(p => ({ ...p, trade_category: '', description: '', is_ai_suggested: false }));
      await fetchRoomsAndWorks();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce lot de travaux ?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('room_work_items').delete().eq('id', id);
      if (delErr) throw delErr;
      await fetchRoomsAndWorks();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h3>Lots et Travaux</h3>
      {error && <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px', marginBottom: '15px' }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={newItem.room_id} onChange={e => setNewItem({...newItem, room_id: e.target.value})} disabled={saving} required>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
        </select>
        <input type="text" placeholder="Lot (ex: Plomberie)" required value={newItem.trade_category} onChange={e => setNewItem({...newItem, trade_category: e.target.value})} disabled={saving} />
        <input type="text" placeholder="Description" required value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} disabled={saving} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="checkbox" checked={newItem.is_ai_suggested} onChange={e => setNewItem({...newItem, is_ai_suggested: e.target.checked})} disabled={saving} /> Suggestion IA
        </label>
        <button type="submit" disabled={saving}>{saving ? '...' : 'Ajouter travail'}</button>
      </form>
      {rooms.map(r => (
        <div key={r.id} style={{ marginBottom: '15px', background: '#f8fafc', padding: '10px' }}>
          <h4>{r.room_name}</h4>
          {r.room_work_items?.length === 0 ? <p style={{ fontSize: '13px', color: '#666' }}>Aucun travail défini pour cette pièce.</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {r.room_work_items?.map(w => (
                <li key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span><strong>{w.trade_category} :</strong> {w.description} {w.is_ai_suggested && <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>Proposition automatique</span>}</span>
                  <button onClick={() => handleDelete(w.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>X</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}