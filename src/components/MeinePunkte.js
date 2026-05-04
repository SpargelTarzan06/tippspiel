import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function MeinePunkte({ trainer }) {
  const [stats, setStats] = useState({ gesamt: 0, richtig3: 0, richtig2: 0, richtig1: 0, falsch: 0 });
  const [verlauf, setVerlauf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (trainer) loadAllData();
  }, [trainer]);

  async function loadAllData() {
    setLoading(true);
    
    // 1. Alle Tipps des Trainers laden, um die Statistik-Cards (3er, 2er etc.) zu füllen
    const { data: tippsData } = await supabase
      .from('tipps')
      .select('*, spielplan(*)')
      .eq('trainer_id', trainer.id);

    // 2. Die H2H-Auswertung für den Verlauf laden
    const { data: h2hData } = await supabase
      .from('h2h_auswertung')
      .or(`heim_trainer.eq."${trainer.trainer_name}",gast_trainer.eq."${trainer.trainer_name}"`)
      .order('spieltag', { ascending: true });

    // Statistik berechnen
    let s = { gesamt: 0, richtig3: 0, richtig2: 0, richtig1: 0, falsch: 0 };
    
    tippsData?.forEach(t => {
      const sp = t.spielplan;
      if (!sp || !sp.ergebnis_eingetragen) return;
      
      const h = t.tipp_heim, a = t.tipp_gast;
      const gh = sp.ergebnis_heim, ga = sp.ergebnis_gast;

      if (h === gh && a === ga) { s.richtig3++; s.gesamt += 3; }
      else {
        const tippDiff = h - a, ergDiff = gh - ga;
        if (Math.sign(tippDiff) === Math.sign(ergDiff)) {
          if (tippDiff === ergDiff) { s.richtig2++; s.gesamt += 2; }
          else { s.richtig1++; s.gesamt += 1; }
        } else {
          s.falsch++;
        }
      }
    });

    // Verlauf aufbereiten
    const verlaufData = h2hData?.map(m => {
      const isHeim = m.heim_trainer === trainer.trainer_name;
      const meinePkt = isHeim ? m.punkte_heim : m.punkte_gast;
      const gegnerPkt = isHeim ? m.punkte_gast : m.punkte_heim;
      const h2hPkt = isHeim ? m.h2h_punkte_heim : m.h2h_punkte_gast;
      const gegnerName = isHeim ? m.gast_trainer : m.heim_trainer;

      return {
        spieltag: m.spieltag,
        gegner: gegnerName,
        meinePkt,
        gegnerPkt,
        h2hPkt
      };
    });

    setStats(s);
    setVerlauf(verlaufData || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">Analysiere deine Performance...</div>;

  const siege = verlauf.filter(v => v.h2hPkt === 3).length;
  const unentschieden = verlauf.filter(v => v.h2hPkt === 1).length;
  const niederlagen = verlauf.filter(v => v.h2hPkt === 0 && v.meinePkt !== null).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">MEINE PERFORMANCE</div>
        <div className="page-subtitle">{trainer?.verein} · {trainer?.trainer_name}</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">H2H Bilanz</div>
          <div className="stat-value">{siege * 3 + unentschieden} Pkt</div>
          <div className="stat-sub">{siege}S · {unentschieden}U · {niederlagen}N</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tipp-Punkte</div>
          <div className="stat-value">{stats.gesamt}</div>
          <div className="stat-sub">Gesamt-Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Volltreffer (3er)</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.richtig3}</div>
          <div className="stat-sub">{Math.round((stats.richtig3 / (stats.richtig3+stats.richtig2+stats.richtig1+stats.falsch)) * 100) || 0}% Quote</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-title">Spieltag-Verlauf</div>
        <table className="tabelle">
          <thead>
            <tr>
              <th>ST</th>
              <th>Gegner</th>
              <th className="center">Ich</th>
              <th className="center">Gegner</th>
              <th className="center">Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {verlauf.map(v => (
              <tr key={v.spieltag}>
                <td style={{ fontWeight: 700 }}>{v.spieltag}</td>
                <td>{v.gegner}</td>
                <td className="center"><strong>{v.meinePkt ?? '-'}</strong></td>
                <td className="center" style={{ color: 'var(--text2)' }}>{v.gegnerPkt ?? '-'}</td>
                <td className="center">
                  {v.h2hPkt === 3 && <span className="badge-win">SIEG</span>}
                  {v.h2hPkt === 1 && <span className="badge-draw">REMIS</span>}
                  {v.h2hPkt === 0 && v.meinePkt !== null && <span className="badge-loss">NIEDERLAGE</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}