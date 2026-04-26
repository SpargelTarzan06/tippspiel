import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function berechnePunkte(heimTipp, auswaertsTipp, heimTore, auswaertsTore) {
  if (heimTipp === null || heimTipp === undefined || auswaertsTipp === null || auswaertsTipp === undefined) return null;
  if (heimTore === null || heimTore === undefined || auswaertsTore === null || auswaertsTore === undefined) return null;
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

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    const { data: spiele } = await supabase.from('spiele').select('*').order('spieltag').order('id');
    const { data: meineTipps } = await supabase.from('tipps').select('*').eq('spieler_id', spieler.id);
    const { data: allSpieler } = await supabase.from('spieler').select('*, vereine(*)');
    const { data: allTipps } = await supabase.from('tipps').select('*');

    // Find first spieltag with ergebnisse
    const ersteST = spiele?.find(s => s.ergebnis_eingetragen)?.spieltag || 1;
    setSpieltag(ersteST);
    setAllData({ spiele, meineTipps, allSpieler, allTipps });
    setLoading(false);
  }

  if (loading || !allData) return <div style={{ color: 'var(--text2)', padding: 40 }}>Wird geladen...</div>;

  const { spiele, meineTipps, allSpieler, allTipps } = allData;

  // Build tipp map for this spieler: spiel_id -> tipp
  const meineTippsMap = {};
  meineTipps?.forEach(t => { meineTippsMap[t.spiel_id] = t; });

  // Build tipp map for ALL spieler: spieler_id -> spiel_id -> tipp
  const alleTippsMap = {};
  allTipps?.forEach(t => {
    if (!alleTippsMap[t.spieler_id]) alleTippsMap[t.spieler_id] = {};
    alleTippsMap[t.spieler_id][t.spiel_id] = t;
  });

  // Build vereinName -> spieler map
  const vereinZuSpieler = {};
  allSpieler?.forEach(s => { if (s.vereine?.name) vereinZuSpieler[s.vereine.name] = s; });

  // Stats über alle Spieltage
  const erledigteSpiele = spiele?.filter(s => s.ergebnis_eingetragen) || [];
  let gesamt3 = 0, gesamt2 = 0, gesamt1 = 0, gesamt0 = 0, gesamtPunkte = 0;
  erledigteSpiele.forEach(s => {
    const t = meineTippsMap[s.id];
    if (!t) return;
    const p = berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore);
    if (p === null) return;
    gesamtPunkte += p;
    if (p === 3) gesamt3++;
    else if (p === 2) gesamt2++;
    else if (p === 1) gesamt1++;
    else gesamt0++;
  });

  // Find my opponent this spieltag via spiele table
  const spieleDesSpieltags = spiele?.filter(s => s.spieltag === spieltag) || [];
  let gegner = null;
  spieleDesSpieltags.forEach(spiel => {
    if (spiel.heim === spieler.vereine?.name) gegner = vereinZuSpieler[spiel.auswaerts];
    if (spiel.auswaerts === spieler.vereine?.name) gegner = vereinZuSpieler[spiel.heim];
  });

  // Calculate spieltag points
  const erledigteDesSpieltags = spieleDesSpieltags.filter(s => s.ergebnis_eingetragen);
  const meineSpieltag = erledigteDesSpieltags.reduce((sum, s) => {
    const t = meineTippsMap[s.id];
    if (!t) return sum;
    return sum + (berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore) || 0);
  }, 0);

  const gegnerSpieltag = gegner ? erledigteDesSpieltags.reduce((sum, s) => {
    const t = alleTippsMap[gegner.id]?.[s.id];
    if (!t) return sum;
    return sum + (berechnePunkte(t.heim_tipp, t.auswaerts_tipp, s.heim_tore, s.auswaerts_tore) || 0);
  }, 0) : null;

  const maxSpieltag = Math.max(...(spiele?.map(s => s.spieltag) || [34]));
  const totalTipps = gesamt3 + gesamt2 + gesamt1 + gesamt0;

  return (
    <div>
      <div className="page-header">
        <button onClick={onBack} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 16px', color: 'var(--text)',
          cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: 12, fontSize: 14,
        }}>← Zurück zur Tabelle</button>
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
          <div className="stat-sub">{totalTipps > 0 ? Math.round(gesamt3 / totalTipps * 100) : 0}% aller Tipps</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tendenz+Diff (2)</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>{gesamt2}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nur Tendenz (1)</div>
          <div className="stat-value" style={{ color: 'var(--text2)' }}>{gesamt1}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daneben (0)</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{gesamt0}</div>
          <div className="stat-sub">&nbsp;</div>
        </div>
      </div>

      {/* Spieltag Nav */}
      <div className="spieltag-nav">
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))} disabled={spieltag <= 1}>← Zurück</button>
        <span className="spieltag-label">SPIELTAG {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(maxSpieltag, s + 1))} disabled={spieltag >= maxSpieltag}>Weiter →</button>
      </div>

      {/* Direktvergleich */}
      {gegner && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">DIREKTVERGLEICH</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{spieler.vereine?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{spieler.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 32 }}>
                <span style={{ color: meineSpieltag > (gegnerSpieltag || 0) ? 'var(--accent)' : meineSpieltag < (gegnerSpieltag || 0) ? 'var(--red)' : 'var(--gold)' }}>
                  {meineSpieltag}
                </span>
                <span style={{ color: 'var(--text2)', margin: '0 8px' }}>:</span>
                <span>{gegnerSpieltag ?? '–'}</span>
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
        {spieleDesSpieltags.length === 0 && (
          <div style={{ color: 'var(--text2)', padding: 16 }}>Keine Spiele gefunden.</div>
        )}
        {spieleDesSpieltags.map(spiel => {
          const meinTipp = meineTippsMap[spiel.id];
          const gegnerTipp = gegner ? alleTippsMap[gegner.id]?.[spiel.id] : null;
          const meinP = meinTipp && spiel.ergebnis_eingetragen
            ? berechnePunkte(meinTipp.heim_tipp, meinTipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore)
            : null;
          const gegnerP = gegnerTipp && spiel.ergebnis_eingetragen
            ? berechnePunkte(gegnerTipp.heim_tipp, gegnerTipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore)
            : null;

          return (
            <div key={spiel.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              {/* Spiel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{spiel.heim}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: spiel.ergebnis_eingetragen ? 'var(--text)' : 'var(--text2)', textAlign: 'center' }}>
                  {spiel.ergebnis_eingetragen ? `${spiel.heim_tore}:${spiel.auswaerts_tore}` : 'vs'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{spiel.auswaerts}</div>
              </div>
              {/* Tipps nebeneinander */}
              <div style={{ display: 'grid', gridTemplateColumns: gegner ? '1fr 1fr' : '1fr', gap: 8 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>{spieler.vereine?.kurz}</span>
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: 16 }}>
                    {meinTipp ? `${meinTipp.heim_tipp}:${meinTipp.auswaerts_tipp}` : '–'}
                  </span>
                  {meinP !== null && <span className={`punkte-chip p${meinP}`}>{meinP}</span>}
                </div>
                {gegner && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: 11, fontWeight: 600 }}>{gegner.vereine?.kurz}</span>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 16 }}>
                      {gegnerTipp ? `${gegnerTipp.heim_tipp}:${gegnerTipp.auswaerts_tipp}` : '–'}
                    </span>
                    {gegnerP !== null && <span className={`punkte-chip p${gegnerP}`}>{gegnerP}</span>}
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
