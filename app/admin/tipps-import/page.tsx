'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type PlaceholderPlayer = {
  id: string
  display_name: string
}

type Team = {
  id: string
  name: string
}

type Match = {
  id: string
  matchday: number
  home_team_id: string
  away_team_id: string
  home_team_name?: string
  away_team_name?: string
}

type ParsedTip = {
  matchday: number
  homeTeam: string
  awayTeam: string
  predHome: number
  predAway: number
  matchId?: string
  status: 'ok' | 'error'
  error?: string
}

export default function TippsImportPage() {
  const router = useRouter()

  const [season, setSeason] = useState<any>(null)
  const [players, setPlayers] = useState<PlaceholderPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedTips, setParsedTips] = useState<ParsedTip[]>([])

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

    const { data: playerData } = await supabase
      .from('placeholder_players')
      .select('id, display_name')
      .order('display_name')

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')

    const { data: matchesData } = await supabase
      .from('bundesliga_matches')
      .select('id, matchday, home_team_id, away_team_id')
      .eq('season_id', seasonData.id)

    setPlayers(playerData || [])
    setTeams(teamsData || [])
    setMatches(matchesData || [])

    if (playerData && playerData.length > 0) {
      setSelectedPlayerId(playerData[0].id)
    }

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
    return teams.find((team) => normalizeName(team.name) === normalized)
  }

  function parseText() {
    setMessage('')

    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const tips: ParsedTip[] = []
    let currentMatchday: number | null = null

    const teamMap = Object.fromEntries(
      teams.map((team) => [team.id, team.name])
    )

    const enrichedMatches = matches.map((match) => ({
      ...match,
      home_team_name: teamMap[match.home_team_id],
      away_team_name: teamMap[match.away_team_id],
    }))

    for (const line of lines) {
      const cleanedLine = line
        .replaceAll('–', '-')
        .replaceAll('—', '-')
        .replace(/\t+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const startsWithMatchday = /^\d+\s/.test(cleanedLine)

      let matchday = currentMatchday
      let textWithoutMatchday = cleanedLine

      if (startsWithMatchday) {
        const matchdayMatch = cleanedLine.match(/^(\d+)\s+/)

        if (matchdayMatch) {
          matchday = Number(matchdayMatch[1])
          currentMatchday = matchday
          textWithoutMatchday = cleanedLine.replace(/^\d+\s+/, '')
        }
      }

      if (!matchday) {
        tips.push({
          matchday: 0,
          homeTeam: '',
          awayTeam: '',
          predHome: 0,
          predAway: 0,
          status: 'error',
          error: `Kein Spieltag erkannt: ${line}`,
        })
        continue
      }

      const scoreMatch = textWithoutMatchday.match(
        /(.+?)\s+(\d+)\s+(\d+)(?:\s+\d+)?$/
      )

      if (!scoreMatch) {
        tips.push({
          matchday,
          homeTeam: '',
          awayTeam: '',
          predHome: 0,
          predAway: 0,
          status: 'error',
          error: `Keine Tipps erkannt: ${line}`,
        })
        continue
      }

      const matchText = scoreMatch[1].trim()
      const predHome = Number(scoreMatch[2])
      const predAway = Number(scoreMatch[3])

      const teamsSplit = matchText.split('-')

      if (teamsSplit.length < 2) {
        tips.push({
          matchday,
          homeTeam: matchText,
          awayTeam: '',
          predHome,
          predAway,
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
        tips.push({
          matchday,
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          predHome,
          predAway,
          status: 'error',
          error: `Team nicht gefunden: ${
            !homeTeam ? homeTeamName : awayTeamName
          }`,
        })
        continue
      }

      const match = enrichedMatches.find(
        (m) =>
          m.matchday === matchday &&
          normalizeName(m.home_team_name || '') === normalizeName(homeTeam.name) &&
          normalizeName(m.away_team_name || '') === normalizeName(awayTeam.name)
      )

      if (!match) {
        tips.push({
          matchday,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          predHome,
          predAway,
          status: 'error',
          error: 'Spiel nicht in bundesliga_matches gefunden',
        })
        continue
      }

      tips.push({
        matchday,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        predHome,
        predAway,
        matchId: match.id,
        status: 'ok',
      })
    }

    setParsedTips(tips)
  }

  async function saveTips() {
    if (!selectedPlayerId) return

    const validTips = parsedTips.filter(
      (tip) => tip.status === 'ok' && tip.matchId
    )

    if (validTips.length === 0) {
      setMessage('Keine gültigen Tipps zum Speichern.')
      return
    }

    setSaving(true)
    setMessage('')

    for (const tip of validTips) {
      const { error } = await supabase.rpc(
        'admin_upsert_placeholder_prediction',
        {
          target_placeholder_player_id: selectedPlayerId,
          target_match_id: tip.matchId,
          new_pred_home: tip.predHome,
          new_pred_away: tip.predAway,
        }
      )

      if (error) {
        setMessage(`Fehler: ${error.message}`)
        setSaving(false)
        return
      }
    }

    setMessage(`${validTips.length} Tipps gespeichert.`)
    setSaving(false)
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1>Tipps importieren</h1>

        {season && (
          <p style={{ color: '#666' }}>Aktive Saison: {season.name}</p>
        )}

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              <label>
                Platzhalter-Spieler:
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  style={{ display: 'block', marginTop: 6, padding: 8 }}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Excel-Zeilen hier einfügen..."
                style={{
                  minHeight: 240,
                  padding: 12,
                  fontFamily: 'monospace',
                }}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={parseText}>Vorschau prüfen</button>

                <button
                  onClick={saveTips}
                  disabled={
                    saving ||
                    parsedTips.filter((t) => t.status === 'ok').length === 0
                  }
                >
                  {saving ? 'Speichert...' : 'Gültige Tipps speichern'}
                </button>
              </div>
            </div>

            {message && <p>{message}</p>}

            {parsedTips.length > 0 && (
              <>
                <h2>Vorschau</h2>

                <p>
                  Gültig:{' '}
                  {parsedTips.filter((tip) => tip.status === 'ok').length} /{' '}
                  {parsedTips.length}
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
                        <th>Spiel</th>
                        <th>Tipp</th>
                        <th>Fehler</th>
                      </tr>
                    </thead>

                    <tbody>
                      {parsedTips.map((tip, index) => (
                        <tr
                          key={index}
                          style={{
                            background:
                              tip.status === 'ok' ? '#f0fff4' : '#fff0f0',
                          }}
                        >
                          <td>{tip.status === 'ok' ? 'OK' : 'Fehler'}</td>
                          <td>{tip.matchday}</td>
                          <td>
                            {tip.homeTeam} - {tip.awayTeam}
                          </td>
                          <td>
                            {tip.predHome}:{tip.predAway}
                          </td>
                          <td>{tip.error ?? ''}</td>
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