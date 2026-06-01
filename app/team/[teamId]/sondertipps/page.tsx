'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import NavBar from '../../../../components/NavBar'
import { supabase } from '../../../../lib/supabaseClient'

type Participant = {
  type: 'profile' | 'placeholder'
  id: string
  name: string
}

export default function TeamSondertippsPage() {
  const { teamId } = useParams()

  const [team, setTeam] = useState<any>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [teamId])

  async function load() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

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

    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .eq('id', teamId)
      .single()

    setTeam(teamData)

    const foundParticipant = await getParticipantForTeam(
      seasonData.id,
      String(teamId)
    )

    setParticipant(foundParticipant)

    if (!foundParticipant) {
      setMessage('Für dieses Team wurde kein Spieler gefunden.')
      setLoading(false)
      return
    }

    let query = supabase
      .from('special_bet_answers')
      .select(`
        id,
        answer_index,
        team_id,
        text_answer,
        number_answer,
        points,
        is_correct,
        special_bet_categories (
          name,
          answer_type,
          points_per_correct
        ),
        teams (
          name
        )
      `)
      .eq('season_id', seasonData.id)
      .order('answer_index')

    if (foundParticipant.type === 'profile') {
      query = query.eq('user_id', foundParticipant.id)
    } else {
      query = query.eq('placeholder_player_id', foundParticipant.id)
    }

    const { data, error } = await query

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setRows(data || [])
    setLoading(false)
  }

  async function getParticipantForTeam(
    seasonId: string,
    currentTeamId: string
  ): Promise<Participant | null> {
    const { data: placeholderAssignment } = await supabase
      .from('placeholder_team_assignments')
      .select('placeholder_player_id')
      .eq('season_id', seasonId)
      .eq('team_id', currentTeamId)
      .single()

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
      .eq('team_id', currentTeamId)
      .single()

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

  function getAnswerText(row: any) {
    const type = row.special_bet_categories?.answer_type

    if (type === 'team') {
      return row.teams?.name ?? 'Kein Team'
    }

    if (type === 'number') {
      return row.number_answer ?? '-'
    }

    return row.text_answer ?? '-'
  }

  function getStatus(row: any) {
    if (row.points === null || row.points === undefined) {
      return {
        label: '⏳ Noch offen',
        style: neutralStatusStyle,
      }
    }

    if (row.is_correct) {
      return {
        label: `✅ Richtig · +${row.points ?? 0} Punkte`,
        style: successStatusStyle,
      }
    }

    return {
      label: '❌ Falsch · 0 Punkte',
      style: dangerStatusStyle,
    }
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1000 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Sondertipps...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1000 }}>
        <Link href={`/team/${team?.id ?? teamId}`} style={backLinkStyle}>
          ← Zurück zum Team
        </Link>

        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={heroContentStyle}>
            <div style={teamIdentityStyle}>
              {team?.logo_url && (
                <div style={logoWrapStyle}>
                  <img src={team.logo_url} alt="" style={logoStyle} />
                </div>
              )}

              <div>
                <div style={eyebrowStyle}>🎯 Sondertipps</div>
                <h1 style={titleStyle}>{team?.name ?? 'Team'}</h1>

                {participant && (
                  <div style={seasonPillStyle}>
                    Tipps von: {participant.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div
            className="card"
            style={{
              padding: 16,
              marginBottom: 18,
              background: '#fff1f2',
              color: '#991b1b',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        {rows.length === 0 ? (
          <InfoCard text="Noch keine Sondertipps eingetragen." />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {rows.map((row) => {
              const status = getStatus(row)

              return (
                <section
                  key={row.id}
                  className="card"
                  style={{
                    overflow: 'hidden',
                    border:
                      row.is_correct === true
                        ? '1px solid #bbf7d0'
                        : row.is_correct === false
                        ? '1px solid #fecdd3'
                        : '1px solid #e2e8f0',
                  }}
                >
                  <div style={cardHeaderStyle}>
                    <div>
                      <div style={categoryEyebrowStyle}>
                        {getCategoryIcon(row.special_bet_categories?.answer_type)} Sondertipp
                      </div>

                      <h2 style={cardTitleStyle}>
                        {row.special_bet_categories?.name}
                        {row.answer_index > 1 ? ` · Tipp ${row.answer_index}` : ''}
                      </h2>
                    </div>

                    <div style={pointsPillStyle}>
                      {row.special_bet_categories?.points_per_correct ?? 0} Pkt möglich
                    </div>
                  </div>

                  <div style={answerBoxStyle}>
                    <div style={answerLabelStyle}>Abgegebener Tipp</div>
                    <div style={answerValueStyle}>{getAnswerText(row)}</div>
                  </div>

                  <div style={status.style}>{status.label}</div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 850 }}>
      {text}
    </div>
  )
}

function getCategoryIcon(type?: string) {
  if (type === 'team') return '🏆'
  if (type === 'number') return '🔢'
  return '✍️'
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginBottom: 16,
  textDecoration: 'none',
  color: '#0f172a',
  fontWeight: 900,
}

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 26,
  marginBottom: 24,
  background: 'linear-gradient(135deg, #052e16, #166534)',
  color: 'white',
  boxShadow: '0 18px 45px rgba(15,23,42,0.12)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -90,
  top: -100,
  width: 280,
  height: 280,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
}

const heroContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
}

const teamIdentityStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
}

const logoWrapStyle: React.CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 24,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.92)',
  flexShrink: 0,
}

const logoStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  objectFit: 'contain',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.13)',
  fontWeight: 950,
  fontSize: 12,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
}

const seasonPillStyle: React.CSSProperties = {
  marginTop: 12,
  color: 'rgba(255,255,255,0.84)',
  fontWeight: 850,
}

const cardHeaderStyle: React.CSSProperties = {
  padding: 18,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  borderBottom: '1px solid #e2e8f0',
  flexWrap: 'wrap',
}

const categoryEyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#166534',
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 21,
  fontWeight: 950,
}

const pointsPillStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#f1f5f9',
  color: '#334155',
  fontWeight: 950,
  fontSize: 13,
}

const answerBoxStyle: React.CSSProperties = {
  padding: 18,
  background: '#ffffff',
}

const answerLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 13,
  fontWeight: 850,
  marginBottom: 6,
}

const answerValueStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 950,
}

const neutralStatusStyle: React.CSSProperties = {
  margin: '0 18px 18px',
  padding: '10px 12px',
  borderRadius: 14,
  background: '#f1f5f9',
  color: '#475569',
  fontSize: 13,
  fontWeight: 850,
}

const successStatusStyle: React.CSSProperties = {
  margin: '0 18px 18px',
  padding: '10px 12px',
  borderRadius: 14,
  background: '#dcfce7',
  color: '#166534',
  fontSize: 13,
  fontWeight: 950,
}

const dangerStatusStyle: React.CSSProperties = {
  margin: '0 18px 18px',
  padding: '10px 12px',
  borderRadius: 14,
  background: '#fee2e2',
  color: '#991b1b',
  fontSize: 13,
  fontWeight: 950,
}