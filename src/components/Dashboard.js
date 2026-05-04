import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Dashboard({ trainer }) {
  const [nextMatch, setNextMatch] = useState(null);
  const [lastMatch, setLastMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      const { data: h2h } = await supabase
        .from('h2h_auswertung')
        .or(`heim_trainer.eq."${trainer.trainer_name}",gast_trainer.eq."${trainer.trainer_name}"`)
        .order('spieltag', { ascending: true });

      if (h2h) {
        const next = h2h.find(m => m.punkte_heim === null);
        const last = [...h2h].reverse().find(m => m.punkte_heim !== null);
        setNextMatch(next);
        setLastMatch(last);
      }
      setLoading(false);
    }

    if (trainer) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer]);

  if (loading) return <div className="loading">Lade Dashboard...</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="page-title">WILLKOMMEN, COACH!</div>
        <div className="page-subtitle">{trainer.trainer_name} @ {trainer.verein}</div>
      </div>

      <div className="dash-grid">
        <div className="card highlight">
          <div className="card-title">NÄCHSTES DUELL (ST {nextMatch?.spieltag})</div>
          <div className="h2h-preview">
            <div className="h2h-side"><span className="h2h-team">{trainer.verein}</span></div>
            <div className="h2h-vs">VS</div>
            <div className="h2h-side">
              <span className="h2h-team">
                {nextMatch?.heim_trainer === trainer.trainer_name ? nextMatch?.gast_trainer : nextMatch?.heim_trainer}
              </span>
            </div>
          </div>
        </div>

        {lastMatch && (
          <div className="card">
            <div className="card-title">LETZTER SPIELTAG (ST {lastMatch.spieltag})</div>
            <div className="last-result">
              <div className="res-row"><span>{lastMatch.heim_trainer}</span><span className="res-score">{lastMatch.punkte_heim}</span></div>
              <div className="res-row"><span>{lastMatch.gast_trainer}</span><span className="res-score">{lastMatch.punkte_gast}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}