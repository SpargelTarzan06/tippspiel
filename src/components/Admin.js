import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Admin() {
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [ergebnisse, setErgebnisse] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => { loadSpiele(); }, [spieltag]);

  async function loadSpiele() {
    const { data } = await supabase
      .from('spiele')
      .select('*')
      .eq('spieltag', spieltag)
      .order('id');
    setSpiele(data || []);
    const map = {};
    (data || []).forEach(s => {
      map[s.id] = {
        heim: s.heim_tore ?? '',
        auswaerts: s.auswaerts_tore ?? '',
        eingetragen: s.ergebnis_eingetragen,
      };
    });
    setErgebnisse(map);
  }

  function handleChange(spielId, seite, wert) {
    const num = wert === '' ? '' : Math.max(0, Math.min(99, parseInt(wert) || 0));
    setErgebnisse(prev => ({
      ...prev,
      [spielId]: { ...prev[spielId], [seite]: num, eingetragen: false }
    }));
  }

  async function saveErgebnis(spielId) {
    const e = ergebnisse[spielId];
    if (e.heim === '' || e.auswaerts === '') return;
    setSaving(prev => ({ ...prev, [spielId]: true }));
    await supabase.from('spiele').update({
      heim_tore: parseInt(e.heim),
      auswaerts_tore: parseInt(e.auswaerts),
      ergebnis_eingetragen: true,
    }).eq('id', spielId);
    setErgebnisse(prev => ({ ...prev, [spielId]: { ...prev[spielId], eingetragen: true } }));
    setSaving(prev => ({ ...prev, [spielId]: false }));
  }

  async function spieltagAbschliessen() {
    const ids = spiele.map(s => s.id);
    await supabase.from('spiele')
      .update({ ergebnis_eingetragen: true })
      .in('id', ids);
    loadSpiele();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">ADMIN · ERGEBNISSE</div>
        <div className="page-subtitle">Echte Bundesliga-Ergebnisse eintragen</div>
      </div>

      <div className="spieltag-nav">
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
        <span className="spieltag-label">SPIELTAG {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(34, s + 1))} disabled={spieltag >= 34}>Weiter →</button>
      </div>

      <div className="card">
        <div className="card-title">SPIELE SPIELTAG {spieltag}</div>
        {spiele.map(spiel => (
          <div className="admin-spiel-row" key={spiel.id}>
            <div style={{ fontSize: 14 }}>
              <strong>{spiel.heim}</strong>
              <span style={{ color: 'var(--text2)', margin: '0 8px' }}>–</span>
              <strong>{spiel.auswaerts}</strong>
            </div>
            <div className="spiel-tipp">
              <input
                className="tipp-input"
                type="number" min="0" max="99"
                value={ergebnisse[spiel.id]?.heim ?? ''}
                onChange={e => handleChange(spiel.id, 'heim', e.target.value)}
              />
              <span className="tipp-separator">:</span>
              <input
                className="tipp-input"
                type="number" min="0" max="99"
                value={ergebnisse[spiel.id]?.auswaerts ?? ''}
                onChange={e => handleChange(spiel.id, 'auswaerts', e.target.value)}
              />
            </div>
            <button
              className={`btn-confirm ${ergebnisse[spiel.id]?.eingetragen ? 'saved' : ''}`}
              onClick={() => saveErgebnis(spiel.id)}
              disabled={saving[spiel.id]}
            >
              {ergebnisse[spiel.id]?.eingetragen ? '✓ Gespeichert' : saving[spiel.id] ? '...' : 'Speichern'}
            </button>
          </div>
        ))}
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button className="btn-save" onClick={spieltagAbschliessen}>
            ✓ Alle als abgeschlossen markieren
          </button>
        </div>
      </div>
    </div>
  );
}
