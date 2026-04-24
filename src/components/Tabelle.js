import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function berechnePunkte(heimTipp, auswaertsTipp, heimTore, auswaertsTore) {
  if (heimTipp === null || auswaertsTipp === null) return null;
  if (heimTore === null || auswaertsTore === null) return null;
  if (heimTipp === heimTore && auswaertsTipp === auswaertsTore) return 3;
  const tippDiff = heimTipp - auswaertsTipp;
  const ergebnisDiff = heimTore - auswaertsTore;
  const tippTendenz = Math.sign(tippDiff);
  const ergebnisTendenz = Math.sign(ergebnisDiff);
  if (tippTendenz !== ergebnisTendenz) return 0;
  if (tippDiff === ergebnisDiff) return 2;
  return 1;
}

export default function Tabelle() {
  const [tabelle, setTabelle] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTabelle(); }, []);

  async function loadTabelle() {
    // Lade alle Spiele mit Ergebnissen
    const { data: spiele } = await supabase
      .from('spiele')
      .select('*')
      .eq('ergebnis_eingetragen', true);

    // Lade alle Tipps
    const { data: tipps } = await supabase
      .from('tipps')
      .select('*, spieler(*, vereine(*))');

    // Lade alle Spieler mit Vereinen
    const { data: spieler } = await supabase
      .from('spieler')
      .select('*, vereine(*)');

    if (!spiele || !spieler) return;

    // Berechne Tipp-Punkte pro Spieler pro Spieltag
    const spieltagPunkte = {}; // { spieler_id: { spieltag: punkte } }

    spieler.forEach(s => {
      spieltagPunkte[s.id] = {};
    });

    if (tipps) {
      tipps.forEach(tipp => {
        const spiel = spiele.find(s => s.id === tipp.spiel_id);
        if (!spiel) return;
        const p = berechnePunkte(tipp.heim_tipp, tipp.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore);
        if (p === null) return;
        if (!spieltagPunkte[tipp.spieler_id]) spieltagPunkte[tipp.spieler_id] = {};
        spieltagPunkte[tipp.spieler_id][spiel.spieltag] = (spieltagPunkte[tipp.spieler_id][spiel.spieltag] || 0) + p;
      });
    }

    // Hole den Spielplan (wer spielt gegen wen pro Spieltag)
    // Basierend auf den echten Bundesliga-Paarungen: Verein-zu-Verein Mapping
    // Jeder Spieler tippt gegen seinen direkten Bundesliga-Gegner
    const { data: allSpiele } = await supabase.from('spiele').select('*');

    // Erstelle Mapping: vereinName -> spieler
    const vereinZuSpieler = {};
    spieler.forEach(s => {
      vereinZuSpieler[s.vereine?.name] = s;
    });

    // Berechne Tabellenpunkte
    const tabelleMap = {};
    spieler.forEach(s => {
      tabelleMap[s.id] = {
        spieler: s,
        punkte: 0,
        siege: 0,
        unentschieden: 0,
        niederlagen: 0,
        tippPunkte: 0,
      };
    });

    // Für jeden Spieltag: finde direkte Paarungen
    const spieltage = [...new Set(allSpiele.map(s => s.spieltag))].sort((a, b) => a - b);

    spieltage.forEach(spieltag => {
      const spieleDesSpieltags = allSpiele.filter(s => s.spieltag === spieltag);
      const erledigtePaarungen = new Set();

      spieleDesSpieltags.forEach(spiel => {
        const heimSpieler = vereinZuSpieler[spiel.heim];
        const auswaertsSpieler = vereinZuSpieler[spiel.auswaerts];

        if (!heimSpieler || !auswaertsSpieler) return;

        const paarungKey = [heimSpieler.id, auswaertsSpieler.id].sort().join('-');
        if (erledigtePaarungen.has(paarungKey)) return;
        erledigtePaarungen.add(paarungKey);

        const heimPunkte = spieltagPunkte[heimSpieler.id]?.[spieltag] || 0;
        const auswaertsPunkte = spieltagPunkte[auswaertsSpieler.id]?.[spieltag] || 0;

        // Nur werten wenn mindestens ein Spiel des Spieltags Ergebnisse hat
        const hatErgebnisse = spieleDesSpieltags.some(s => s.ergebnis_eingetragen);
        if (!hatErgebnisse) return;

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

  return (
    <div>
      <div className="page-header">
        <div className="page-title">BUNDESLIGA TABELLE</div>
        <div className="page-subtitle">Saison 2025/26 · Basierend auf Tipp-Vergleichen</div>
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
              <tr key={row.spieler.id}>
                <td>
                  <span className={`platz-badge ${getPlatzBadge(i + 1)}`}>{i + 1}</span>
                </td>
                <td>
                  <div className="verein-name">{row.spieler.vereine?.name}</div>
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
        <span><span className="platz-badge cl" style={{ marginRight: 6 }}>4</span> Champions League</span>
        <span><span className="platz-badge abstieg" style={{ marginRight: 6 }}>16</span> Abstiegszone</span>
      </div>
    </div>
  );
}
