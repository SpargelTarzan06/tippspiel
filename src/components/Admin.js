import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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

  async function saveErgebnis(spielId) {
    const e = ergebnisse[spielId];
    if (e.heim === '' || e.gast === '') return;
    
    setSaving(prev => ({ ...prev, [spielId]: true }));
    
    // WICHTIG: Setzt ergebnis_eingetragen auf true für die Punkte-View!
    const { error } = await supabase.from('spielplan').update({
      ergebnis_heim: parseInt(e.heim),
      ergebnis_gast: parseInt(e.gast),
      ergebnis_eingetragen: true 
    }).eq('id', spielId);

    if (error) alert("Fehler beim Speichern: " + error.message);
    setSaving(prev => ({ ...prev, [spielId]: false }));
  }

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
      
    const { error } = await supabase.from('tipps').upsert(upserts, { onConflict: 'trainer_id,spiel_id' });
    if (error) alert(error.message);
    else alert(`Tipps für ${selectedTrainer.trainer_name} gespeichert!`);
    
    setAdminSaving(false);
  }

  return (
    <div className="admin-container" style={{ padding: '20px' }}>
      <div className="page-header">
        <div className="page-title">ADMIN CONTROL</div>
        <div className="page-subtitle">Ergebnisse & Tipps verwalten</div>
      </div>

      <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={`btn-tab ${activeTab === 'ergebnisse' ? 'active' : ''}`} onClick={() => setActiveTab('ergebnisse')}>Ergebnisse</button>
        <button className={`btn-tab ${activeTab === 'tipps' ? 'active' : ''}`} onClick={() => setActiveTab('tipps')}>Tipps Editor</button>
        <button className="btn-tab danger" onClick={() => setActiveTab('reset')} style={{ marginLeft: 'auto' }}>Gefahrenzone</button>
      </div>

      <div className="spieltag-nav" style={{ marginBottom: '20px' }}>
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))}>←</button>
        <span className="spieltag-label">Spieltag {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(34, s + 1))}>→</button>
      </div>

      <div className="card">
        {activeTab === 'ergebnisse' && (
          <div className="admin-list">
            {spiele.map(spiel => (
              <div key={spiel.id} className="admin-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--bg3)' }}>
                <span style={{ flex: 1, textAlign: 'right' }}>{spiel.heim_team}</span>
                <input type="number" className="tipp-input" value={ergebnisse[spiel.id]?.heim} 
                  onChange={e => setErgebnisse({...ergebnisse, [spiel.id]: {...ergebnisse[spiel.id], heim: e.target.value}})} />
                <span>:</span>
                <input type="number" className="tipp-input" value={ergebnisse[spiel.id]?.gast} 
                  onChange={e => setErgebnisse({...ergebnisse, [spiel.id]: {...ergebnisse[spiel.id], gast: e.target.value}})} />
                <span style={{ flex: 1 }}>{spiel.gast_team}</span>
                <button className="btn-primary" onClick={() => saveErgebnis(spiel.id)}>{saving[spiel.id] ? '...' : 'Speichern'}</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tipps' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <select className="tipp-input" style={{ width: 'auto', flex: 1 }} value={selectedTrainer?.id} onChange={(e) => setSelectedTrainer(alleTrainer.find(t => t.id == e.target.value))}>
                {alleTrainer.map(t => <option key={t.id} value={t.id}>{t.trainer_name} ({t.verein})</option>)}
              </select>
              <button className="btn-secondary" onClick={async () => { await supabase.rpc('generate_random_tipps'); loadTipps(selectedTrainer.id); alert("Erledigt!"); }}>🎲 Random Tipps (Alle)</button>
            </div>

            {spiele.map(spiel => (
              <div key={spiel.id} className="admin-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{ width: '120px' }}>{spiel.heim_team}</span>
                <input type="number" className="tipp-input" value={adminTipps[spiel.id]?.heim || ''} 
                  onChange={e => setAdminTipps({...adminTipps, [spiel.id]: {...adminTipps[spiel.id], heim: e.target.value}})} />
                :
                <input type="number" className="tipp-input" value={adminTipps[spiel.id]?.gast || ''} 
                  onChange={e => setAdminTipps({...adminTipps, [spiel.id]: {...adminTipps[spiel.id], gast: e.target.value}})} />
                <span>{spiel.gast_team}</span>
              </div>
            ))}
            <button className="btn-primary" onClick={saveTipps} disabled={adminSaving} style={{ marginTop: '20px', width: '100%' }}>
              Tipps für {selectedTrainer?.trainer_name} speichern
            </button>
          </div>
        )}

        {activeTab === 'reset' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: 'var(--red)' }}>ACHTUNG!</h3>
            <p>Dies löscht alle Tipps und Ergebnisse der gesamten Saison.</p>
            <button className="btn-primary" style={{ background: 'var(--red)' }} onClick={async () => { 
              if(window.confirm("Wirklich ALLES löschen?")) { 
                await supabase.rpc('reset_all_data'); 
                loadSpielplan(); 
                alert("Reset durchgeführt.");
              }
            }}>SAISON KOMPLETT ZURÜCKSETZEN</button>
          </div>
        )}
      </div>
    </div>
  );
}