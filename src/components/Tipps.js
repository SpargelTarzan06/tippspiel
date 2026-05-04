import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Tipps({ trainer }) {
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [tipps, setTipps] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [maxSpieltag] = useState(34);

  useEffect(() => {
    loadAktuellerSpieltag();
  }, []);

  useEffect(() => {
    if (spieltag) loadSpiele();
  }, [spieltag]);

  async function loadAktuellerSpieltag() {
    const { data } = await supabase
      .from('spiele')
      .select('spieltag')
      .eq('ergebnis_eingetragen', false)
      .order('spieltag', { ascending: true })
      .limit(1);
    if (data && data.length > 0) setSpieltag(data[0].spieltag);
    else setSpieltag(1);
  }

  async function loadSpiele() {
    const { data: spieleData } = await supabase
      .from('spiele')
      .select('*')
      .eq('spieltag', spieltag)
      .order('id');

    setSpiele(spieleData || []);

    if (!trainer) return;
    const spielIds = (spieleData || []).map(s => s.id);
    const { data: tippsData } = await supabase
      .from('tipps')
      .select('*')
      .eq('trainer_id', trainer.id) // Geändert auf trainer_id
      .in('spiel_id', spielIds);

    const tippsMap = {};
    (tippsData || []).forEach(t => {
      tippsMap[t.spiel_id] = { heim: t.heim_tipp ?? '', auswaerts: t.auswaerts_tipp ?? '' };
    });
    setTipps(tippsMap);
    setSaved(false);
  }

  function handleTippChange(spielId, seite, wert) {
    const num = wert === '' ? '' : Math.max(0, Math.min(99, parseInt(wert) || 0));
    setTipps(prev => ({
      ...prev,
      [spielId]: { ...prev[spielId], [seite]: num }
    }));
    setSaved(false);
  }

  // --- STRATEGIE-CHECK LOGIK ---
  const getTippCounts = () => {
    const counts = {};
    Object.values(tipps).forEach(t => {
      if (t.heim !== '' && t.auswaerts !== '') {
        const key = `${t.heim}:${t.auswaerts}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  };

  const tippCounts = getTippCounts();
  const strategieVerstoss = Object.values(tippCounts).some(count => count > 5);
  // -----------------------------

  async function saveTipps() {
    if (!trainer || strategieVerstoss) return;
    setSaving(true);
    const upserts = spiele
      .filter(s => tipps[s.id]?.heim !== '' && tipps[s.id]?.auswaerts !== '')
      .map(s => ({
        trainer_id: trainer.id, // Geändert auf trainer_id
        spiel_id: s.id,
        heim_tipp: parseInt(tipps[s.id]?.heim) || 0,
        auswaerts_tipp: parseInt(tipps[s.id]?.auswaerts) || 0,
      }));

    const { error } = await supabase.from('tipps').upsert(upserts, { onConflict: 'trainer_id,spiel_id' });
    
    if (error) {
      alert("Fehler beim Speichern!");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  function berechnePunkte(spiel, tipp) {
    if (!spiel.ergebnis_eingetragen || !tipp || tipp.heim === '' || tipp.auswaerts === '') return null;
    const h = parseInt(tipp.heim), a = parseInt(tipp.auswaerts);
    if (h === spiel.heim_tore && a === spiel.auswaerts_tore) return 3;
    const tippDiff = h - a, ergDiff = spiel.heim_tore - spiel.auswaerts_tore;
    if (Math.sign(tippDiff) !== Math.sign(ergDiff)) return 0;
    if (tippDiff === ergDiff) return 2;
    return 1;
  }

  const spieltagAbgeschlossen = spiele.every(s => s.ergebnis_eingetragen);

  return (
    <div className="tipps-container">
      <div className="page-header">
        <div className="page-title">TIPPS ABGEBEN</div>
        <div className="page-subtitle">Maximal 5x das gleiche Ergebnis pro Spieltag</div>
      </div>

      <div className="spieltag-nav">
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>←</button>
        <span className="spieltag-label">SPIELTAG {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(maxSpieltag, s + 1))} disabled={spieltag >= maxSpieltag}>→</button>
      </div>

      {strategieVerstoss && (
        <div className="error-banner">
          ⚠️ <strong>Strategieverbot!</strong> Du hast ein Ergebnis mehr als 5x getippt. Bitte korrigiere deine Tipps zum Speichern.
        </div>
      )}

      <div className="card">
        {spiele.map(spiel => {
          const p = berechnePunkte(spiel, tipps[spiel.id]);
          return (
            <div className="spiel-row" key={spiel.id}>
              <div className="spiel-team heim">{spiel.heim}</div>
              
              <div className="tipp-zone">
                <div className="spiel-tipp">
                  <input
                    className="tipp-input"
                    type="number"
                    value={tipps[spiel.id]?.heim ?? ''}
                    onChange={e => handleTippChange(spiel.id, 'heim', e.target.value)}
                    disabled={spiel.ergebnis_eingetragen}
                  />
                  <span className="tipp-separator">:</span>
                  <input
                    className="tipp-input"
                    type="number"
                    value={tipps[spiel.id]?.auswaerts ?? ''}
                    onChange={e => handleTippChange(spiel.id, 'auswaerts', e.target.value)}
                    disabled={spiel.ergebnis_eingetragen}
                  />
                </div>
                {spiel.ergebnis_eingetragen && (
                  <div className="ergebnis-info">
                    Ergebnis: {spiel.heim_tore}:{spiel.auswaerts_tore}
                    {p !== null && <span className={`punkte-chip p${p}`}>{p}</span>}
                  </div>
                )}
              </div>

              <div className="spiel-team auswaerts">{spiel.auswaerts}</div>
            </div>
          );
        })}

        {!spieltagAbgeschlossen && (
          <div className="save-area">
            <button 
              className="btn-save" 
              onClick={saveTipps} 
              disabled={saving || strategieVerstoss}
            >
              {saving ? 'Speichert...' : '💾 Tipps speichern'}
            </button>
            {saved && <div className="success-msg">✓ Gespeichert!</div>}
          </div>
        )}
      </div>
    </div>
  );
}