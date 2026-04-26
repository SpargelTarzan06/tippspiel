import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('ergebnisse');
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [ergebnisse, setErgebnisse] = useState({});
  const [saving, setSaving] = useState({});
  const [alleSpieler, setAlleSpieler] = useState([]);
  const [selectedSpieler, setSelectedSpieler] = useState(null);
  const [adminTipps, setAdminTipps] = useState({});
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => { loadSpiele(); }, [spieltag]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSpieler(); }, []);

  async function loadSpiele() {
    const { data } = await supabase.from('spiele').select('*').eq('spieltag', spieltag).order('id');
    setSpiele(data || []);
    const map = {};
    (data || []).forEach(s => {
      map[s.id] = { heim: s.heim_tore ?? '', auswaerts: s.auswaerts_tore ?? '', eingetragen: s.ergebnis_eingetragen };
    });
    setErgebnisse(map);
  }

  async function loadSpieler() {
    const { data } = await supabase.from('spieler').select('*, vereine(*)').order('id');
    setAlleSpieler(data || []);
    if (data && data.length > 0) setSelectedSpieler(data[0]);
  }

  async function loadAdminTipps(spielerId) {
    const spielIds = spiele.map(s => s.id);
    if (spielIds.length === 0) return;
    const { data } = await supabase.from('tipps').select('*')
      .eq('spieler_id', spielerId).in('spiel_id', spielIds);
    const map = {};
    (data || []).forEach(t => { map[t.spiel_id] = { heim: t.heim_tipp ?? '', auswaerts: t.auswaerts_tipp ?? '' }; });
    setAdminTipps(map);
    setAdminSaved(false);
  }

  useEffect(() => {
    if (selectedSpieler && spiele.length > 0) loadAdminTipps(selectedSpieler.id);
  }, [selectedSpieler, spiele]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleErgebnisChange(spielId, seite, wert) {
    const num = wert === '' ? '' : Math.max(0, Math.min(99, parseInt(wert) || 0));
    setErgebnisse(prev => ({ ...prev, [spielId]: { ...prev[spielId], [seite]: num, eingetragen: false } }));
  }

  async function saveErgebnis(spielId) {
    const e = ergebnisse[spielId];
    if (e.heim === '' || e.auswaerts === '') return;
    setSaving(prev => ({ ...prev, [spielId]: true }));
    await supabase.from('spiele').update({
      heim_tore: parseInt(e.heim), auswaerts_tore: parseInt(e.auswaerts), ergebnis_eingetragen: true,
    }).eq('id', spielId);
    setErgebnisse(prev => ({ ...prev, [spielId]: { ...prev[spielId], eingetragen: true } }));
    setSaving(prev => ({ ...prev, [spielId]: false }));
  }

  async function spieltagAbschliessen() {
    const ids = spiele.filter(s => ergebnisse[s.id]?.heim !== '' && ergebnisse[s.id]?.auswaerts !== '').map(s => s.id);
    for (const id of ids) await saveErgebnis(id);
  }

  // Strategieverbot: max 5x 2:1 oder 1:2 pro Spieltag
  function checkStrategieverbot(spielId, newTipps) {
    const count21 = spiele.filter(s => {
      const t = s.id === spielId ? newTipps : adminTipps[s.id];
      if (!t || t.heim === '' || t.auswaerts === '') return false;
      const h = parseInt(t.heim), a = parseInt(t.auswaerts);
      return (h === 2 && a === 1) || (h === 1 && a === 2);
    }).length;
    return count21;
  }

  function handleAdminTippChange(spielId, seite, wert) {
    const num = wert === '' ? '' : Math.max(0, Math.min(99, parseInt(wert) || 0));
    const newTipp = { ...adminTipps[spielId], [seite]: num };
    const count = checkStrategieverbot(spielId, newTipp);
    if (count > 5) {
      alert('⛔ Strategieverbot! Maximal 5x das Ergebnis 2:1 oder 1:2 pro Spieltag erlaubt.');
      return;
    }
    setAdminTipps(prev => ({ ...prev, [spielId]: newTipp }));
    setAdminSaved(false);
  }

  async function saveAdminTipps() {
    if (!selectedSpieler) return;
    setAdminSaving(true);
    const upserts = spiele
      .filter(s => adminTipps[s.id]?.heim !== '' && adminTipps[s.id]?.auswaerts !== '' &&
                   adminTipps[s.id]?.heim !== undefined)
      .map(s => ({
        spieler_id: selectedSpieler.id,
        spiel_id: s.id,
        heim_tipp: parseInt(adminTipps[s.id].heim),
        auswaerts_tipp: parseInt(adminTipps[s.id].auswaerts),
      }));
    await supabase.from('tipps').upsert(upserts, { onConflict: 'spieler_id,spiel_id' });
    setAdminSaving(false);
    setAdminSaved(true);
  }

  async function resetAlleTipps() {
    await supabase.from('tipps').delete().neq('id', 0);
    // Setze alle Ergebnisse zurück
    await supabase.from('spiele').update({ heim_tore: null, auswaerts_tore: null, ergebnis_eingetragen: false }).neq('id', 0);
    setResetDone(true);
    setResetConfirm(false);
    loadSpiele();
  }

  // Count 2:1 / 1:2 for current spieler
  const count21 = spiele.filter(s => {
    const t = adminTipps[s.id];
    if (!t || t.heim === '' || t.auswaerts === '') return false;
    const h = parseInt(t.heim), a = parseInt(t.auswaerts);
    return (h === 2 && a === 1) || (h === 1 && a === 2);
  }).length;

  const tabs = [
    { id: 'ergebnisse', label: '📋 Ergebnisse' },
    { id: 'tipps', label: '✏️ Tipps verwalten' },
    { id: 'reset', label: '🔄 Reset' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">ADMIN BEREICH</div>
        <div className="page-subtitle">Nur für Administratoren</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? 'var(--accent)' : 'var(--bg3)',
            color: activeTab === t.id ? '#000' : 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer',
            fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Spieltag Nav (shared) */}
      {(activeTab === 'ergebnisse' || activeTab === 'tipps') && (
        <div className="spieltag-nav" style={{ marginBottom: 20 }}>
          <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
          <span className="spieltag-label">SPIELTAG {spieltag}</span>
          <button onClick={() => setSpieltag(s => Math.min(34, s + 1))} disabled={spieltag >= 34}>Weiter →</button>
        </div>
      )}

      {/* TAB: Ergebnisse */}
      {activeTab === 'ergebnisse' && (
        <div className="card">
          <div className="card-title">ERGEBNISSE EINTRAGEN</div>
          {spiele.map(spiel => (
            <div className="admin-spiel-row" key={spiel.id}>
              <div style={{ fontSize: 14 }}>
                <strong>{spiel.heim}</strong>
                <span style={{ color: 'var(--text2)', margin: '0 8px' }}>–</span>
                <strong>{spiel.auswaerts}</strong>
              </div>
              <div className="spiel-tipp">
                <input className="tipp-input" type="number" min="0" max="99"
                  value={ergebnisse[spiel.id]?.heim ?? ''}
                  onChange={e => handleErgebnisChange(spiel.id, 'heim', e.target.value)} />
                <span className="tipp-separator">:</span>
                <input className="tipp-input" type="number" min="0" max="99"
                  value={ergebnisse[spiel.id]?.auswaerts ?? ''}
                  onChange={e => handleErgebnisChange(spiel.id, 'auswaerts', e.target.value)} />
              </div>
              <button className={`btn-confirm ${ergebnisse[spiel.id]?.eingetragen ? 'saved' : ''}`}
                onClick={() => saveErgebnis(spiel.id)} disabled={saving[spiel.id]}>
                {ergebnisse[spiel.id]?.eingetragen ? '✓ Gespeichert' : saving[spiel.id] ? '...' : 'Speichern'}
              </button>
            </div>
          ))}
          <button className="btn-save" style={{ marginTop: 20 }} onClick={spieltagAbschliessen}>
            ✓ Alle speichern
          </button>
        </div>
      )}

      {/* TAB: Tipps verwalten */}
      {activeTab === 'tipps' && (
        <div>
          {/* Spieler Auswahl */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">SPIELER AUSWÄHLEN</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {alleSpieler.map(s => (
                <button key={s.id} onClick={() => setSelectedSpieler(s)} style={{
                  background: selectedSpieler?.id === s.id ? 'var(--accent)' : 'var(--bg3)',
                  color: selectedSpieler?.id === s.id ? '#000' : 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 12px', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontSize: 13,
                }}>
                  <strong>{s.vereine?.kurz}</strong> · {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Strategieverbot Anzeige */}
          <div style={{
            background: count21 >= 5 ? 'rgba(255,68,85,0.1)' : 'rgba(0,212,170,0.05)',
            border: `1px solid ${count21 >= 5 ? 'rgba(255,68,85,0.3)' : 'var(--border)'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            fontSize: 13, color: count21 >= 5 ? 'var(--red)' : 'var(--text2)',
          }}>
            ⚠️ Strategieverbot: <strong>{count21}/5</strong> erlaubte 2:1 / 1:2 Tipps für Spieltag {spieltag}
            {count21 >= 5 && ' – Limit erreicht!'}
          </div>

          {/* Tipps eintragen */}
          {selectedSpieler && (
            <div className="card">
              <div className="card-title">
                TIPPS FÜR {selectedSpieler.vereine?.name} · {selectedSpieler.name}
              </div>
              {spiele.map(spiel => (
                <div className="spiel-row" key={spiel.id}>
                  <div className="spiel-team heim">{spiel.heim}</div>
                  <div className="spiel-tipp">
                    <input className="tipp-input" type="number" min="0" max="99"
                      value={adminTipps[spiel.id]?.heim ?? ''}
                      onChange={e => handleAdminTippChange(spiel.id, 'heim', e.target.value)} />
                    <span className="tipp-separator">:</span>
                    <input className="tipp-input" type="number" min="0" max="99"
                      value={adminTipps[spiel.id]?.auswaerts ?? ''}
                      onChange={e => handleAdminTippChange(spiel.id, 'auswaerts', e.target.value)} />
                  </div>
                  <div className="spiel-team auswaerts">{spiel.auswaerts}</div>
                </div>
              ))}
              <button className="btn-save" onClick={saveAdminTipps} disabled={adminSaving}>
                {adminSaving ? 'Wird gespeichert...' : `💾 Tipps für ${selectedSpieler.name} speichern`}
              </button>
              {adminSaved && <div className="success-msg">✓ Tipps gespeichert!</div>}
            </div>
          )}
        </div>
      )}

      {/* TAB: Reset */}
      {activeTab === 'reset' && (
        <div className="card">
          <div className="card-title">🔄 SAISON RESET</div>
          <p style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 14 }}>
            Setzt alle Tipps und alle Ergebnisse zurück. Die Saison startet von vorne.
            Spieler, Vereine und Spielplan bleiben erhalten.
          </p>
          {!resetConfirm && !resetDone && (
            <button onClick={() => setResetConfirm(true)} style={{
              background: 'rgba(255,68,85,0.15)', border: '1px solid var(--red)',
              borderRadius: 8, padding: '12px 24px', color: 'var(--red)',
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 15,
            }}>
              ⚠️ Alle Tipps & Ergebnisse zurücksetzen
            </button>
          )}
          {resetConfirm && (
            <div>
              <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 16 }}>
                Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={resetAlleTipps} style={{
                  background: 'var(--red)', border: 'none', borderRadius: 8,
                  padding: '12px 24px', color: '#fff', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontWeight: 600, fontSize: 15,
                }}>Ja, alles zurücksetzen</button>
                <button onClick={() => setResetConfirm(false)} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 24px', color: 'var(--text)', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontSize: 15,
                }}>Abbrechen</button>
              </div>
            </div>
          )}
          {resetDone && (
            <div className="success-msg">✓ Saison erfolgreich zurückgesetzt! Alle Tipps und Ergebnisse wurden gelöscht.</div>
          )}
        </div>
      )}
    </div>
  );
}
