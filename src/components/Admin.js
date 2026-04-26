import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function is21(h, a) {
  return (h === 2 && a === 1) || (h === 1 && a === 2);
}

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
  const [adminError, setAdminError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { loadSpiele(); }, [spieltag]); // eslint-disable-line
  useEffect(() => { loadSpieler(); }, []);
  useEffect(() => {
    if (selectedSpieler && spiele.length > 0) loadAdminTipps(selectedSpieler.id);
  }, [selectedSpieler, spiele]); // eslint-disable-line

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
    if (data?.length > 0) setSelectedSpieler(data[0]);
  }

  async function loadAdminTipps(spielerId) {
    const spielIds = spiele.map(s => s.id);
    if (!spielIds.length) return;
    const { data } = await supabase.from('tipps').select('*').eq('spieler_id', spielerId).in('spiel_id', spielIds);
    const map = {};
    (data || []).forEach(t => { map[t.spiel_id] = { heim: t.heim_tipp ?? '', auswaerts: t.auswaerts_tipp ?? '' }; });
    setAdminTipps(map);
    setAdminSaved(false);
    setAdminError('');
  }

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

  function count21inTipps(tippsMap) {
    return spiele.filter(s => {
      const t = tippsMap[s.id];
      if (!t || t.heim === '' || t.auswaerts === '') return false;
      return is21(parseInt(t.heim), parseInt(t.auswaerts));
    }).length;
  }

  function handleAdminTippChange(spielId, seite, wert) {
    const num = wert === '' ? '' : Math.max(0, Math.min(99, parseInt(wert) || 0));
    const newTipps = { ...adminTipps, [spielId]: { ...adminTipps[spielId], [seite]: num } };
    setAdminTipps(newTipps);
    setAdminSaved(false);
    setAdminError('');
  }

  async function saveAdminTipps() {
    if (!selectedSpieler) return;
    // Check 2:1 rule before saving
    const count = count21inTipps(adminTipps);
    if (count > 5) {
      setAdminError(`⛔ Strategieverbot! ${count}/5 erlaubte 2:1/1:2 Tipps. Bitte reduzieren!`);
      return;
    }
    setAdminSaving(true);
    setAdminError('');
    const upserts = spiele
      .filter(s => adminTipps[s.id]?.heim !== '' && adminTipps[s.id]?.auswaerts !== '' && adminTipps[s.id]?.heim !== undefined)
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

  async function simuliereTipps() {
    if (!selectedSpieler || !spiele.length) return;
    setSimulating(true);
    let attempts = 0;
    let newTipps = {};
    
    while (attempts < 100) {
      newTipps = {};
      for (const spiel of spiele) {
        const h = Math.floor(Math.random() * 6); // 0-5
        const a = Math.floor(Math.random() * 6);
        newTipps[spiel.id] = { heim: h, auswaerts: a };
      }
      if (count21inTipps(newTipps) <= 5) break;
      attempts++;
    }
    
    setAdminTipps(newTipps);
    setAdminSaved(false);
    setAdminError('');
    setSimulating(false);
  }

  async function simuliereAlleSpieler() {
    if (!spiele.length) return;
    setSimulating(true);
    for (const sp of alleSpieler) {
      let attempts = 0;
      let tipps = {};
      while (attempts < 100) {
        tipps = {};
        for (const spiel of spiele) {
          const h = Math.floor(Math.random() * 6);
          const a = Math.floor(Math.random() * 6);
          tipps[spiel.id] = { heim: h, auswaerts: a };
        }
        const count = spiele.filter(s => {
          const t = tipps[s.id];
          return t && is21(t.heim, t.auswaerts);
        }).length;
        if (count <= 5) break;
        attempts++;
      }
      const upserts = spiele.map(s => ({
        spieler_id: sp.id, spiel_id: s.id,
        heim_tipp: tipps[s.id].heim, auswaerts_tipp: tipps[s.id].auswaerts,
      }));
      await supabase.from('tipps').upsert(upserts, { onConflict: 'spieler_id,spiel_id' });
    }
    setSimulating(false);
    if (selectedSpieler) loadAdminTipps(selectedSpieler.id);
    alert(`✓ Zufällige Tipps für alle ${alleSpieler.length} Spieler für Spieltag ${spieltag} eingetragen!`);
  }

  async function resetAlles() {
    // Delete all tipps
    const { data: allTipps } = await supabase.from('tipps').select('id');
    if (allTipps?.length > 0) {
      const ids = allTipps.map(t => t.id);
      await supabase.from('tipps').delete().in('id', ids);
    }
    // Reset all spiele
    const { data: allSpiele } = await supabase.from('spiele').select('id');
    if (allSpiele?.length > 0) {
      const ids = allSpiele.map(s => s.id);
      await supabase.from('spiele').update({ heim_tore: null, auswaerts_tore: null, ergebnis_eingetragen: false }).in('id', ids);
    }
    setResetDone(true);
    setResetConfirm(false);
    loadSpiele();
  }

  const count21 = count21inTipps(adminTipps);
  const tabs = [
    { id: 'ergebnisse', label: '📋 Ergebnisse' },
    { id: 'tipps', label: '✏️ Tipps verwalten' },
    { id: 'reset', label: '🔄 Reset' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">ADMIN BEREICH</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? 'var(--accent)' : 'var(--bg3)',
            color: activeTab === t.id ? '#000' : 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14,
          }}>{t.label}</button>
        ))}
      </div>

      {(activeTab === 'ergebnisse' || activeTab === 'tipps') && (
        <div className="spieltag-nav" style={{ marginBottom: 20 }}>
          <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
          <span className="spieltag-label">SPIELTAG {spieltag}</span>
          <button onClick={() => setSpieltag(s => Math.min(34, s + 1))} disabled={spieltag >= 34}>Weiter →</button>
        </div>
      )}

      {/* ERGEBNISSE */}
      {activeTab === 'ergebnisse' && (
        <div className="card">
          <div className="card-title">ERGEBNISSE EINTRAGEN · SPIELTAG {spieltag}</div>
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
                {ergebnisse[spiel.id]?.eingetragen ? '✓ OK' : saving[spiel.id] ? '...' : 'Speichern'}
              </button>
            </div>
          ))}
          <button className="btn-save" style={{ marginTop: 20 }} onClick={() => spiele.forEach(s => saveErgebnis(s.id))}>
            ✓ Alle speichern
          </button>
        </div>
      )}

      {/* TIPPS VERWALTEN */}
      {activeTab === 'tipps' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">SPIELER AUSWÄHLEN</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {alleSpieler.map(s => (
                <button key={s.id} onClick={() => setSelectedSpieler(s)} style={{
                  background: selectedSpieler?.id === s.id ? 'var(--accent)' : 'var(--bg3)',
                  color: selectedSpieler?.id === s.id ? '#000' : 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 12px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13,
                }}>
                  <strong>{s.vereine?.kurz}</strong> · {s.name}
                </button>
              ))}
            </div>
            <button onClick={simuliereAlleSpieler} disabled={simulating} style={{
              background: 'rgba(255,107,53,0.15)', border: '1px solid var(--accent2)',
              borderRadius: 8, padding: '10px 20px', color: 'var(--accent2)',
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14,
            }}>
              {simulating ? '⏳ Simuliere...' : `🎲 Alle Spieler simulieren (ST ${spieltag})`}
            </button>
          </div>

          {/* Strategieverbot Anzeige */}
          <div style={{
            background: count21 >= 5 ? 'rgba(255,68,85,0.1)' : 'rgba(0,212,170,0.05)',
            border: `1px solid ${count21 >= 5 ? 'rgba(255,68,85,0.4)' : 'var(--border)'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13,
            color: count21 >= 5 ? 'var(--red)' : 'var(--text2)',
          }}>
            ⚠️ Strategieverbot: <strong>{count21}/5</strong> erlaubte 2:1/1:2 Tipps
            {count21 > 5 && ' – LIMIT ÜBERSCHRITTEN! Tipps können nicht gespeichert werden.'}
          </div>

          {selectedSpieler && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title" style={{ margin: 0 }}>
                  {selectedSpieler.vereine?.name} · {selectedSpieler.name}
                </div>
                <button onClick={simuliereTipps} disabled={simulating} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 14px', color: 'var(--text)',
                  cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13,
                }}>
                  {simulating ? '⏳' : '🎲 Zufällig'}
                </button>
              </div>
              {spiele.map(spiel => {
                const t = adminTipps[spiel.id];
                const h = t ? parseInt(t.heim) : NaN;
                const a = t ? parseInt(t.auswaerts) : NaN;
                const ist21 = !isNaN(h) && !isNaN(a) && is21(h, a);
                return (
                  <div className="spiel-row" key={spiel.id} style={{ background: ist21 ? 'rgba(255,68,85,0.05)' : 'transparent' }}>
                    <div className="spiel-team heim">{spiel.heim}</div>
                    <div className="spiel-tipp">
                      <input className="tipp-input" type="number" min="0" max="99"
                        value={adminTipps[spiel.id]?.heim ?? ''}
                        onChange={e => handleAdminTippChange(spiel.id, 'heim', e.target.value)}
                        style={{ borderColor: ist21 ? 'rgba(255,68,85,0.5)' : undefined }} />
                      <span className="tipp-separator">:</span>
                      <input className="tipp-input" type="number" min="0" max="99"
                        value={adminTipps[spiel.id]?.auswaerts ?? ''}
                        onChange={e => handleAdminTippChange(spiel.id, 'auswaerts', e.target.value)}
                        style={{ borderColor: ist21 ? 'rgba(255,68,85,0.5)' : undefined }} />
                      {ist21 && <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 4 }}>2:1!</span>}
                    </div>
                    <div className="spiel-team auswaerts">{spiel.auswaerts}</div>
                  </div>
                );
              })}
              {adminError && <div className="login-error" style={{ marginTop: 12 }}>{adminError}</div>}
              <button className="btn-save" onClick={saveAdminTipps} disabled={adminSaving || count21 > 5}
                style={{ opacity: count21 > 5 ? 0.4 : 1 }}>
                {adminSaving ? 'Wird gespeichert...' : `💾 Tipps für ${selectedSpieler.name} speichern`}
              </button>
              {adminSaved && <div className="success-msg">✓ Tipps gespeichert!</div>}
            </div>
          )}
        </div>
      )}

      {/* RESET */}
      {activeTab === 'reset' && (
        <div className="card">
          <div className="card-title">🔄 SAISON RESET</div>
          <p style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 14 }}>
            Setzt ALLE Tipps und ALLE Ergebnisse zurück. Spieler, Vereine und Spielplan bleiben erhalten.
          </p>
          {!resetConfirm && !resetDone && (
            <button onClick={() => setResetConfirm(true)} style={{
              background: 'rgba(255,68,85,0.15)', border: '1px solid var(--red)',
              borderRadius: 8, padding: '12px 24px', color: 'var(--red)',
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 15,
            }}>⚠️ Alle Tipps & Ergebnisse zurücksetzen</button>
          )}
          {resetConfirm && (
            <div>
              <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 16 }}>
                Bist du sicher? Das kann nicht rückgängig gemacht werden!
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={resetAlles} style={{
                  background: 'var(--red)', border: 'none', borderRadius: 8,
                  padding: '12px 24px', color: '#fff', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontWeight: 600, fontSize: 15,
                }}>Ja, alles zurücksetzen</button>
                <button onClick={() => setResetConfirm(false)} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 24px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 15,
                }}>Abbrechen</button>
              </div>
            </div>
          )}
          {resetDone && <div className="success-msg">✓ Saison erfolgreich zurückgesetzt!</div>}
        </div>
      )}
    </div>
  );
}
