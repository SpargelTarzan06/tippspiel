import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [spieler, setSpieler] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadSpieler(session.user.email);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadSpieler(session.user.email);
      else { setSpieler(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadSpieler(email) {
    const { data } = await supabase
      .from('spieler')
      .select('*, vereine(*)')
      .eq('email', email)
      .single();
    setSpieler(data);
    setLoading(false);
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">TIPP<span>LIGA</span></div>
      <div className="loading-bar"><div className="loading-fill"></div></div>
    </div>
  );

  if (!session) return <Login />;
  return <Dashboard spieler={spieler} onLogout={() => supabase.auth.signOut()} />;
}
