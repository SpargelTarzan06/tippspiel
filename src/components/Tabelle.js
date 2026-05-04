import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Tabelle({ onSelectTrainer }) {
  const [tabelle, setTabelle] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTabelle();
  }, []);

  async function loadTabelle() {
    setLoading(true);
    // Wir ziehen die fertigen Daten aus der View
    const { data, error } = await supabase
      .from('h2h_tabelle')
      .select('*')
      .order('punkte', { ascending: false })
      .order('tipp_punkte', { ascending: false });

    if (error) {
      console.error("Fehler beim Laden der Tabelle:", error);
    } else {
      setTabelle(data || []);
    }
    setLoading(false);
  }

  if (loading) return <div className="loading">Berechne Tabellenstand...</div>;

  return (
    <div className="tabelle-container">
      <div className="page-header">
        <div className="page-title">DIE TABELLE</div>
        <div className="page-subtitle">H2H-Wertung (3 Pkt Sieg, 1 Pkt Remis)</div>
      </div>

      <div className="card">
        <table className="tabelle">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Trainer / Verein</th>
              <th className="center">Sp</th>
              <th className="center">S</th>
              <th className="center">U</th>
              <th className="center">N</th>
              <th className="center">Tipp-Pkt</th>
              <th className="center" style={{ color: 'var(--accent)' }}>PKT</th>
            </tr>
          </thead>
          <tbody>
            {tabelle.map((row, index) => (
              <tr key={row.trainer_id} className={index < 3 ? 'top-rank' : ''}>
                <td>{index + 1}.</td>
                <td 
                  className="clickable-trainer" 
                  onClick={() => onSelectTrainer(row.trainer_id)}
                >
                  <div className="trainer-cell">
                    <span className="trainer-name">{row.trainer_name}</span>
                    <span className="trainer-verein">{row.verein}</span>
                  </div>
                </td>
                <td className="center">{row.spiele_anzahl}</td>
                <td className="center">{row.siege}</td>
                <td className="center">{row.unentschieden}</td>
                <td className="center">{row.niederlagen}</td>
                <td className="center" style={{ color: 'var(--text2)' }}>{row.tipp_punkte}</td>
                <td className="center">
                  <strong style={{ fontSize: '1.1rem' }}>{row.punkte}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="legend" style={{ marginTop: '15px', color: 'var(--text2)', fontSize: '0.8rem' }}>
        * Bei Punktgleichheit entscheiden die erzielten Tipp-Punkte.
      </div>
    </div>
  );
}