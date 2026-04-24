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

export default function MeinePunkte({ spieler }) {
  const [stats, setStats] = useState(null);
  const [verlauf, setVerlauf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (spieler) loadStats();
  }, [spieler]);

  async function loadStats() {
    const { data: tipps } = await supabase
      .from('tipps')
      .select('*, spiele(*)')
      .eq('spieler_id', spieler.id);

    const { data: allSpiele } = await supabase
      .from('spiele')
      .select('*')
      .eq('ergebnis_eingetragen', true);

    // Alle Spieler für Vergleiche laden
    const { data: allSpieler } = await supabase
      .from('spieler')
      .select('*, vereine(*)');

    const { data: allTipps } = await supabase
      .from('tipps')
      .select('*');

    let gesamt = 0, richtig3 = 0, richtig2 = 0, richtig1 = 0, falsch = 0;
    const spieltagMap = {};

    (tipps || []).forEach(tipp => {
      if (!tipp.spiele?.ergebnis_eingetragen) return;
      const p = berechnePunkte(tipp.heim_tipp, tipp.auswaerts_tipp, tipp.spiele.heim_tore, tipp.spiele.auswaerts_tore);
      if (p === null) return;
      gesamt += p;
      if (p === 3) richtig3++;
      else if (p === 2) richtig2++;
      else if (p === 1) richtig1++;
      else falsch++;

      const st = tipp.spiele.spieltag;
      if (!spieltagMap[st]) spieltagMap[st] = 0;
      spieltagMap[st] += p;
    });

    // Erstelle Spieltag-Verlauf mit Tabellenpunkten
    const vereinZuSpieler = {};
    allSpieler?.forEach(s => { vereinZuSpieler[s.vereine?.name] = s; });

    const spieltage = [...new Set(allSpiele.map(s => s.spieltag))].sort((a, b) => a - b);
    const verlaufData = [];

    spieltage.forEach(st => {
      const spieleDesSpieltags = allSpiele.filter(s => s.spieltag === st);
      let gegner = null;
      let meinePunkte = spieltagMap[st] || 0;
      let gegnerPunkte = 0;
      let tabPunkte = 0;

      // Finde meinen Gegner diesen Spieltag
      spieleDesSpieltags.forEach(spiel => {
        const heimS = vereinZuSpieler[spiel.heim];
        const ausS = vereinZuSpieler[spiel.auswaerts];
        if (heimS?.id === spieler.id) gegner = ausS;
        if (ausS?.id === spieler.id) gegner = heimS;
      });

      if (gegner) {
        gegnerPunkte = spieleDesSpieltags.reduce((sum, spiel) => {
          const t = allTipps?.find(t => t.spieler_id === gegner.id && t.spiel_id === spiel.id);
          if (!t) return sum;
          return sum + (berechnePunkte(t.heim_tipp, t.auswaerts_tipp, spiel.heim_tore, spiel.auswaerts_tore) || 0);
        }, 0);

        if (meinePunkte > gegnerPunkte) tabPunkte = 3;
        else if (meinePunkte === gegnerPunkte) tabPunkte = 1;
        else tabPunkte = 0;
      }

      verlaufData.push({
        spieltag: st,
        tippPunkte: meinePunkte,
        gegner: gegner?.name || '–',
        gegnerVerein: gegner?.vereine?.kurz || '',
        gegnerPunkte,
        tabPunkte,
      });
    });

    setStats({ gesamt, richtig3, richtig2, richtig1, falsch });
    setVerlauf(verlaufData);
    setLoading(false);
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40 }}>Wird geladen...</div>;

  const gesamtTabPunkte = verlauf.reduce((s, v) => s + v.tabPunkte, 0);
  const siege = verlauf.filter(v => v.tabPunkte === 3).length;
  const unentschieden = verlauf.filter(v => v.tabPunkte === 1).length;
  const niederlagen = verlauf.filter(v => v.tabPunkte === 0 && v.gegner !== '–').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">MEINE PUNKTE</div>
        <div className="page-subtitle">{spieler?.vereine?.name} · {spieler?.name}</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tabellenpunkte</div>
          <div className="stat-value">{gesamtTabPunkte}</div>
          <div className="stat-sub">{siege}S · {unentschieden}U · {niederlagen}N</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tipp-Punkte</div>
          <div className="stat-value">{stats.gesamt}</div>
          <div className="stat-sub">Gesamt gesammelt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Exakt richtig</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.richtig3}</div>
          <div className="stat-sub">3 Punkte getippt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tendenz+Diff</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>{stats.richtig2}</div>
          <div className="stat-sub">2 Punkte getippt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nur Tendenz</div>
          <div className="stat-value" style={{ color: 'var(--text2)' }}>{stats.richtig1}</div>
          <div className="stat-sub">1 Punkt getippt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daneben</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.falsch}</div>
          <div className="stat-sub">0 Punkte</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">SPIELTAG-VERLAUF</div>
        <table className="tabelle">
          <thead>
            <tr>
              <th>Spieltag</th>
              <th>Gegner</th>
              <th className="center">Meine Pkt</th>
              <th className="center">Gegner Pkt</th>
              <th className="center">Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {verlauf.map(v => (
              <tr key={v.spieltag}>
                <td>ST {v.spieltag}</td>
                <td>
                  <span style={{ fontSize: 12, color: 'var(--accent)', marginRight: 6 }}>{v.gegnerVerein}</span>
                  {v.gegner}
                </td>
                <td className="center"><strong>{v.tippPunkte}</strong></td>
                <td className="center" style={{ color: 'var(--text2)' }}>{v.gegnerPunkte}</td>
                <td className="center">
                  {v.tabPunkte === 3 && <span className="gewonnen">● Sieg</span>}
                  {v.tabPunkte === 1 && <span className="unentschieden-cl">● Unentschieden</span>}
                  {v.tabPunkte === 0 && v.gegner !== '–' && <span className="verloren">● Niederlage</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
