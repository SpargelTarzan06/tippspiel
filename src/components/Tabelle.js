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

export default function Tabelle() {
  const [tabelle, setTabelle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpieler, setSelectedSpieler] = useState(null);

  useEffect(() => { loadTabelle(); }, []);

  async function loadTabelle() {
    const { data: spiele } = await supabase
      .from('spiele').select('*').eq('ergebnis_eingetragen', true);

    const { data: allSpiele } = await supabase
      .from('spiele').select('*');

    const { data: tipps } = await supabase
      .from('tipps').select('*');

    const { data: spieler } = await supabase
      .from('spieler').select('*, vereine(*)');

    if (!spiele || !spieler) return;

    // Berechne Tipp-Punkte pro Spieler pro Spieltag
    // UND merke wie viele Tipps ein Spieler pro Spieltag hat
    const spieltagPunkte = {};
    const spieltagTippCount = {};

    spieler.forEach(s => {
      spieltagPunkte[s.id] = {};
      spieltagTippCount[s.id] = {};
    });

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
      tabelleMap[s.id] = { spieler: s, punkte: 0, siege: 0, unentschieden: 0, niederlagen: 0, tippPunkte: 0 };
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

        const heimTippCount = spieltagTippCount[heimSpieler.id]?.[spieltag] || 0;
        const auswaertsTippCount = spieltagTippCount[auswaertsSpieler.id]?.[spieltag] || 0;

        // NUR werten wenn BEIDE Spieler mindestens einen Tipp abgegeben haben
        if (heimTippCount === 0 || auswaertsTippCount === 0) return;

        const heimPunkte = spieltagPunkte[heimSpieler.id]?.[spieltag] || 0;
        const auswaertsPunkte = spieltagPunkte[auswaertsSpieler.id]?.[spieltag] || 0;

        tabelleMap[heimSpieler.id].tippPunkte += heimPunkte;
        tabelleMap[auswaertsSpieler.id].tippPunkte += auswaertsPunkte;

        if (heimPunkte > auswaertsPunkte) {
          tabelleMap[heimSpieler.id].punkte += 3;
          tabelleMap[heimSpieler.id].siege += 1;
          tabelleMap[auswaertsSpieler.id].niederlagen += 1;
        } else if (heimPunkte < auswaertsPunkte) {
          tabelleMap[auswaertsSpieler.id].punkte += 3;
          tabelleMap[auswaertsSpieler.id].siege += 1;
          tabelleMap[heimSpieler.id].niederlagen += 1;
        } else {
          tabelleMap[heimSpieler.id].punkte += 1;
          tabelleMap[auswaertsSpieler.id].punkte += 1;
          tabelleMap[heimSpieler.id].unentschieden += 1;
          tabelleMap[auswaertsSpieler.id].unentschieden += 1;
        }
      });
    });

    const sorted = Object.values(tabelleMap).sort((a, b) => {
      if (b.punkte !== a.punkte) return b.punkte - a.punkte;
      return b.tippPunkte - a.tippPunkte;
    });

    setTabelle(sorted);
    setLoading(false);
  }

  function getPlatzBadge(platz) {
    if (platz === 1) return 'gold';
    if (platz === 2) return 'silver';
    if (platz === 3) return 'bronze';
    if (platz <= 4) return 'cl';
    if (platz >= 16) return 'abstieg';
    return '';
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Tabelle wird geladen...</div>;

  if (selectedSpieler) {
    return <SpielerDetail spieler={selectedSpieler} onBack={() => setSelectedSpieler(null)} />;
  }

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
              <th style={{ width: 40 }}>#</th>
              <th>Verein / Trainer</th>
              <th className="center">S</th>
              <th className="center">U</th>
              <th className="center">N</th>
              <th className="center">Tipp-Pkt</th>
              <th className="center">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {tabelle.map((row, i) => (
              <tr
                key={row.spieler.id}
                onClick={() => setSelectedSpieler(row.spieler)}
                style={{ cursor: 'pointer' }}
              >
                <td><span className={`platz-badge ${getPlatzBadge(i + 1)}`}>{i + 1}</span></td>
                <td>
                  <div className="verein-name" style={{ color: 'var(--accent)' }}>
                    ⚽ {row.spieler.vereine?.name}
                  </div>
                  <div className="trainer-name">{row.spieler.name}</div>
                </td>
                <td className="center">{row.siege}</td>
                <td className="center">{row.unentschieden}</td>
                <td className="center">{row.niederlagen}</td>
                <td className="center" style={{ color: 'var(--text2)' }}>{row.tippPunkte}</td>
                <td className="center"><span className="punkte-zahl">{row.punkte}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)' }}>
        <span><span className="platz-badge cl" style={{ marginRight: 6 }}>4</span>Champions League</span>
        <span><span className="platz-badge abstieg" style={{ marginRight: 6 }}>16</span>Abstiegszone</span>
      </div>
    </div>
  );
}
