'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import NavBar from '../../../../components/NavBar'
import { supabase } from '../../../../lib/supabaseClient'

type Participant = {
  type: 'placeholder' | 'profile'
  id: string
  name: string
}

type TipRow = {
  match_id: string
  home_team_name: string
  away_team_name: string
  home_goals: number | null
  away_goals: number | null
  home_pred_home: number | null
  home_pred_away: number | null
  home_points: number | null
  away_pred_home: number | null
  away_pred_away: number | null
  away_points: number | null
}

export default function ChampionsLeagueDuelDetailPage() {
  const { duelID } = useParams()
  const duelId = Array.isArray(duelID) ? duelID[0] : duelID

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [duel, setDuel] = useState<any>(null)
  const [homeTeam, setHomeTeam] = useState<any>(null)
  const [awayTeam, setAwayTeam] = useState<any>(null)
  const [rows, setRows] = useState<TipRow[]>([])

  useEffect(() => {
    load()
  }, [duelId])

  async function load() {
    setLoading(true)
    setMessage('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const duelIdValue = Array.isArray(duelId) ? duelId[0] : duelId

    const { data: duelData, error: duelError } = await supabase
      .from('cl_matches')
      .select('*')
      .eq('id', duelId)
      .maybeSingle()

    if (duelError) {
      setMessage(duelError.message)
      setLoading(false)
      return
    }

    if (!duelData) {
      setMessage(`CL-Duell wurde nicht gefunden. ID: ${duelIdValue}`)
      setLoading(false)
      return
    }

    setDuel(duelData)

    const { data: lockData } = await supabase
      .from('matchday_locks')
      .select('is_unlocked')
      .eq('season_id', duelData.season_id)
      .eq('matchday', duelData.matchday)
      .maybeSingle()

    if (!lockData?.is_unlocked) {
      setMessage('Der Tippvergleich ist noch gesperrt.')
      setLoading(false)
      return
    }

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, logo_url')

    const teamMap = Object.fromEntries(
      (teamsData || []).map((team) => [team.id, team])
    )

    const home = teamMap[duelData.home_team_id]
    const away = teamMap[duelData.away_team_id]

    setHomeTeam(home)
    setAwayTeam(away)

    const homeParticipant = await getParticipantForTeam(
      duelData.season_id,
      duelData.home_team_id
    )

    const awayParticipant = await getParticipantForTeam(
      duelData.season_id,
      duelData.away_team_id
    )

    const { data: matchData } = await supabase
      .from('bundesliga_matches')
      .select('id, home_team_id, away_team_id, home_goals, away_goals')
      .eq('season_id', duelData.season_id)
      .eq('matchday', duelData.matchday)
      .order('id', { ascending: true })

    const matches = matchData || []
    const matchIds = matches.map((m) => m.id)

    const homePredictions = await loadPredictionsForParticipant(
      homeParticipant,
      duelData.season_id,
      matchIds
    )

    const awayPredictions = await loadPredictionsForParticipant(
      awayParticipant,
      duelData.season_id,
      matchIds
    )

    const tipRows: TipRow[] = matches.map((match) => {
      const homePred = (homePredictions as any)[match.id]
      const awayPred = (awayPredictions as any)[match.id]

      return {
        match_id: match.id,
        home_team_name: teamMap[match.home_team_id]?.name ?? 'Heim',
        away_team_name: teamMap[match.away_team_id]?.name ?? 'Auswärts',
        home_goals: match.home_goals,
        away_goals: match.away_goals,
        home_pred_home: homePred?.pred_home ?? null,
        home_pred_away: homePred?.pred_away ?? null,
        home_points: homePred?.points ?? null,
        away_pred_home: awayPred?.pred_home ?? null,
        away_pred_away: awayPred?.pred_away ?? null,
        away_points: awayPred?.points ?? null,
      }
    })

    setRows(tipRows)
    setLoading(false)
  }

  async function getParticipantForTeam(
    seasonId: string,
    teamId: string
  ): Promise<Participant | null> {
    const { data: placeholderAssignment } = await supabase
      .from('placeholder_team_assignments')
      .select('placeholder_player_id')
      .eq('season_id', seasonId)
      .eq('team_id', teamId)
      .maybeSingle()

    if (placeholderAssignment?.placeholder_player_id) {
      const { data: player } = await supabase
        .from('placeholder_players')
        .select('id, display_name')
        .eq('id', placeholderAssignment.placeholder_player_id)
        .single()

      if (player) {
        return {
          type: 'placeholder',
          id: player.id,
          name: player.display_name,
        }
      }
    }

    const { data: userAssignment } = await supabase
      .from('user_team_assignments')
      .select('user_id')
      .eq('season_id', seasonId)
      .eq('team_id', teamId)
      .maybeSingle()

    if (userAssignment?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userAssignment.user_id)
        .single()

      if (profile) {
        return {
          type: 'profile',
          id: profile.id,
          name: profile.display_name,
        }
      }
    }

    return null
  }

  async function loadPredictionsForParticipant(
    participant: Participant | null,
    seasonId: string,
    matchIds: string[]
  ) {
    if (!participant || matchIds.length === 0) return {}

    if (participant.type === 'placeholder') {
      const { data } = await supabase
        .from('placeholder_predictions')
        .select('match_id, pred_home, pred_away, points')
        .eq('season_id', seasonId)
        .eq('placeholder_player_id', participant.id)
        .in('match_id', matchIds)

      return Object.fromEntries((data || []).map((p) => [p.match_id, p]))
    }

    const { data } = await supabase
      .from('predictions')
      .select('match_id, pred_home, pred_away, points')
      .eq('season_id', seasonId)
      .eq('user_id', participant.id)
      .in('match_id', matchIds)

    return Object.fromEntries((data || []).map((p) => [p.match_id, p]))
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Lade Tippvergleich...</main>
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/duelle" style={backLinkStyle}>
          ← Zurück zu den Duellen
        </Link>

        <h1>Tippvergleich</h1>

        {message ? (
          <div style={infoBoxStyle}>{message}</div>
        ) : (
          <>
            <div style={duelHeaderStyle}>
              <TeamHeader team={homeTeam} />

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900 }}>
                  {duel?.home_tip_points ?? '-'} : {duel?.away_tip_points ?? '-'}
                </div>

                <div style={{ color: '#666', marginTop: 4 }}>
                  {duel ? getClMatchdayLabel(duel.matchday, duel.phase) : 'Champions League'}
                </div>
              </div>

              <TeamHeader team={awayTeam} alignRight />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Spiel</th>
                    <th style={thStyle}>Ergebnis</th>
                    <th style={thStyle}>{homeTeam?.name}</th>
                    <th style={thStyle}>Pkt</th>
                    <th style={thStyle}>{awayTeam?.name}</th>
                    <th style={thStyle}>Pkt</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.match_id}>
                      <td style={tdStyle}>
                        {row.home_team_name} - {row.away_team_name}
                      </td>

                      <td style={centerTdStyle}>
                        {row.home_goals ?? '-'}:{row.away_goals ?? '-'}
                      </td>

                      <td style={centerTdStyle}>
                        {row.home_pred_home ?? '-'}:{row.home_pred_away ?? '-'}
                      </td>

                      <td style={pointsTdStyle}>{row.home_points ?? '-'}</td>

                      <td style={centerTdStyle}>
                        {row.away_pred_home ?? '-'}:{row.away_pred_away ?? '-'}
                      </td>

                      <td style={pointsTdStyle}>{row.away_points ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}

function getClMatchdayLabel(matchday: number, phase: string) {
  if (phase === 'preliminary') return `Vorrunde ${matchday - 6}. Spieltag`
  if (phase === 'main') return `Hauptrunde ${matchday - 16}. Spieltag`
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return `CL-Spieltag ${matchday}`
}

function TeamHeader({
  team,
  alignRight,
}: {
  team: any
  alignRight?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        gap: 10,
        textAlign: alignRight ? 'right' : 'left',
      }}
    >
      {!alignRight && team?.logo_url && (
        <img src={team.logo_url} alt="" style={logoStyle} />
      )}

      <strong>{team?.name ?? 'Team'}</strong>

      {alignRight && team?.logo_url && (
        <img src={team.logo_url} alt="" style={logoStyle} />
      )}
    </div>
  )
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  color: 'black',
  fontWeight: 700,
  textDecoration: 'none',
}

const duelHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 18,
  alignItems: 'center',
  border: '1px solid #ddd',
  borderRadius: 14,
  padding: 18,
  background: '#fafafa',
  marginBottom: 24,
}

const logoStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  objectFit: 'contain',
}

const infoBoxStyle: React.CSSProperties = {
  padding: 18,
  border: '1px solid #ddd',
  borderRadius: 12,
  background: '#fafafa',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 760,
}

const thStyle: React.CSSProperties = {
  padding: 12,
  textAlign: 'left',
  borderBottom: '2px solid #ddd',
  background: '#f5f5f5',
}

const tdStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: '1px solid #eee',
}

const centerTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
}

const pointsTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  fontWeight: 900,
}