'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Season = {
  id: string
  name: string
}

type Team = {
  id: string
  name: string
}

type ResultRow = {
  team_id: string
  bundesliga_rank: string
  bundesliga_points: string
  bundesliga_goal_difference: string
  cl_result: string
  cl_result_rank: string
}

export default function SaisonabschlussPage() {
  const router = useRouter()

  const [season, setSeason] = useState<Season | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [results, setResults] = useState<Record<string, ResultRow>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadData()
  }, [])

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

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setSeason(seasonData)

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .order('name')

    setTeams(teamsData || [])

    const { data: existingResults } = await supabase
      .from('season_team_results')
      .select('*')
      .eq('season_id', seasonData.id)

    const map: Record<string, ResultRow> = {}

    for (const team of teamsData || []) {
      const existing = (existingResults || []).find(
        (row) => row.team_id === team.id
      )

      map[team.id] = {
        team_id: team.id,

        bundesliga_rank:
          existing?.bundesliga_rank !== null &&
          existing?.bundesliga_rank !== undefined
            ? String(existing.bundesliga_rank)
            : '',

        bundesliga_points:
          existing?.bundesliga_points !== null &&
          existing?.bundesliga_points !== undefined
            ? String(existing.bundesliga_points)
            : '',

        bundesliga_goal_difference:
          existing?.bundesliga_goal_difference !== null &&
          existing?.bundesliga_goal_difference !== undefined
            ? String(existing.bundesliga_goal_difference)
            : '',

        cl_result: existing?.cl_result ?? '',

        cl_result_rank:
          existing?.cl_result_rank !== null &&
          existing?.cl_result_rank !== undefined
            ? String(existing.cl_result_rank)
            : '',
      }
    }

    setResults(map)
    setLoading(false)
  }

  function updateResult(
    teamId: string,
    field: keyof ResultRow,
    value: string
  ) {
    setResults((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [field]: value,
      },
    }))
  }

  async function saveResults() {
    if (!season) return

    setSaving(true)
    setMessage('')

    const rows = Object.values(results).map((row) => ({
      season_id: season.id,
      team_id: row.team_id,

      bundesliga_rank: row.bundesliga_rank
        ? Number(row.bundesliga_rank)
        : null,

      bundesliga_points: row.bundesliga_points
        ? Number(row.bundesliga_points)
        : null,

      bundesliga_goal_difference: row.bundesliga_goal_difference
        ? Number(row.bundesliga_goal_difference)
        : null,

      cl_result: row.cl_result || null,

      cl_result_rank: row.cl_result_rank
        ? Number(row.cl_result_rank)
        : null,
    }))

    const { error } = await supabase
      .from('season_team_results')
      .upsert(rows, {
        onConflict: 'season_id,team_id',
      })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSaving(false)
      return
    }

    setMessage('Saisonabschluss gespeichert.')
    setSaving(false)

    await loadData()
  }

  async function importCurrentSeason() {
    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc(
      'save_current_season_results'
    )

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSaving(false)
      return
    }

    setMessage('Aktuelle Saison automatisch übernommen.')

    await loadData()

    setSaving(false)
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <h1>Saisonabschluss speichern</h1>

        {season && (
          <p style={{ color: '#666' }}>
            Aktive Saison: {season.name}
          </p>
        )}

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            {message && (
              <div
                style={{
                  marginBottom: 18,
                  padding: 12,
                  borderRadius: 8,
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                }}
              >
                {message}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 900,
                }}
              >
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={th}>Team</th>
                    <th style={th}>BL-Platz</th>
                    <th style={th}>BL-Punkte</th>
                    <th style={th}>BL-Diff</th>
                    <th style={th}>CL-Ergebnis</th>
                    <th style={th}>CL-Rang</th>
                  </tr>
                </thead>

                <tbody>
                  {teams.map((team) => {
                    const row = results[team.id]

                    return (
                      <tr
                        key={team.id}
                        style={{
                          borderBottom: '1px solid #ddd',
                        }}
                      >
                        <td style={td}>
                          <strong>{team.name}</strong>
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            value={row?.bundesliga_rank ?? ''}
                            onChange={(e) =>
                              updateResult(
                                team.id,
                                'bundesliga_rank',
                                e.target.value
                              )
                            }
                            style={inputStyle}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            value={row?.bundesliga_points ?? ''}
                            onChange={(e) =>
                              updateResult(
                                team.id,
                                'bundesliga_points',
                                e.target.value
                              )
                            }
                            style={inputStyle}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            value={row?.bundesliga_goal_difference ?? ''}
                            onChange={(e) =>
                              updateResult(
                                team.id,
                                'bundesliga_goal_difference',
                                e.target.value
                              )
                            }
                            style={inputStyle}
                          />
                        </td>

                        <td style={td}>
                          <select
                            value={row?.cl_result ?? ''}
                            onChange={(e) =>
                              updateResult(
                                team.id,
                                'cl_result',
                                e.target.value
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="">Keine CL</option>

                            <option value="Champions-League-Sieger">
                              Champions-League-Sieger
                            </option>

                            <option value="Finalist">
                              Finalist
                            </option>

                            <option value="Halbfinale">
                              Halbfinale
                            </option>

                            <option value="Hauptrunde">
                              Hauptrunde
                            </option>

                            <option value="Vorrunde">
                              Vorrunde
                            </option>
                          </select>
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            value={row?.cl_result_rank ?? ''}
                            onChange={(e) =>
                              updateResult(
                                team.id,
                                'cl_result_rank',
                                e.target.value
                              )
                            }
                            placeholder="1-5"
                            style={inputStyle}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 24,
              }}
            >
              <button
                onClick={saveResults}
                disabled={saving}
                style={buttonStyle}
              >
                {saving
                  ? 'Speichert...'
                  : 'Saisonabschluss speichern'}
              </button>

              <button
                onClick={importCurrentSeason}
                disabled={saving}
                style={{
                  ...buttonStyle,
                  background: '#111',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                Aktuelle Saison automatisch übernehmen
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}

const th: React.CSSProperties = {
  padding: 10,
  textAlign: 'left',
  borderBottom: '2px solid #ddd',
}

const td: React.CSSProperties = {
  padding: 10,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  boxSizing: 'border-box',
  borderRadius: 6,
  border: '1px solid #ccc',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid #ccc',
  cursor: 'pointer',
}