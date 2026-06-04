'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import NavBar from '../../../components/NavBar'

type Team = {
  id: string
  name: string
  logo_url: string | null
}

type Match = {
  id: string
  season_id: string
  matchday: number
  home_team_id: string
  away_team_id: string
  home_goals: number | null
  away_goals: number | null
}

type Season = {
  id: string
  name: string
}

export default function AdminErgebnissePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [matchday, setMatchday] = useState(1)
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    loadData()
  }, [matchday])

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('Admin check failed:', error)
      return
    }

    if (profileData?.role !== 'admin') {
      window.location.href = '/'
    }
  }

  async function loadData() {
    setLoading(true)
    setMessage('')

    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('is_active', true)
      .single()

    if (seasonError || !seasonData) {
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setActiveSeason(seasonData)

    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, logo_url')

    if (teamsError || !teamsData) {
      setMessage('Teams konnten nicht geladen werden.')
      setLoading(false)
      return
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from('bundesliga_matches')
      .select(
        'id, season_id, matchday, home_team_id, away_team_id, home_goals, away_goals'
      )
      .eq('season_id', seasonData.id)
      .eq('matchday', matchday)
      .order('id', { ascending: true })

    if (matchesError) {
      setMessage(`Fehler beim Laden der Spiele: ${matchesError.message}`)
      setLoading(false)
      return
    }

    const teamMap: Record<string, Team> = {}

    for (const team of teamsData) {
      teamMap[team.id] = team
    }

    setTeams(teamMap)
    setMatches(matchesData || [])
    setLoading(false)
  }

  const visibleMatches = useMemo(() => {
    if (!onlyOpen) return matches

    return matches.filter(
      (m) => m.home_goals === null || m.away_goals === null
    )
  }, [matches, onlyOpen])

  function updateResult(
    matchId: string,
    field: 'home_goals' | 'away_goals',
    value: string
  ) {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              [field]: value === '' ? null : Number(value),
            }
          : m
      )
    )
  }

  async function saveResults() {
    setSaving(true)
    setMessage('')

    for (const match of matches) {
      const { error } = await supabase
        .from('bundesliga_matches')
        .update({
          home_goals: match.home_goals,
          away_goals: match.away_goals,
        })
        .eq('id', match.id)

      if (error) {
        setMessage(`Fehler beim Speichern: ${error.message}`)
        setSaving(false)
        return
      }
    }

    setMessage('Ergebnisse gespeichert.')
    setSaving(false)
  }

  async function calculateMatchday() {
    if (!activeSeason) {
      setMessage('Keine aktive Saison geladen.')
      return
    }

    setCalculating(true)
    setMessage('')

    const { error: bundesligaError } = await supabase.rpc(
      'calculate_matchday',
      {
        target_season_name: activeSeason.name,
        target_matchday: matchday,
      }
    )

    if (bundesligaError) {
      setMessage(`Fehler Bundesliga: ${bundesligaError.message}`)
      setCalculating(false)
      return
    }

    const { error: clError } = await supabase.rpc(
      'calculate_cl_matchday',
      {
        target_season_name: activeSeason.name,
        target_matchday: matchday,
      }
    )

    const { error: snapshotError } = await supabase.rpc(
      'save_standings_snapshot',
      {
        p_season_id: activeSeason.id,
        p_matchday: matchday,
      }
    )

    if (snapshotError) {
      setMessage(
        `Spieltag berechnet, aber Tabellenhistorie fehlgeschlagen: ${snapshotError.message}`
      )
      setCalculating(false)
      return
    }

    if (clError) {
      setMessage(`Bundesliga berechnet, aber CL fehlgeschlagen: ${clError.message}`)
      setCalculating(false)
      return
    }

    setMessage(`${matchday}. Spieltag wurde berechnet.`)
    setCalculating(false)
    await loadData()
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1100 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Ergebnisse eintragen</h1>

            {activeSeason && (
              <div style={seasonPillStyle}>
                Aktive Saison: {activeSeason.name}
              </div>
            )}
          </div>
        </section>

        <section className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div style={sectionHeaderStyle}>Spieltag auswählen</div>

          <div style={controlsStyle}>
            <select
              value={matchday}
              onChange={(e) => setMatchday(Number(e.target.value))}
              style={inputStyle}
            >
              {Array.from({ length: 34 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}. Spieltag
                </option>
              ))}
            </select>

            <label style={checkLabelStyle}>
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
              />
              Nur offene Spiele
            </label>
          </div>
        </section>

        {message && (
          <div
            className="card"
            style={{
              padding: 14,
              marginBottom: 18,
              background: message.startsWith('Fehler') ? '#fff1f2' : '#f0fdf4',
              color: message.startsWith('Fehler') ? '#991b1b' : '#166534',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <section className="card" style={{ padding: 24 }}>
            Lade Spiele...
          </section>
        ) : visibleMatches.length === 0 ? (
          <InfoCard text="Keine Spiele gefunden." />
        ) : (
          <>
            <div style={{ display: 'grid', gap: 12 }}>
              {visibleMatches.map((m) => {
                const home = teams[m.home_team_id]
                const away = teams[m.away_team_id]
                const finished =
                  m.home_goals !== null && m.away_goals !== null

                return (
                  <section
                    key={m.id}
                    className="card"
                    style={{
                      padding: 14,
                      background: finished ? '#f0fdf4' : '#ffffff',
                      border: finished
                        ? '1px solid #bbf7d0'
                        : '1px solid #e2e8f0',
                    }}
                  >
                    <div style={matchRowStyle}>
                      <TeamDisplay team={home} align="right" />

                      <div style={scoreInputGroupStyle}>
                        <input
                          type="number"
                          min="0"
                          value={m.home_goals ?? ''}
                          onChange={(e) =>
                            updateResult(m.id, 'home_goals', e.target.value)
                          }
                          style={scoreInputStyle}
                        />

                        <span style={colonStyle}>:</span>

                        <input
                          type="number"
                          min="0"
                          value={m.away_goals ?? ''}
                          onChange={(e) =>
                            updateResult(m.id, 'away_goals', e.target.value)
                          }
                          style={scoreInputStyle}
                        />
                      </div>

                      <TeamDisplay team={away} align="left" />
                    </div>

                    <div style={statusLineStyle}>
                      {finished ? '✅ Ergebnis eingetragen' : '⏳ Noch offen'}
                    </div>
                  </section>
                )
              })}
            </div>

            <div style={saveBarStyle}>
              <button
                onClick={saveResults}
                disabled={saving || calculating}
                style={{
                  ...saveButtonStyle,
                  opacity: saving || calculating ? 0.7 : 1,
                }}
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>

              <button
                onClick={calculateMatchday}
                disabled={saving || calculating}
                style={{
                  ...calculateButtonStyle,
                  opacity: saving || calculating ? 0.7 : 1,
                }}
              >
                {calculating ? 'Berechnet...' : 'Spieltag berechnen'}
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}

function TeamDisplay({
  team,
  align,
}: {
  team?: Team
  align: 'left' | 'right'
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 8,
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      {align === 'right' && (
        <span style={teamNameStyle}>{shortTeamName(team?.name)}</span>
      )}

      {team?.logo_url && (
        <img
          src={team.logo_url}
          alt={team.name}
          width={28}
          height={28}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
      )}

      {align === 'left' && (
        <span style={teamNameStyle}>{shortTeamName(team?.name)}</span>
      )}
    </div>
  )
}

function shortTeamName(name?: string) {
  if (!name) return 'Unbekannt'

const map: Record<string, string> = {
  'Bayer 04 Leverkusen': 'Lev',
  '1. FSV Mainz 05': 'Mainz',
  'Hamburger SV': 'HSV',
  '1. FC Heidenheim': 'HDH',
  '1. FC Köln': 'Köln',
  '1. FC Union Berlin': 'Union',
  'FC St. Pauli': 'St.Pauli',
  'RB Leipzig': 'Leipzig',
  'VfB Stuttgart': 'VfB',
  'VfL Wolfsburg': 'WOB',
  'Werder Bremen': 'Bremen',
  'Bayern München': 'Bayern',
  'Borussia Dortmund': 'BVB',
  'Borussia Mönchengladbach': "M'Gladbach",
  'SC Freiburg': 'Freiburg',
  'FC Augsburg': 'Augsburg',
  'Eintracht Frankfurt': 'Frankfurt',
  'TSG Hoffenheim': 'Hoffenheim',
}

  return map[name] ?? name
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 850 }}>
      {text}
    </div>
  )
}

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 24,
  padding: 24,
  marginBottom: 20,
  background: 'linear-gradient(135deg,#052e16,#166534)',
  color: 'white',
  boxShadow: '0 14px 34px rgba(15,23,42,0.10)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -100,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,.1)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,.15)',
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
}

const seasonPillStyle: React.CSSProperties = {
  marginTop: 10,
  color: 'rgba(255,255,255,0.86)',
  fontWeight: 850,
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg,#f8fafc,#ffffff)',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 950,
}

const controlsStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  gap: 14,
  flexWrap: 'wrap',
  alignItems: 'center',
}

const inputStyle: React.CSSProperties = {
  minHeight: 38,
  height: 38,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  padding: '0 10px',
  fontSize: 13,
  fontWeight: 800,
  background: '#fff',
}

const checkLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: '#334155',
  fontWeight: 850,
}

const matchRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
  gap: 12,
  alignItems: 'center',
}

const scoreInputGroupStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px 14px 56px',
  gap: 6,
  alignItems: 'center',
}

const scoreInputStyle: React.CSSProperties = {
  width: 56,
  height: 46,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  textAlign: 'center',
  fontWeight: 950,
  fontSize: 18,
  color: '#0f172a',
}

const colonStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 950,
  color: '#0f172a',
}

const teamNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#0f172a',
  fontWeight: 950,
  fontSize: 14,
}

const statusLineStyle: React.CSSProperties = {
  marginTop: 10,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
}

const saveBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 12,
  zIndex: 20,
  marginTop: 18,
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
}

const saveButtonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 999,
  padding: '0 22px',
  color: 'white',
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(22,163,74,0.22)',
}

const calculateButtonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 999,
  padding: '0 22px',
  color: 'white',
  background: 'linear-gradient(135deg,#172554,#1d4ed8)',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(29,78,216,0.20)',
}