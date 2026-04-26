import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import SpielerDetail from './SpielerDetail';

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

function PlatzBadge({ platz }) {
  const styles = {
    1:  { bg: 'rgba(255,215,0,0.2)',    color: '#ffd700', label: '🏆' },
    2:  { bg: 'rgba(0,212,170,0.15)',   color: 'var(--accent)', label: '2' },
    3:  { bg: 'rgba(0,212,170,0.15)',   color: 'var(--accent)', label: '3' },
    4:  { bg: 'rgba(0,212,170,0.15)',   color: 'var(--accent)', label: '4' },
    5:  { bg: 'rgba(100,180,255,0.15)', color: '#64b4ff', label: '5' },
    6:  { bg: 'rgba(180,130,255,0.15)', color: '#b482ff', label: '6' },
    16: { bg: 'rgba(255,165,0,0.15)',   color: '#ffa500', label: '16' },
    17: { bg: 'rgba(255,68,85,0.15)',   color: 'var(--red)', label: '17' },
    18: { bg: 'rgba(255,68,85,0.15)',   color: 'var(--red)', label: '18' },
  };
  const s = styles[platz] || { bg: 'var(--bg3)', color: 'var(--text2)', label: String(platz) };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function Legende() {
  const items = [
    { color: '#ffd700', label: 'Meister' },
    { color: 'var(--accent)', label: '2–4 Champions League' },
    { color: '#64b4ff', label: '5 Europa League' },
    { color: '#b482ff', label: '6 Conference League' },
    { color: '#ffa500', label: '16 Relegation' },
    { color: 'var(--red)', label: '17–18 Abstieg' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text2)', marginTop: 12 }}>
      {items.map(item => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: 'inline-block' }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function Tabelle() {
  const [tabelle, setTabelle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpieler, setSelectedSpieler] = useState(null);

  useEffect(() => { loadTabelle(); }, []);

  async function loadTabelle() {
    const { data: spiele } = await supabase.from('spiele').select('*').eq('ergebnis_eingetragen', true);
    const { data: allSpiele } = await supabase.from('spiele').select('*');
    const { data: tipps } = await supabase.from('tipps').select('*');
    const { data: spieler } = await supabase.from('spieler').select('*, vereine(*)');
    if (!spiele || !spieler) return;

    const spieltagPunkte = {};
    const spieltagTippCount = {};
    spieler.forEach(s => { spieltagPunkte[s.id] = {}; spieltagTippCount[s.id] = {}; });

    if (tipps) {
      tipps.forEach(tipp => {
        const spiel = spiele.find(s => s.id === tipp.spiel_id);
        if (!spiel) return;
        const p = berechnePunkte(tipp.heim_tipp, tipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore);
        if (p === null) return;
        const st = spiel.spieltag;
        spieltagPunkte[tipp.spieler_id][st] = (spieltagPunkte[tipp.spieler_id][st] || 0) + p;
        spieltagTippCount[tipp.spieler_id][st] = (spieltagTippCount[tipp.spieler_id][st] || 0) + 1;
      });
    }

    const vereinZuSpieler = {};
    spieler.forEach(s => { vereinZuSpieler[s.vereine?.name] = s; });

    const tabelleMap = {};
    spieler.forEach(s => {
      tabelleMap[s.id] = { spieler: s, punkte: 0, siege: 0, unentschieden: 0, niederlagen: 0, tippPunkte: 0, gegnerTippPunkte: 0 };
    });

    const spieltage = [...new Set(allSpiele.map(s => s.spieltag))].sort((a, b) => a - b);

    spieltage.forEach(spieltag => {
      const spieleDesSpieltags = allSpiele.filter(s => s.spieltag === spieltag);
      const ergebnisspiele = spiele.filter(s => s.spieltag === spieltag);
      if (ergebnisspiele.length === 0) return;

      const erledigtePaarungen = new Set();
      spieleDesSpieltags.forEach(spiel => {
        const heimSpieler = vereinZuSpieler[spiel.heim];
        const auswaertsSpieler = vereinZuSpieler[spiel.auswaerts];
        if (!heimSpieler || !auswaertsSpieler) return;

        const paarungKey = [heimSpieler.id, auswaertsSpieler.id].sort().join('-');
        if (erledigtePaarungen.has(paarungKey)) return;
        erledigtePaarungen.add(paarungKey);

        const heimCount = spieltagTippCount[heimSpieler.id]?.[spieltag] || 0;
        const auswaertsCount = spieltagTippCount[auswaertsSpieler.id]?.[spieltag] || 0;
        if (heimCount === 0 || auswaertsCount === 0) return;

        const heimPunkte = spieltagPunkte[heimSpieler.id]?.[spieltag] || 0;
        const auswaertsPunkte = spieltagPunkte[auswaertsSpieler.id]?.[spieltag] || 0;

        tabelleMap[heimSpieler.id].tippPunkte += heimPunkte;
        tabelleMap[auswaertsSpieler.id].tippPunkte += auswaertsPunkte;
        tabelleMap[heimSpieler.id].gegnerTippPunkte += auswaertsPunkte;
        tabelleMap[auswaertsSpieler.id].gegnerTippPunkte += heimPunkte;

        if (heimPunkte > auswaertsPunkte) {
          tabelleMap[heimSpieler.id].punkte += 3;
          tabelleMap[heimSpieler.id].siege++;
          tabelleMap[auswaertsSpieler.id].niederlagen++;
        } else if (heimPunkte < auswaertsPunkte) {
          tabelleMap[auswaertsSpieler.id].punkte += 3;
          tabelleMap[auswaertsSpieler.id].siege++;
          tabelleMap[heimSpieler.id].niederlagen++;
        } else {
          tabelleMap[heimSpieler.id].punkte++;
          tabelleMap[auswaertsSpieler.id].punkte++;
          tabelleMap[heimSpieler.id].unentschieden++;
          tabelleMap[auswaertsSpieler.id].unentschieden++;
        }
      });
    });

    const sorted = Object.values(tabelleMap).sort((a, b) => {
      if (b.punkte !== a.punkte) return b.punkte - a.punkte;
      const diffA = a.tippPunkte - a.gegnerTippPunkte;
      const diffB = b.tippPunkte - b.gegnerTippPunkte;
      if (diffB !== diffA) return diffB - diffA;
      return b.tippPunkte - a.tippPunkte;
    });

    setTabelle(sorted);
    setLoading(false);
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40 }}>Tabelle wird geladen...</div>;
  if (selectedSpieler) return <SpielerDetail spieler={selectedSpieler} onBack={() => setSelectedSpieler(null)} />;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">BUNDESLIGA TABELLE</div>
        <div className="page-subtitle">Saison 2025/26 · Klicke auf einen Verein für Details</div>
      </div>
      <div className="card">
        <table className="tabelle">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Verein / Trainer</th>
              <th className="center">S</th>
              <th className="center">U</th>
              <th className="center">N</th>
              <th className="center">Pkt+</th>
              <th className="center">Diff</th>
              <th className="center">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {tabelle.map((row, i) => {
              const platz = i + 1;
              const diff = row.tippPunkte - row.gegnerTippPunkte;
              return (
                <tr key={row.spieler.id} onClick={() => setSelectedSpieler(row.spieler)} style={{ cursor: 'pointer' }}>
                  <td><PlatzBadge platz={platz} /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.spieler.vereine?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{row.spieler.name}</div>
                  </td>
                  <td className="center">{row.siege}</td>
                  <td className="center">{row.unentschieden}</td>
                  <td className="center">{row.niederlagen}</td>
                  <td className="center" style={{ color: 'var(--text2)' }}>{row.tippPunkte}</td>
                  <td className="center" style={{ color: diff >= 0 ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>
                    {diff >= 0 ? '+' : ''}{diff}
                  </td>
                  <td className="center"><span className="punkte-zahl">{row.punkte}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Legende />
    </div>
  );
}
