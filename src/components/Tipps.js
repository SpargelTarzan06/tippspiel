import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Tipps({ spieler }) {
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [tipps, setTipps] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [maxSpieltag] = useState(34);

  useEffect(() => {
    // Starte beim aktuellsten Spieltag ohne Ergebnisse
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
    else setSpieltag(30);
  }

  async function loadSpiele() {
    const { data: spieleData } = await supabase
      .from('spiele')
      .select('*')
      .eq('spieltag', spieltag)
      .order('id');

    setSpiele(spieleData || []);

    if (!spieler) return;
    const spielIds = (spieleData || []).map(s => s.id);
    const { data: tippsData } = await supabase
      .from('tipps')
      .select('*')
      .eq('spieler_id', spieler.id)
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

  async function saveTipps() {
    if (!spieler) return;
    setSaving(true);
    const upserts = spiele
      .filter(s => tipps[s.id]?.heim !== '' && tipps[s.id]?.auswaerts !== '')
      .map(s => ({
        spieler_id: spieler.id,
        spiel_id: s.id,
        heim_tipp: parseInt(tipps[s.id]?.heim) || 0,
        auswaerts_tipp: parseInt(tipps[s.id]?.auswaerts) || 0,
      }));

    await supabase.from('tipps').upsert(upserts, { onConflict: 'spieler_id,spiel_id' });
    setSaving(false);
    setSaved(true);
  }

  function berechnePunkte(spiel, tipp) {
    if (!spiel.ergebnis_eingetragen) return null;
    if (tipp?.heim === '' || tipp?.auswaerts === '' || tipp?.heim === undefined) return null;
    const h = parseInt(tipp.heim), a = parseInt(tipp.auswaerts);
    if (h === spiel.heim_tore && a === spiel.auswaerts_tore) return 3;
    const tippDiff = h - a, ergebnisDiff = spiel.heim_tore - spiel.auswaerts_tore;
    if (Math.sign(tippDiff) !== Math.sign(ergebnisDiff)) return 0;
    if (tippDiff === ergebnisDiff) return 2;
    return 1;
  }

  const spieltagAbgeschlossen = spiele.every(s => s.ergebnis_eingetragen);
  const gesamtPunkte = spiele.reduce((sum, s) => {
    const p = berechnePunkte(s, tipps[s.id]);
    return sum + (p || 0);
  }, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">TIPPS EINGEBEN</div>
        <div className="page-subtitle">Deadline: Donnerstags 18:00 Uhr</div>
      </div>

      <div className="spieltag-nav">
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
        <span className="spieltag-label">SPIELTAG {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(maxSpieltag, s + 1))} disabled={spieltag >= maxSpieltag}>Weiter →</button>
      </div>

      {spieltagAbgeschlossen && (
        <div className="deadline-warning">
          ✓ Spieltag abgeschlossen · Du hast <strong>{gesamtPunkte} Punkte</strong> geholt
        </div>
      )}

      <div className="card">
        {spiele.map(spiel => {
          const p = berechnePunkte(spiel, tipps[spiel.id]);
          return (
            <div className="spiel-row" key={spiel.id}>
              <div className="spiel-team heim">{spiel.heim}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div className="spiel-tipp">
                  <input
                    className="tipp-input"
                    type="number"
                    min="0" max="99"
                    value={tipps[spiel.id]?.heim ?? ''}
                    onChange={e => handleTippChange(spiel.id, 'heim', e.target.value)}
                    disabled={spiel.ergebnis_eingetragen}
                  />
                  <span className="tipp-separator">:</span>
                  <input
                    className="tipp-input"
                    type="number"
                    min="0" max="99"
                    value={tipps[spiel.id]?.auswaerts ?? ''}
                    onChange={e => handleTippChange(spiel.id, 'auswaerts', e.target.value)}
                    disabled={spiel.ergebnis_eingetragen}
                  />
                </div>
                {spiel.ergebnis_eingetragen && (
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Ergebnis: {spiel.heim_tore}:{spiel.auswaerts_tore}
                    {p !== null && (
                      <span className={`punkte-chip p${p}`} style={{ marginLeft: 8 }}>{p}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="spiel-team auswaerts">{spiel.auswaerts}</div>
            </div>
          );
        })}

        {!spieltagAbgeschlossen && (
          <>
            <button className="btn-save" onClick={saveTipps} disabled={saving}>
              {saving ? 'Wird gespeichert...' : '💾 Tipps speichern'}
            </button>
            {saved && <div className="success-msg">✓ Tipps erfolgreich gespeichert!</div>}
          </>
        )}
      </div>
    </div>
  );
}
