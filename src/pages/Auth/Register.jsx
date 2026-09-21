import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', role: 'particulier' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); 
    setSuccess(null); 
    setLoading(true);
    
    try {
      const { data, error: authError } = await signUp({
        email: formData.email, 
        password: formData.password, 
        fullName: formData.fullName, 
        role: formData.role
      });
      if (authError) throw authError;

      if (data?.user?.identities?.length === 0) {
        setError('Cet e-mail est déjà utilisé.');
      } else if (!data.session) {
        setSuccess('Inscription réussie. Veuillez confirmer votre e-mail avant de vous connecter.');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto' }}>
      <h2>Créer un compte</h2>
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: '15px' }}>{success}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
          <option value="particulier">Particulier</option>
          <option value="entreprise">Entreprise</option>
        </select>
        <input type="text" placeholder="Nom complet" required onChange={e => setFormData({...formData, fullName: e.target.value})} />
        <input type="email" placeholder="E-mail" required onChange={e => setFormData({...formData, email: e.target.value})} />
        <input type="password" placeholder="Mot de passe" required minLength={6} onChange={e => setFormData({...formData, password: e.target.value})} />
        <button type="submit" disabled={loading}>S'inscrire</button>
      </form>
      <Link to="/login">Déjà un compte ? Se connecter</Link>
    </div>
  );
}