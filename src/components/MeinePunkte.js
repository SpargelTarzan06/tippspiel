import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function MeinePunkte({ trainer }) {
  const [stats, setStats] = useState({ gesamt: 0, richtig3: 0, richtig2: 0, richtig1: 0, falsch: 0 });
  const [verlauf, setVerlauf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (trainer) {
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer]);

  async function loadAllData() {
    setLoading(true);
    const { data: tippsData } = await supabase.from('tipps').select('*, spielplan(*)').eq('trainer_id', trainer.id);
    const { data: h2hData } = await supabase
      .from('h2h_auswertung')
      .or(`heim_trainer.eq."${trainer.trainer_name}",gast_trainer.eq."${trainer.trainer_name}"`)
      .order('spieltag', { ascending: true });

    let s = { gesamt: 0, richtig3: 0, richtig2: 0, richtig1: 0, falsch: 0 };
    tippsData?.forEach(t => {
      const sp = t.spielplan;
      if (!sp || !sp.ergebnis_eingetragen) return;
      if (t.tipp_heim === sp.ergebnis_heim && t.tipp_gast === sp.ergebnis_gast) { s.richtig3++; s.gesamt += 3; }
      else {
        const tDiff = t.tipp_heim - t.tipp_gast, eDiff = sp.ergebnis_heim - sp.ergebnis_gast;
        if (Math.sign(tDiff) === Math.sign(eDiff)) {
          if (tDiff === eDiff) { s.richtig2++; s.gesamt += 2; }
          else { s.richtig1++; s.gesamt += 1; }
        } else { s.falsch++; }
      }
    });

    const vData = h2hData?.map(m => {
      const isHeim = m.heim_trainer === trainer.trainer_name;
      return {
        spieltag: m.spieltag,
        gegner: isHeim ? m.gast_trainer : m.heim_trainer,
        meinePkt: isHeim ? m.punkte_heim : m.punkte_gast,
        gegnerPkt: isHeim ? m.punkte_gast : m.punkte_heim,
        h2hPkt: isHeim ? m.h2h_punkte_heim : m.h2h_punkte_gast
      };
    });

    setStats(s);
    setVerlauf(vData || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">Lade Statistik...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">MEINE PERFORMANCE</div>
        <div className="page-subtitle">{trainer?.verein}</div>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Tipp-Punkte</div><div className="stat-value">{stats.gesamt}</div></div>
        <div className="stat-card"><div className="stat-label">Volltreffer</div><div className="stat-value">{stats.richtig3}</div></div>
      </div>
      <div className="card" style={{marginTop: '20px'}}>
        <table className="tabelle">
          <thead><tr><th>ST</th><th>Gegner</th><th>Ich</th><th>Gegner</th><th>Status</th></tr></thead>
          <tbody>
            {verlauf.map(v => (
              <tr key={v.spieltag}>
                <td>{v.spieltag}</td>
                <td>{v.gegner}</td>
                <td className="center">{v.meinePkt ?? '-'}</td>
                <td className="center">{v.gegnerPkt ?? '-'}</td>
                <td className="center">{v.h2hPkt === 3 ? '✅' : v.h2hPkt === 1 ? '➖' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}