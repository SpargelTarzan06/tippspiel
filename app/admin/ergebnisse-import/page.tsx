'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

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

type ParsedResult = {
  matchday: number
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  matchId?: string
  status: 'ok' | 'skip' | 'error'
  error?: string
}

export default function ErgebnisseImportPage() {
  const router = useRouter()

  const [season, setSeason] = useState<any>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  const [rawText, setRawText] = useState('')
  const [parsedResults, setParsedResults] = useState<ParsedResult[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
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
      .from('teams')
      .select('id, name')

    const { data: matchesData } = await supabase
      .from('bundesliga_matches')
      .select('id, matchday, home_team_id, away_team_id')
      .eq('season_id', seasonData.id)

    setTeams(teamsData || [])
    setMatches(matchesData || [])

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

    const results: ParsedResult[] = []
    let currentMatchday: number | null = null

    const teamMap = Object.fromEntries(teams.map((team) => [team.id, team.name]))

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
        results.push({
          matchday: 0,
          homeTeam: '',
          awayTeam: '',
          homeGoals: null,
          awayGoals: null,
          status: 'error',
          error: `Kein Spieltag erkannt: ${line}`,
        })
        continue
      }

      const hasResult = /(.+?)\s+(\d+)\s+(\d+)$/.test(textWithoutMatchday)

      if (!hasResult) {
        const matchText = textWithoutMatchday.trim()
        const teamsSplit = matchText.split('-')

        if (teamsSplit.length >= 2) {
          results.push({
            matchday,
            homeTeam: teamsSplit[0].trim(),
            awayTeam: teamsSplit.slice(1).join('-').trim(),
            homeGoals: null,
            awayGoals: null,
            status: 'skip',
            error: 'Kein Ergebnis eingetragen, wird übersprungen',
          })
          continue
        }

        results.push({
          matchday,
          homeTeam: '',
          awayTeam: '',
          homeGoals: null,
          awayGoals: null,
          status: 'error',
          error: `Keine Ergebnisse erkannt: ${line}`,
        })
        continue
      }

      const resultMatch = textWithoutMatchday.match(/(.+?)\s+(\d+)\s+(\d+)$/)

      if (!resultMatch) continue

      const matchText = resultMatch[1].trim()
      const homeGoals = Number(resultMatch[2])
      const awayGoals = Number(resultMatch[3])

      const teamsSplit = matchText.split('-')

      if (teamsSplit.length < 2) {
        results.push({
          matchday,
          homeTeam: matchText,
          awayTeam: '',
          homeGoals,
          awayGoals,
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
        results.push({
          matchday,
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeGoals,
          awayGoals,
          status: 'error',
          error: `Team nicht gefunden: ${!homeTeam ? homeTeamName : awayTeamName}`,
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
        results.push({
          matchday,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeGoals,
          awayGoals,
          status: 'error',
          error: 'Spiel nicht in bundesliga_matches gefunden',
        })
        continue
      }

      results.push({
        matchday,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeGoals,
        awayGoals,
        matchId: match.id,
        status: 'ok',
      })
    }

    setParsedResults(results)
  }

  async function saveResults() {
    const validResults = parsedResults.filter(
      (result) => result.status === 'ok' && result.matchId
    )

    if (validResults.length === 0) {
      setMessage('Keine gültigen Ergebnisse zum Speichern.')
      return
    }

    setSaving(true)
    setMessage('')

    for (const result of validResults) {
      const { error } = await supabase
        .from('bundesliga_matches')
        .update({
          home_goals: result.homeGoals,
          away_goals: result.awayGoals,
        })
        .eq('id', result.matchId)

      if (error) {
        setMessage(`Fehler: ${error.message}`)
        setSaving(false)
        return
      }
    }

    setMessage(`${validResults.length} Ergebnisse gespeichert.`)
    setSaving(false)
  }

  async function calculateImportedMatchdays() {
    if (!season) return

    const matchdays = [
      ...new Set(
        parsedResults
          .filter((result) => result.status === 'ok')
          .map((result) => result.matchday)
      ),
    ].sort((a, b) => a - b)

    if (matchdays.length === 0) {
      setMessage('Keine Spieltage zum Berechnen gefunden.')
      return
    }

    setCalculating(true)
    setMessage('')

    for (const matchday of matchdays) {
      const { error } = await supabase.rpc('calculate_matchday', {
        target_season_name: season.name,
        target_matchday: matchday,
      })

      if (error) {
        setMessage(`Fehler bei Spieltag ${matchday}: ${error.message}`)
        setCalculating(false)
        return
      }
    }

    setMessage(`${matchdays.length} Spieltage berechnet.`)
    setCalculating(false)
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1>Ergebnisse importieren</h1>

        {season && (
          <p style={{ color: '#666' }}>Aktive Saison: {season.name}</p>
        )}

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Excel-Ergebnisse hier einfügen..."
                style={{
                  minHeight: 260,
                  padding: 12,
                  fontFamily: 'monospace',
                }}
              />

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={parseText}>Vorschau prüfen</button>

                <button
                  onClick={saveResults}
                  disabled={
                    saving ||
                    parsedResults.filter((r) => r.status === 'ok').length === 0
                  }
                >
                  {saving ? 'Speichert...' : 'Gültige Ergebnisse speichern'}
                </button>

                <button
                  onClick={calculateImportedMatchdays}
                  disabled={
                    calculating ||
                    parsedResults.filter((r) => r.status === 'ok').length === 0
                  }
                >
                  {calculating ? 'Berechnet...' : 'Importierte Spieltage berechnen'}
                </button>
              </div>
            </div>

            {message && <p>{message}</p>}

            {parsedResults.length > 0 && (
              <>
                <h2>Vorschau</h2>

                <p>
                  Gültig:{' '}
                  {parsedResults.filter((r) => r.status === 'ok').length} ·
                  Übersprungen:{' '}
                  {parsedResults.filter((r) => r.status === 'skip').length} ·
                  Fehler:{' '}
                  {parsedResults.filter((r) => r.status === 'error').length}
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
                        <th>Ergebnis</th>
                        <th>Hinweis</th>
                      </tr>
                    </thead>

                    <tbody>
                      {parsedResults.map((result, index) => (
                        <tr
                          key={index}
                          style={{
                            background:
                              result.status === 'ok'
                                ? '#f0fff4'
                                : result.status === 'skip'
                                ? '#fff3cd'
                                : '#fff0f0',
                          }}
                        >
                          <td>
                            {result.status === 'ok'
                              ? 'OK'
                              : result.status === 'skip'
                              ? 'Übersprungen'
                              : 'Fehler'}
                          </td>
                          <td>{result.matchday}</td>
                          <td>
                            {result.homeTeam} - {result.awayTeam}
                          </td>
                          <td>
                            {result.homeGoals ?? '-'}:{result.awayGoals ?? '-'}
                          </td>
                          <td>{result.error ?? ''}</td>
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