import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function berechnePunkte(heimTipp, auswaertsTipp, heimTore, auswaertsTore) {
  if (heimTipp === null || auswaertsTipp === null) return null;
  if (heimTore === null || auswaertsTore === null) return null;
  if (heimTipp === heimTore && auswaertsTipp === auswaertsTore) return 3;
  const tippDiff = heimTipp - auswaertsTipp;
  const ergebnisDiff = heimTore - auswaertsTore;
  if (Math.sign(tippDiff) !== Math.sign(ergebnisDiff)) return 0;
  if (tippDiff === ergebnisDiff) return 2;
  return 1;
}

export default function SpielerDetail({ spieler, onBack }) {
  const [spieltag, setSpieltag] = useState(1);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const { data: spiele } = await supabase.from('spiele').select('*').order('spieltag').order('id');
    const { data: tipps } = await supabase.from('tipps').select('*').eq('spieler_id', spieler.id);
    const { data: allSpieler } = await supabase.from('spieler').select('*, vereine(*)');
    const { data: allTipps } = await supabase.from('tipps').select('*');

    setAllData({ spiele, tipps, allSpieler, allTipps });

    // Start at first spieltag with ergebnisse
    const ersteST = spiele?.find(s => s.ergebnis_eingetragen)?.spieltag || 1;
    setSpieltag(ersteST);
    setLoading(false);
  }

  if (loading || !allData) return <div style={{ color: 'var(--text2)', padding: 40 }}>Wird geladen...</div>;

  const { spiele, tipps, allSpieler, allTipps } = allData;
  const tippsMap = {};
  tipps?.forEach(t => { tippsMap[t.spiel_id] = t; });

  // Berechne Statistiken
  let gesamt3 = 0, gesamt2 = 0, gesamt1 = 0, gesamt0 = 0, gesamtPunkte = 0;
  spiele?.filter(s => s.ergebnis_eingetragen).forEach(s => {
    const t = tippsMap[s.id];
    if (!t) return;
    const p = berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore);
    if (p === null) return;
    gesamtPunkte += p;
    if (p === 3) gesamt3++;
    else if (p === 2) gesamt2++;
    else if (p === 1) gesamt1++;
    else gesamt0++;
  });

  // Finde Gegner dieses Spieltags
  const vereinZuSpieler = {};
  allSpieler?.forEach(s => { vereinZuSpieler[s.vereine?.name] = s; });

  const spieleDesSpieltags = spiele?.filter(s => s.spieltag === spieltag) || [];
  let gegner = null;
  spieleDesSpieltags.forEach(s => {
    if (s.heim === spieler.vereine?.name) gegner = vereinZuSpieler[s.auswaerts];
    if (s.auswaerts === spieler.vereine?.name) gegner = vereinZuSpieler[s.heim];
  });

  // Berechne Tipp-Punkte für diesen Spieltag (ich vs Gegner)
  const meineSpieltag = spieleDesSpieltags
    .filter(s => s.ergebnis_eingetragen)
    .reduce((sum, s) => {
      const t = tippsMap[s.id];
      if (!t) return sum;
      return sum + (berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore) || 0);
    }, 0);

  const gegnerSpieltag = gegner ? spieleDesSpieltags
    .filter(s => s.ergebnis_eingetragen)
    .reduce((sum, s) => {
      const t = allTipps?.find(tt => tt.spieler_id === gegner.id && tt.spiel_id === s.id);
      if (!t) return sum;
      return sum + (berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore) || 0);
    }, 0) : null;

  const maxSpieltag = Math.max(...(spiele?.map(s => s.spieltag) || [34]));

  return (
    <div>
      <div className="page-header">
        <button
          onClick={onBack}
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 16px', color: 'var(--text)',
            cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: 12,
            fontSize: 14
          }}
        >
          ← Zurück zur Tabelle
        </button>
        <div className="page-title">⚽ {spieler.vereine?.name}</div>
        <div className="page-subtitle">Trainer: {spieler.name}</div>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tipp-Punkte</div>
          <div className="stat-value">{gesamtPunkte}</div>
          <div className="stat-sub">Gesamt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Exakt (3 Pkt)</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{gesamt3}</div>
          <div className="stat-sub">{Math.round(gesamt3 / ((gesamt3+gesamt2+gesamt1+gesamt0)||1) * 100)}% aller Tipps</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tendenz+Diff (2 Pkt)</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>{gesamt2}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nur Tendenz (1 Pkt)</div>
          <div className="stat-value" style={{ color: 'var(--text2)' }}>{gesamt1}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daneben (0 Pkt)</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{gesamt0}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
      </div>

      {/* Spieltag Navigation */}
      <div className="spieltag-nav">
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
        <span className="spieltag-label">SPIELTAG {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(maxSpieltag, s + 1))} disabled={spieltag >= maxSpieltag}>Weiter →</button>
      </div>

      {/* Gegner Vergleich */}
      {gegner && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">DIREKTVERGLEICH</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{spieler.vereine?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{spieler.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 32 }}>
                <span style={{ color: meineSpieltag > (gegnerSpieltag||0) ? 'var(--accent)' : meineSpieltag < (gegnerSpieltag||0) ? 'var(--red)' : 'var(--gold)' }}>
                  {meineSpieltag}
                </span>
                <span style={{ color: 'var(--text2)', margin: '0 8px' }}>:</span>
                <span>{gegnerSpieltag}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tipp-Punkte</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600 }}>{gegner.vereine?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{gegner.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tipps des Spieltags */}
      <div className="card">
        <div className="card-title">TIPPS SPIELTAG {spieltag}</div>
        {spieleDesSpieltags.map(spiel => {
          const t = tippsMap[spiel.id];
          const gegnerTipp = gegner ? allTipps?.find(tt => tt.spieler_id === gegner.id && tt.spiel_id === spiel.id) : null;
          const p = t && spiel.ergebnis_eingetragen
            ? berechnePunkte(t.heim_tipp, t.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore)
            : null;

          return (
            <div key={spiel.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              {/* Spiel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{spiel.heim}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--text2)', textAlign: 'center' }}>
                  {spiel.ergebnis_eingetragen ? `${spiel.heim_tore}:${spiel.auswaerts_tore}` : 'vs'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{spiel.auswaerts}</div>
              </div>

              {/* Tipps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text2)', fontSize: 11 }}>{spieler.vereine?.kurz}</span>
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: 16 }}>
                    {t ? `${t.heim_tipp}:${t.auswaerts_tipp}` : '–'}
                  </span>
                  {p !== null && (
                    <span className={`punkte-chip p${p}`}>{p}</span>
                  )}
                </div>
                {gegner && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: 11 }}>{gegner.vereine?.kurz}</span>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 16 }}>
                      {gegnerTipp ? `${gegnerTipp.heim_tipp}:${gegnerTipp.auswaerts_tipp}` : '–'}
                    </span>
                    {gegnerTipp && spiel.ergebnis_eingetragen && (
                      <span className={`punkte-chip p${berechnePunkte(gegnerTipp.heim_tipp, gegnerTipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore)}`}>
                        {berechnePunkte(gegnerTipp.heim_tipp, gegnerTipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
