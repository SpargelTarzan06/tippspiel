'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Team = {
  id: string
  name: string
  is_active: boolean
}
type ParsedMatch = {
  matchday: number
  homeTeam: string
  awayTeam: string
  homeTeamId?: string
  awayTeamId?: string
  status: 'ok' | 'error'
  error?: string
}

export default function SpielplanImportPage() {
  const router = useRouter()

  const [season, setSeason] = useState<any>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [teamMessage, setTeamMessage] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedMatches, setParsedMatches] = useState<ParsedMatch[]>([])

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
    setMessage('')

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
.from('active_season_teams')
.select('id, name, is_active')
.order('name')

    setTeams(teamsData || [])
    setLoading(false)
  }

  function normalizeName(value: string) {
    return value
      .toLowerCase()
      .replaceAll('–', '-')
      .replaceAll('—', '-')

      .replaceAll('fc bayern münchen', 'bayern münchen')
      .replaceAll('fc bayern munchen', 'bayern münchen')

      .replaceAll('sv werder bremen', 'werder bremen')

      .replaceAll('bor. mönchengladbach', 'borussia mönchengladbach')
      .replaceAll('bor. monchengladbach', 'borussia mönchengladbach')
      .replaceAll('borussia mgladbach', 'borussia mönchengladbach')

      .replaceAll('mainz 05', '1. fsv mainz 05')
      .replaceAll('fsv mainz 05', '1. fsv mainz 05')

      .replaceAll('fc köln', '1. fc köln')
      .replaceAll('fc koln', '1. fc köln')

      .replaceAll('union berlin', '1. fc union berlin')
      .replaceAll('heidenheim', '1. fc heidenheim')
      .replaceAll('bayer leverkusen', 'bayer 04 leverkusen')

      .replace(/\s+/g, ' ')
      .trim()
  }

  function findTeamByName(name: string) {
    const normalized = normalizeName(name)
    return teams.find(
  (team) => team.is_active && normalizeName(team.name) === normalized
)
  }

  function parseText() {
    setMessage('')

    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const parsed: ParsedMatch[] = []
    let currentMatchday: number | null = null

    for (const line of lines) {
      const cleanedLine = line
        .replaceAll('–', '-')
        .replaceAll('—', '-')
        .replace(/\t+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const startsWithMatchday = /^\d+\s/.test(cleanedLine)

      let matchday = currentMatchday
      let matchText = cleanedLine

      if (startsWithMatchday) {
        const matchdayMatch = cleanedLine.match(/^(\d+)\s+/)

        if (matchdayMatch) {
          matchday = Number(matchdayMatch[1])
          currentMatchday = matchday
          matchText = cleanedLine.replace(/^\d+\s+/, '')
        }
      }

      if (!matchday) {
        parsed.push({
          matchday: 0,
          homeTeam: '',
          awayTeam: '',
          status: 'error',
          error: `Kein Spieltag erkannt: ${line}`,
        })
        continue
      }

      const teamsSplit = matchText.split('-')

      if (teamsSplit.length < 2) {
        parsed.push({
          matchday,
          homeTeam: matchText,
          awayTeam: '',
          status: 'error',
          error: `Teams nicht erkannt: ${line}`,
        })
        continue
      }

      const homeTeamName = teamsSplit[0].trim()
      const awayTeamName = teamsSplit.slice(1).join('-').trim()

      const homeTeam = findTeamByName(homeTeamName)
      const awayTeam = findTeamByName(awayTeamName)

      if (!homeTeam || !awayTeam) {
        parsed.push({
          matchday,
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          status: 'error',
          error: `Team nicht gefunden: ${!homeTeam ? homeTeamName : awayTeamName}`,
        })
        continue
      }

      parsed.push({
        matchday,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: 'ok',
      })
    }

    setParsedMatches(parsed)
  }

  async function saveSchedule() {
    if (!season) return

    const validMatches = parsedMatches.filter(
      (match) =>
        match.status === 'ok' &&
        match.homeTeamId &&
        match.awayTeamId
    )

    if (validMatches.length === 0) {
      setMessage('Keine gültigen Spiele zum Speichern.')
      return
    }

    setSaving(true)
    setMessage('')

    const rows = validMatches.map((match) => ({
      season_id: season.id,
      matchday: match.matchday,
      home_team_id: match.homeTeamId,
      away_team_id: match.awayTeamId,
      home_goals: null,
      away_goals: null,
    }))

    const { error } = await supabase
      .from('bundesliga_matches')
      .upsert(rows, {
        onConflict: 'season_id,matchday,home_team_id,away_team_id',
      })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSaving(false)
      return
    }

    setMessage(`${validMatches.length} Spiele gespeichert.`)
    setSaving(false)
  }
  async function generateFantasyMatches() {
  const confirmed = window.confirm(
    'Fantasy-Duelle für die aktive Saison neu erzeugen? Bestehende Fantasy-Duelle dieser Saison werden ersetzt.'
  )

  if (!confirmed) return

  setSaving(true)
  setMessage('')

  const { error } = await supabase.rpc(
    'generate_fantasy_matches_for_active_season'
  )

  if (error) {
    setMessage(`Fehler: ${error.message}`)
    setSaving(false)
    return
  }

  setMessage('Fantasy-Duelle wurden erzeugt.')
  setSaving(false)
}
async function clearSchedule() {
  const confirmed = window.confirm(
    'Achtung: Der komplette Bundesliga-Spielplan der aktiven Saison inklusive Tipps und Duelle wird gelöscht. Fortfahren?'
  )

  if (!confirmed) return

  setSaving(true)
  setMessage('')

  const { error } = await supabase.rpc('clear_active_season_schedule')

  if (error) {
    setMessage(error.message)
    setSaving(false)
    return
  }

  setParsedMatches([])
  setRawText('')
  setMessage('Spielplan wurde gelöscht.')
  setSaving(false)
}

async function addTeam() {
  if (!season) return
  if (!newTeamName.trim()) return

  setTeamMessage('')

  const teamName = newTeamName.trim()

  let { data: existingTeam, error: findError } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', teamName)
    .maybeSingle()

  if (findError) {
    setTeamMessage(findError.message)
    return
  }

  let teamId = existingTeam?.id

  if (!teamId) {
    const { data: newTeam, error: insertError } = await supabase
      .from('teams')
      .insert({ name: teamName })
      .select('id')
      .single()

    if (insertError) {
      setTeamMessage(insertError.message)
      return
    }

    teamId = newTeam.id
  }

  const { error: seasonTeamError } = await supabase
    .from('season_teams')
    .upsert(
      {
        season_id: season.id,
        team_id: teamId,
        is_active: true,
      },
      {
        onConflict: 'season_id,team_id',
      }
    )

  if (seasonTeamError) {
    setTeamMessage(seasonTeamError.message)
    return
  }

  setNewTeamName('')
  setTeamMessage('Mannschaft wurde für diese Saison aktiviert.')
  await loadData()
}

async function toggleTeam(team: Team) {
  if (!season) return

  const { error } = await supabase
    .from('season_teams')
    .update({ is_active: !team.is_active })
    .eq('season_id', season.id)
    .eq('team_id', team.id)

  if (error) {
    setTeamMessage(error.message)
    return
  }

  await loadData()
}
  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1>Spielplan importieren</h1>

        {season && (
          <p style={{ color: '#666' }}>Aktive Saison: {season.name}</p>
        )}

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <p style={{ color: '#666' }}>
              Format: Spieltag nur bei der ersten Zeile eines Spieltags nötig.
              Beispiel: <code>1 Bayern München - Dortmund</code>
            </p>

            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Spielplan hier einfügen..."
                style={{
                  minHeight: 260,
                  padding: 12,
                  fontFamily: 'monospace',
                }}
              />

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={parseText}>Vorschau prüfen</button>

                <button
                  onClick={saveSchedule}
                  disabled={
                    saving ||
                    parsedMatches.filter((m) => m.status === 'ok').length === 0
                  }
                >
                  {saving ? 'Speichert...' : 'Gültige Spiele speichern'}
                </button>
                <button
  onClick={generateFantasyMatches}
  disabled={saving}
>
  Fantasy-Duelle erzeugen
</button>
              <button
  onClick={clearSchedule}
  disabled={saving}
  style={{ background: '#fee2e2' }}
>
  Aktuellen Spielplan löschen
</button>
              
          </div>

            </div>

            {message && <p>{message}</p>}
<section
  style={{
    marginTop: 40,
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 16,
  }}
>
  <h2>Mannschaften verwalten</h2>

  <p style={{ color: '#666' }}>
    Deaktivierte Mannschaften bleiben für Alltime-Tabellen erhalten, werden aber beim neuen Spielplan nicht mehr verwendet.
  </p>

  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
    <input
      value={newTeamName}
      onChange={(e) => setNewTeamName(e.target.value)}
      placeholder="Neue Mannschaft"
      style={{ padding: 8, flex: 1 }}
    />

    <button onClick={addTeam}>
      Mannschaft anlegen
    </button>
  </div>

  {teamMessage && <p>{teamMessage}</p>}

  <div style={{ display: 'grid', gap: 8 }}>
    {teams.map((team) => (
      <div
        key={team.id}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid #eee',
          borderRadius: 8,
          padding: 10,
          background: team.is_active ? '#f0fff4' : '#f5f5f5',
        }}
      >
        <strong>{team.name}</strong>

        <button onClick={() => toggleTeam(team)}>
          {team.is_active ? 'Deaktivieren' : 'Aktivieren'}
        </button>
      </div>
    ))}
  </div>
</section>
            {parsedMatches.length > 0 && (
              <>
                <h2>Vorschau</h2>

                <p>
                  Gültig:{' '}
                  {parsedMatches.filter((m) => m.status === 'ok').length} ·
                  Fehler:{' '}
                  {parsedMatches.filter((m) => m.status === 'error').length}
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table
                    border={1}
                    cellPadding={6}
                    style={{ borderCollapse: 'collapse', width: '100%' }}
                  >
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>ST</th>
                        <th>Heim</th>
                        <th>Auswärts</th>
                        <th>Fehler</th>
                      </tr>
                    </thead>

                    <tbody>
                      {parsedMatches.map((match, index) => (
                        <tr
                          key={index}
                          style={{
                            background:
                              match.status === 'ok' ? '#f0fff4' : '#fff0f0',
                          }}
                        >
                          <td>{match.status === 'ok' ? 'OK' : 'Fehler'}</td>
                          <td>{match.matchday}</td>
                          <td>{match.homeTeam}</td>
                          <td>{match.awayTeam}</td>
                          <td>{match.error ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}