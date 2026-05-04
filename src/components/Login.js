import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    // Wir extrahieren nur 'error', da 'data' im Login-Prozess 
    // hier nicht direkt weiterverarbeitet werden muss.
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert("Login fehlgeschlagen: " + error.message);
    } else {
      console.log("Erfolgreich eingeloggt!");
      // Die App.js reagiert automatisch auf die neue Session
    }
    setLoading(false);
  }

  return (
    <div className="login-container" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'var(--bg)' 
    }}>
      <form className="card" onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px' }}>
        <div className="page-header" style={{ textAlign: 'center' }}>
          <div className="page-title">BUNDESLIGA TIPP</div>
          <div className="page-subtitle">Bitte einloggen</div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text2)' }}>Email</label>
          <input 
            type="email" 
            className="tipp-input" 
            style={{ width: '100%' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text2)' }}>Passwort</label>
          <input 
            type="password" 
            className="tipp-input" 
            style={{ width: '100%' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          style={{ width: '100%', padding: '12px' }}
          disabled={loading}
        >
          {loading ? 'Wird geprüft...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}