'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type PlayerOption = {
  id: string
  display_name: string
  source: 'profile' | 'placeholder'
}

type Match = {
  id: string
  matchday: number
  home_team_name: string
  away_team_name: string
  home_logo_url: string | null
  away_logo_url: string | null
}

type PredictionMap = Record<
  string,
  {
    pred_home: number | null
    pred_away: number | null
  }
>

export default function TippsVerwaltenPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedPlayerSource, setSelectedPlayerSource] =
    useState<'profile' | 'placeholder'>('profile')

  const [selectedMatchday, setSelectedMatchday] = useState(1)

  const [predictions, setPredictions] = useState<PredictionMap>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedPlayerId && matches.length > 0) {
      loadPredictions()
    }
  }, [selectedPlayerId, selectedPlayerSource, selectedMatchday, matches])

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

  async function loadInitialData() {
    setLoading(true)
    setMessage('')

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name')

    const { data: placeholderData } = await supabase
      .from('placeholder_players')
      .select('id, display_name')
      .order('display_name')

    const profilePlayers: PlayerOption[] =
      profilesData?.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        source: 'profile',
      })) || []

    const placeholderPlayers: PlayerOption[] =
      placeholderData?.map((p) => ({
        id: p.id,
        display_name: `${p.display_name} (Platzhalter)`,
        source: 'placeholder',
      })) || []

    const allPlayers = [...profilePlayers, ...placeholderPlayers]

    setPlayers(allPlayers)

    if (allPlayers.length > 0) {
      setSelectedPlayerId(allPlayers[0].id)
      setSelectedPlayerSource(allPlayers[0].source)
    }

    const { data: matchesData } = await supabase
      .from('my_predictions_view')
      .select('*')
      .order('matchday')

    const uniqueMatches = new Map<string, Match>()

    for (const match of matchesData || []) {
      uniqueMatches.set(match.match_id, {
        id: match.match_id,
        matchday: match.matchday,
        home_team_name: match.home_team_name,
        away_team_name: match.away_team_name,
        home_logo_url: match.home_logo_url,
        away_logo_url: match.away_logo_url,
      })
    }

    setMatches(Array.from(uniqueMatches.values()))
    setLoading(false)
  }

  async function loadPredictions() {
    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!seasonData) return

    const currentMatches = matches.filter(
      (m) => m.matchday === selectedMatchday
    )

    const matchIds = currentMatches.map((m) => m.id)

    if (matchIds.length === 0) {
      setPredictions({})
      return
    }

    let data: any[] | null = []

    if (selectedPlayerSource === 'profile') {
      const result = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', selectedPlayerId)
        .eq('season_id', seasonData.id)
        .in('match_id', matchIds)

      data = result.data
    } else {
      const result = await supabase
        .from('placeholder_predictions')
        .select('*')
        .eq('placeholder_player_id', selectedPlayerId)
        .eq('season_id', seasonData.id)
        .in('match_id', matchIds)

      data = result.data
    }

    const map: PredictionMap = {}

    for (const row of data || []) {
      map[row.match_id] = {
        pred_home: row.pred_home,
        pred_away: row.pred_away,
      }
    }

    setPredictions(map)
  }

  function handlePlayerChange(value: string) {
    const [source, id] = value.split(':')

    setSelectedPlayerSource(source as 'profile' | 'placeholder')
    setSelectedPlayerId(id)
    setPredictions({})
    setMessage('')
  }

  function updatePrediction(
    matchId: string,
    field: 'pred_home' | 'pred_away',
    value: string
  ) {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        pred_home: prev[matchId]?.pred_home ?? null,
        pred_away: prev[matchId]?.pred_away ?? null,
        [field]: value === '' ? null : Number(value),
      },
    }))
  }

  async function savePredictions() {
    setSaving(true)
    setMessage('')

    const currentMatches = matches.filter(
      (m) => m.matchday === selectedMatchday
    )

    for (const match of currentMatches) {
      const pred = predictions[match.id]

      if (
        pred?.pred_home === null ||
        pred?.pred_home === undefined ||
        pred?.pred_away === null ||
        pred?.pred_away === undefined
      ) {
        continue
      }

      const rpcName =
        selectedPlayerSource === 'profile'
          ? 'admin_upsert_prediction'
          : 'admin_upsert_placeholder_prediction'

      const rpcArgs =
        selectedPlayerSource === 'profile'
          ? {
              target_user_id: selectedPlayerId,
              target_match_id: match.id,
              new_pred_home: pred.pred_home,
              new_pred_away: pred.pred_away,
            }
          : {
              target_placeholder_player_id: selectedPlayerId,
              target_match_id: match.id,
              new_pred_home: pred.pred_home,
              new_pred_away: pred.pred_away,
            }

      const { error } = await supabase.rpc(rpcName, rpcArgs)

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }
    }

    setMessage('Tipps gespeichert.')
    setSaving(false)
    await loadPredictions()
  }

  const visibleMatches = matches.filter(
    (m) => m.matchday === selectedMatchday
  )

  const selectedValue = `${selectedPlayerSource}:${selectedPlayerId}`

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <h1>Tipps verwalten</h1>

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 24,
                flexWrap: 'wrap',
              }}
            >
              <select value={selectedValue} onChange={(e) => handlePlayerChange(e.target.value)}>
                {players.map((player) => (
                  <option
                    key={`${player.source}:${player.id}`}
                    value={`${player.source}:${player.id}`}
                  >
                    {player.display_name}
                  </option>
                ))}
              </select>

              <select
                value={selectedMatchday}
                onChange={(e) => setSelectedMatchday(Number(e.target.value))}
              >
                {Array.from({ length: 34 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}. Spieltag
                  </option>
                ))}
              </select>
            </div>

            {message && <p>{message}</p>}

            <div style={{ display: 'grid', gap: 12 }}>
              {visibleMatches.map((match) => {
                const pred = predictions[match.id]

                return (
                  <div
                    key={match.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      {match.home_logo_url && (
                        <img src={match.home_logo_url} width={24} alt="" />
                      )}

                      <strong>{match.home_team_name}</strong>

                      <span>vs</span>

                      {match.away_logo_url && (
                        <img src={match.away_logo_url} width={24} alt="" />
                      )}

                      <strong>{match.away_team_name}</strong>
                    </div>

                    <input
                      type="number"
                      min="0"
                      value={pred?.pred_home ?? ''}
                      onChange={(e) =>
                        updatePrediction(match.id, 'pred_home', e.target.value)
                      }
                      style={{ width: 60 }}
                    />

                    {' : '}

                    <input
                      type="number"
                      min="0"
                      value={pred?.pred_away ?? ''}
                      onChange={(e) =>
                        updatePrediction(match.id, 'pred_away', e.target.value)
                      }
                      style={{ width: 60 }}
                    />
                  </div>
                )
              })}
            </div>

            <button
              onClick={savePredictions}
              disabled={saving}
              style={{
                marginTop: 24,
                padding: '10px 18px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Speichert...' : 'Tipps speichern'}
            </button>
          </>
        )}
      </main>
    </>
  )
}