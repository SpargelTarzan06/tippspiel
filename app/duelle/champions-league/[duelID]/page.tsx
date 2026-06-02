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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 760)

    const handleResize = () => {
      setIsMobile(window.innerWidth < 760)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
      setMessage('CL-Duell wurde nicht gefunden.')
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

    setHomeTeam(teamMap[duelData.home_team_id])
    setAwayTeam(teamMap[duelData.away_team_id])

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

    const { data } = await supabase
      .from('predictions')
      .select('match_id, pred_home, pred_away, points')
      .eq('season_id', seasonId)
      .eq('user_id', participant.id)
      .in('match_id', matchIds)

    return Object.fromEntries((data || []).map((p) => [p.match_id, p]))
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1100 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Tippvergleich...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1100 }}>
        <Link href="/duelle" style={backLinkStyle}>
          ← Zurück zu den Duellen
        </Link>

        {message ? (
          <div style={infoBoxStyle}>{message}</div>
        ) : (
          <>
            <section
              style={{
                ...duelHeaderStyle,
                padding: isMobile ? 16 : 22,
                gap: isMobile ? 8 : 14,
              }}
            >
              <TeamHeader team={homeTeam} />

              <div style={{ textAlign: 'center', minWidth: 0 }}>
                <div
                  style={{
                    ...scoreStyle,
                    minWidth: isMobile ? 92 : 112,
                    fontSize: isMobile ? 20 : 24,
                    padding: isMobile ? '10px 12px' : '12px 16px',
                  }}
                >
                  {duel?.home_tip_points ?? '-'} : {duel?.away_tip_points ?? '-'}
                </div>

                <div style={subtitleStyle}>
                  Champions League · {getClMatchdayLabel(duel?.matchday, duel?.phase)}
                </div>
              </div>

              <TeamHeader team={awayTeam} alignRight />
            </section>

            {!isMobile && (
              <section className="card" style={{ overflowX: 'auto' }}>
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
                          <strong>{row.home_team_name}</strong>
                          <span style={{ color: '#64748b' }}> - </span>
                          <strong>{row.away_team_name}</strong>
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
              </section>
            )}

            {isMobile && (
              <div style={{ display: 'grid', gap: 14 }}>
                {rows.map((row) => (
                  <MobileTipCompareCard
                    key={row.match_id}
                    row={row}
                    homeTeamName={homeTeam?.name ?? 'Heim'}
                    awayTeamName={awayTeam?.name ?? 'Auswärts'}
                  />
                ))}
              </div>
            )}
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
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignRight ? 'flex-end' : 'flex-start',
        gap: 8,
        textAlign: alignRight ? 'right' : 'left',
      }}
    >
      {team?.logo_url && (
        <img src={team.logo_url} alt="" style={logoStyle} />
      )}

      <strong style={teamNameStyle}>{team?.name ?? 'Team'}</strong>
    </div>
  )
}

function MobileTipCompareCard({
  row,
  homeTeamName,
  awayTeamName,
}: {
  row: TipRow
  homeTeamName: string
  awayTeamName: string
}) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: 'linear-gradient(135deg, #ffffff, #eef4ff)',
      }}
    >
      <div
        style={{
          fontWeight: 900,
          color: '#0f172a',
          marginBottom: 14,
          lineHeight: 1.3,
          textAlign: 'center',
          fontSize: 18,
        }}
      >
        {row.home_team_name} - {row.away_team_name}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 64px 1fr',
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        <MiniCompareBox
          label={homeTeamName}
          tip={`${row.home_pred_home ?? '-'}:${row.home_pred_away ?? '-'}`}
          points={row.home_points}
        />

        <div
          style={{
            borderRadius: 16,
            background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
            color: 'white',
            textAlign: 'center',
            fontWeight: 950,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
          }}
        >
          {row.home_goals ?? '-'}:{row.away_goals ?? '-'}
        </div>

        <MiniCompareBox
          label={awayTeamName}
          tip={`${row.away_pred_home ?? '-'}:${row.away_pred_away ?? '-'}`}
          points={row.away_points}
        />
      </div>
    </div>
  )
}

function MiniCompareBox({
  label,
  tip,
  points,
}: {
  label: string
  tip: string
  points: number | null
}) {
  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 16,
        padding: 10,
        background: '#eff6ff',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#64748b',
          fontWeight: 900,
          lineHeight: 1.15,
          marginBottom: 8,
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 950,
          color: '#0f172a',
        }}
      >
        {tip}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: 950,
          color: '#2563eb',
        }}
      >
        {points ?? '-'} Pkt
      </div>
    </div>
  )
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginBottom: 18,
  color: '#0f172a',
  fontWeight: 900,
  textDecoration: 'none',
}

const duelHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  border: '2px solid #2563eb',
  borderRadius: 24,
  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
  boxShadow: '0 16px 34px rgba(37,99,235,0.18)',
  marginBottom: 24,
}

const logoStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  objectFit: 'contain',
}

const teamNameStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.15,
  color: '#0f172a',
  overflowWrap: 'anywhere',
  fontWeight: 900,
}

const scoreStyle: React.CSSProperties = {
  borderRadius: 22,
  background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
  color: 'white',
  fontWeight: 950,
  boxShadow: '0 14px 28px rgba(37,99,235,0.22)',
}

const subtitleStyle: React.CSSProperties = {
  marginTop: 8,
  color: '#1d4ed8',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.2,
}

const infoBoxStyle: React.CSSProperties = {
  padding: 22,
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  background: 'white',
  fontWeight: 800,
  color: '#475569',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  minWidth: 760,
  background: 'white',
}

const thStyle: React.CSSProperties = {
  padding: '14px 12px',
  textAlign: 'left',
  background: '#1e3a8a',
  color: 'white',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.14)',
}

const tdStyle: React.CSSProperties = {
  padding: '13px 12px',
  borderRight: '1px solid #e2e8f0',
  borderBottom: '1px solid #e2e8f0',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

const centerTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  fontWeight: 800,
}

const pointsTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  fontWeight: 950,
  color: '#1d4ed8',
}