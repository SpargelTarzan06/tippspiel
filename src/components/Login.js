import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Authentifizierung bei Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (authError) {
      setError('E-Mail oder Passwort falsch.');
      setLoading(false);
      return;
    }

    // 2. Trainer-Daten aus der Datenbank abrufen
    // Wir suchen in 'trainer_vereine' nach der E-Mail des Users
    const { data: trainerData, error: dbError } = await supabase
      .from('trainer_vereine')
      .select('*')
      .eq('email', email)
      .single();

    if (dbError || !trainerData) {
      console.error("Datenbank-Fehler:", dbError);
      setError('Login erfolgreich, aber kein Trainer-Profil gefunden. Kontaktiere den Admin.');
      setLoading(false);
      return;
    }

    // 3. Erfolg! Wir geben die Trainer-Daten an die App.js weiter
    setLoading(false);
    if (onLoginSuccess) {
      onLoginSuccess(trainerData);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">TIPP<span>LIGA</span></div>
        <div className="login-subtitle">Bundesliga Tippspiel 2025/26</div>
        <h2>Anmelden</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
            />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}