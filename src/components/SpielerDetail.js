import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function SpielerDetail({ trainerId, onBack }) {
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadTrainerDetails();
  }, [trainerId]);

  async function loadTrainerDetails() {
    // 1. Trainer Info
    const { data: t } = await supabase.from('trainer_vereine').select('*').eq('id', trainerId).single();
    setDetails(t);

    // 2. Letzte Tipps & Ergebnisse
    const { data: tipps } = await supabase
      .from('tipps')
      .select('*, spielplan(*)')
      .eq('trainer_id', trainerId)
      .order('id', { ascending: false })
      .limit(9); // Die letzten 9 Tipps (1 Spieltag)
    
    setHistory(tipps || []);
  }

  if (!details) return null;

  return (
    <div className="detail-view">
      <button className="btn-secondary" onClick={onBack}>← Zurück</button>
      
      <div className="page-header">
        <div className="page-title">{details.trainer_name}</div>
        <div className="page-subtitle">{details.verein}</div>
      </div>

      <div className="card">
        <div className="card-title">Letzte Tipps</div>
        <div className="history-list">
          {history.map(h => (
            <div key={h.id} className="history-item" style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333'}}>
              <span>{h.spielplan.heim_team} - {h.spielplan.gast_team}</span>
              <span style={{fontWeight: 'bold'}}>
                {h.tipp_heim}:{h.tipp_gast} 
                {h.spielplan.ergebnis_eingetragen && 
                  <span style={{color: 'var(--accent)', marginLeft: '10px'}}>
                    ({h.spielplan.ergebnis_heim}:{h.spielplan.ergebnis_gast})
                  </span>
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}