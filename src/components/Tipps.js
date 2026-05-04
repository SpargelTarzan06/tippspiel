import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Tipps({ trainer }) {
  const [spieltag, setSpieltag] = useState(1);
  const [spiele, setSpiele] = useState([]);
  const [tipps, setTipps] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSpiele();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spieltag]);

  async function loadSpiele() {
    setLoading(true);
    const { data: spieleData } = await supabase.from('spielplan').select('*').eq('spieltag', spieltag);
    setSpiele(spieleData || []);

    const { data: tippsData } = await supabase.from('tipps').select('*').eq('trainer_id', trainer.id).in('spiel_id', spieleData.map(s => s.id));
    
    const tippMap = {};
    tippsData?.forEach(t => { tippMap[t.spiel_id] = { heim: t.tipp_heim, gast: t.tipp_gast }; });
    setTipps(tippMap);
    setLoading(false);
  }

  async function handleSave(spielId) {
    const t = tipps[spielId];
    if (t?.heim === undefined || t?.gast === undefined) return;
    await supabase.from('tipps').upsert({
      trainer_id: trainer.id,
      spiel_id: spielId,
      tipp_heim: parseInt(t.heim),
      tipp_gast: parseInt(t.gast)
    }, { onConflict: 'trainer_id,spiel_id' });
  }

  return (
    <div className="tipps-container">
      <div className="spieltag-nav" style={{marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center'}}>
        <button onClick={() => setSpieltag(s => Math.max(1, s - 1))}>←</button>
        <span style={{fontWeight: 'bold'}}>Spieltag {spieltag}</span>
        <button onClick={() => setSpieltag(s => Math.min(34, s + 1))}>→</button>
      </div>

      <div className="admin-list">
        {loading ? <p>Lade Spiele...</p> : spiele.map(s => (
          <div key={s.id} className="card" style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{width: '30%'}}>{s.heim_team}</span>
            <div style={{display: 'flex', gap: '5px'}}>
              <input type="number" className="tipp-input" value={tipps[s.id]?.heim ?? ''} onChange={e => setTipps({...tipps, [s.id]: {...tipps[s.id], heim: e.target.value}})} />
              <input type="number" className="tipp-input" value={tipps[s.id]?.gast ?? ''} onChange={e => setTipps({...tipps, [s.id]: {...tipps[s.id], gast: e.target.value}})} />
            </div>
            <span style={{width: '30%', textAlign: 'right'}}>{s.gast_team}</span>
            <button className="btn-primary" onClick={() => handleSave(s.id)}>💾</button>
          </div>
        ))}
      </div>
    </div>
  );
}