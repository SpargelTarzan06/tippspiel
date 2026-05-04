import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function SpielerDetail({ trainerId, onBack }) {
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadTrainerDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  async function loadTrainerDetails() {
    const { data: t } = await supabase.from('trainer_vereine').select('*').eq('id', trainerId).single();
    setDetails(t);

    const { data: tipps } = await supabase
      .from('tipps')
      .select('*, spielplan(*)')
      .eq('trainer_id', trainerId)
      .order('id', { ascending: false })
      .limit(9);
    
    setHistory(tipps || []);
  }

  if (!details) return <div className="loading">Lade Details...</div>;

  return (
    <div className="detail-view">
      <button className="btn-secondary" onClick={onBack} style={{marginBottom: '20px'}}>← Zurück zur Tabelle</button>
      <div className="page-header">
        <div className="page-title">{details.trainer_name}</div>
        <div className="page-subtitle">{details.verein}</div>
      </div>
      <div className="card">
        <div className="card-title">Letzte Tipps</div>
        {history.map(h => (
          <div key={h.id} className="admin-row" style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0'}}>
            <span>{h.spielplan.heim_team} - {h.spielplan.gast_team}</span>
            <span style={{fontWeight: 'bold'}}>{h.tipp_heim} : {h.tipp_gast}</span>
          </div>
        ))}
      </div>
    </div>
  );
}