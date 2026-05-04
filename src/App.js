import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Tipps from './components/Tipps';
import Tabelle from './components/Tabelle';
import MeinePunkte from './components/MeinePunkte';
import Admin from './components/Admin';
import SpielerDetail from './components/SpielerDetail';

export default function App() {
  const [session, setSession] = useState(null);
  const [trainer, setTrainer] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);

  useEffect(() => {
    // 1. Session prüfen
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadTrainerData(session.user.email);
    });

    // 2. Auth-Changes abfangen
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadTrainerData(session.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadTrainerData(email) {
    const { data } = await supabase
      .from('trainer_vereine')
      .select('*')
      .eq('email', email)
      .single();
    setTrainer(data);
  }

  // Hilfsfunktion zum Wechseln der Ansicht (z.B. von Tabelle zu Detail)
  const openTrainerDetail = (id) => {
    setSelectedTrainerId(id);
    setView('spielerdetail');
  };

  if (!session) return <Login />;
  if (!trainer) return <div className="loading">Lade Trainer-Profil...</div>;

  return (
    <div className="app-layout">
      {/* SIDEBAR NAVIGATION */}
      <nav className="sidebar">
        <div className="logo">⚽ BUNDESLIGA<span>TIPP</span></div>
        <div className="nav-items">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>🏠 Dashboard</button>
          <button className={view === 'tipps' ? 'active' : ''} onClick={() => setView('tipps')}>✍️ Tipps abgeben</button>
          <button className={view === 'tabelle' ? 'active' : ''} onClick={() => setView('tabelle')}>📊 Tabelle</button>
          <button className={view === 'meinepunkte' ? 'active' : ''} onClick={() => setView('meinepunkte')}>🎯 Meine Punkte</button>
          
          {trainer.ist_admin && (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>⚙️ Admin</button>
          )}
        </div>
        <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Abmelden</button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="content">
        {view === 'dashboard' && <Dashboard trainer={trainer} setView={setView} />}
        {view === 'tipps' && <Tipps trainer={trainer} />}
        {view === 'tabelle' && <Tabelle onSelectTrainer={openTrainerDetail} />}
        {view === 'meinepunkte' && <MeinePunkte trainer={trainer} />}
        {view === 'admin' && <Admin />}
        {view === 'spielerdetail' && (
          <SpielerDetail 
            trainerId={selectedTrainerId} 
            onBack={() => setView('tabelle')} 
          />
        )}
      </main>
    </div>
  );
}