import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Hilfsfunktion für das Strategieverbot (2:1 / 1:2)
function isStrategieTipp(h, a) {
  return (h === 2 && a === 1) || (h === 1 && a === 2);
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('ergebnisse');
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [ergebnisse, setErgebnisse] = useState({});
  const [saving, setSaving] = useState({});
  const [alleTrainer, setAlleTrainer] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [adminTipps, setAdminTipps] = useState({});
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Lade Daten bei Spieltagwechsel oder Start
  useEffect(() => { loadSpielplan(); }, [spieltag]);
  useEffect(() => { loadTrainer(); }, []);
  useEffect(() => {
    if (selectedTrainer && spiele.length > 0) loadTipps(selectedTrainer.id);
  }, [selectedTrainer, spiele]);

  async function loadSpielplan() {
    const { data } = await supabase.from('spielplan').select('*').eq('spieltag', spieltag).order('id');
    setSpiele(data || []);
    const map = {};
    (data || []).forEach(s => {
      map[s.id] = { heim: s.ergebnis_heim ?? '', gast: s.ergebnis_gast ?? '' };
    });
    setErgebnisse(map);
  }

  async function loadTrainer() {
    const { data } = await supabase.from('trainer_vereine').select('*').order('trainer_name');
    setAlleTrainer(data || []);
    if (data?.length > 0) setSelectedTrainer(data[0]);
  }

  async function loadTipps(trainerId) {
    const spielIds = spiele.map(s => s.id);
    if (!spielIds.length) return;
    const { data } = await supabase.from('tipps').select('*').eq('trainer_id', trainerId).in('spiel_id', spielIds);
    const map = {};
    (data || []).forEach(t => { map[t.spiel_id] = { heim: t.tipp_heim ?? '', gast: t.tipp_gast ?? '' }; });
    setAdminTipps(map);
  }

  // --- LOGIK: ERGEBNISSE SPEICHERN ---
  async function saveErgebnis(spielId) {
    const e = ergebnisse[spielId];
    if (e.heim === '' || e.gast === '') return;
    setSaving(prev => ({ ...prev, [spielId]: true }));
    await supabase.from('spielplan').update({
      ergebnis_heim: parseInt(e.heim), ergebnis_gast: parseInt(e.gast)
    }).eq('id', spielId);
    setSaving(prev => ({ ...prev, [spielId]: false }));
  }

  // --- LOGIK: TIPPS MANUELL SPEICHERN ---
  async function saveTipps() {
    if (!selectedTrainer) return;
    setAdminSaving(true);
    const upserts = spiele
      .filter(s => adminTipps[s.id]?.heim !== '' && adminTipps[s.id]?.gast !== '')
      .map(s => ({
        trainer_id: selectedTrainer.id,
        spiel_id: s.id,
        tipp_heim: parseInt(adminTipps[s.id].heim),
        tipp_gast: parseInt(adminTipps[s.id].gast),
      }));
    await supabase.from('tipps').upsert(upserts, { onConflict: 'trainer_id,spiel_id' });
    setAdminSaving(false);
    alert("Tipps gespeichert!");
  }

  // --- DIE NEUEN SQL-FUNKTIONEN (RPC) ---
  async function triggerRandomTipps() {
    const { error } = await supabase.rpc('generate_random_tipps');
    if (error) alert(error.message);
    else {
        alert("Zufallstipps für alle Trainer generiert!");
        loadTipps(selectedTrainer.id);
    }
  }

  async function triggerReset() {
    if (window.confirm("Bist du sicher? Alle Tipps und Ergebnisse werden gelöscht!")) {
      await supabase.rpc('reset_all_data');
      loadSpielplan();
      setAdminTipps({});
      alert("Daten zurückgesetzt.");
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Admin Dashboard (Bundesliga Tippspiel)</h1>

      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('ergebnisse')}>Ergebnisse</button>
        <button onClick={() => setActiveTab('tipps')}>Tipps verwalten</button>
        <button onClick={() => setActiveTab('reset')} style={{ color: 'red' }}>Gefahrenzone</button>
      </div>

      {/* Spieltag-Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))}>←</button>
        <span style={{ margin: '0 15px', fontWeight: 'bold' }}>Spieltag {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(34, s + 1))}>→</button>
      </div>

      {/* TAB: ERGEBNISSE */}
      {activeTab === 'ergebnisse' && (
        <div className="card">
          {spiele.map(spiel => (
            <div key={spiel.id} style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
              <span style={{ width: '150px' }}>{spiel.heim_team}</span>
              <input type="number" value={ergebnisse[spiel.id]?.heim} 
                onChange={e => setErgebnisse({...ergebnisse, [spiel.id]: {...ergebnisse[spiel.id], heim: e.target.value}})} style={{ width: '40px' }} />
              :
              <input type="number" value={ergebnisse[spiel.id]?.gast} 
                onChange={e => setErgebnisse({...ergebnisse, [spiel.id]: {...ergebnisse[spiel.id], gast: e.target.value}})} style={{ width: '40px' }} />
              <span>{spiel.gast_team}</span>
              <button onClick={() => saveErgebnis(spiel.id)}>{saving[spiel.id] ? '...' : 'Speichern'}</button>
            </div>
          ))}
        </div>
      )}

      {/* TAB: TIPPS */}
      {activeTab === 'tipps' && (
        <div>
          <select onChange={(e) => setSelectedTrainer(alleTrainer.find(t => t.id == e.target.value))}>
            {alleTrainer.map(t => <option key={t.id} value={t.id}>{t.trainer_name} ({t.verein})</option>)}
          </select>
          
          <button onClick={triggerRandomTipps} style={{ marginLeft: '10px' }}>🎲 Random Tipps für ALLE</button>

          <div style={{ marginTop: '20px' }}>
            {spiele.map(spiel => (
              <div key={spiel.id} style={{ marginBottom: '5px' }}>
                {spiel.heim_team} 
                <input type="number" value={adminTipps[spiel.id]?.heim || ''} 
                  onChange={e => setAdminTipps({...adminTipps, [spiel.id]: {...adminTipps[spiel.id], heim: e.target.value}})} />
                :
                <input type="number" value={adminTipps[spiel.id]?.gast || ''} 
                  onChange={e => setAdminTipps({...adminTipps, [spiel.id]: {...adminTipps[spiel.id], gast: e.target.value}})} />
                {spiel.gast_team}
              </div>
            ))}
            <button onClick={saveTipps} disabled={adminSaving} style={{ marginTop: '10px', padding: '10px', background: 'green', color: 'white' }}>
              Tipps für {selectedTrainer?.trainer_name} speichern
            </button>
          </div>
        </div>
      )}

      {/* TAB: RESET */}
      {activeTab === 'reset' && (
        <div style={{ border: '1px solid red', padding: '20px' }}>
          <h3>Achtung!</h3>
          <button onClick={triggerReset} style={{ background: 'red', color: 'white', padding: '10px' }}>
            ALLE SAISON-DATEN LÖSCHEN
          </button>
        </div>
      )}
    </div>
  );
}
