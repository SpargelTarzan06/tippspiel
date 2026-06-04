'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import NavBar from '../components/NavBar'

const rightGridColumns = '42px 52px 62px 108px 40px 40px 40px 46px'

export default function Home() {
  const [table, setTable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
    async function load() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        window.location.href = '/login'
        return
      }

      const { data: tableData } = await supabase
        .from('active_standings_with_movement')
        .select('*')
        .order('rank')

      const { data: trainerData } = await supabase
        .from('active_team_trainers')
        .select('team_id, trainer_name')

      const trainerMap = Object.fromEntries(
        (trainerData || []).map((row) => [
          row.team_id,
          row.trainer_name,
        ])
      )

      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, logo_url')

      const logoMap = Object.fromEntries(
        (teamsData || []).map((team) => [team.id, team.logo_url])
      )

      const mergedTable = (tableData || []).map((team) => ({
        ...team,
        logo_url: logoMap[team.team_id] ?? null,
        trainer_name: trainerMap[team.team_id] ?? '-',
      }))

      setTable(mergedTable)
      setLoading(false)
    }

    load()
  }, [])

  const getRowColor = (rank: number) => {
    if (rank === 1) return '#22c55e'
    if (rank >= 2 && rank <= 4) return '#21b42179'
    if (rank === 5) return '#a9c8f0'
    if (rank === 6) return '#b2a8dde0'
    if (rank === 16) return '#fef3c7'
    if (rank >= 17) return '#e45353c2'

    return '#ffffff'
  }

  const getZoneColor = (rank: number) => {
    if (rank === 1) return '#16a34a'
    if (rank >= 2 && rank <= 4) return '#22c55e'
    if (rank === 5) return '#2563eb'
    if (rank === 6) return '#7c3aed'
    if (rank === 16) return '#f59e0b'
    if (rank >= 17) return '#dc2626'

    return '#e2e8f0'
  }

  if (loading) {
    return (
      <>
        <NavBar />

        <main className="page-shell">
          <section className="card" style={{ padding: 28 }}>
            Lade Tabelle...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell">
        {!isMobile && (
          <section
            className="card"
            style={{
              overflowX: 'auto',
              borderRadius: 18,
              border: '1px solid #cbd5e1',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: 980,
                background: '#ffffff',
              }}
            >
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th style={headerStyle}>#</th>
                  <th style={headerStyle}>Form</th>
                  <th style={headerStyle}>Logo</th>
                  <th style={headerStyle}>Verein</th>
                  <th style={headerStyle}>Trainer</th>
                  <th style={headerStyle}>Sp</th>
                  <th style={headerStyle}>S</th>
                  <th style={headerStyle}>U</th>
                  <th style={headerStyle}>N</th>
                  <th style={headerStyle}>Pkt</th>
                  <th style={headerStyle}>Diff</th>
                  <th style={headerStyle}>SP</th>
                </tr>
              </thead>

              <tbody>
                {table.map((team) => (
                  <tr
                    key={team.team_id}
                    style={{
                      background: getRowColor(team.rank),
                    }}
                  >
                    <td style={{ ...cellStyle, fontWeight: 900 }}>
                      {team.rank}
                    </td>

                    <td style={cellStyle}>
                      {renderMovement(team.rank_change)}
                    </td>

                    <td style={cellStyle}>
                      {team.logo_url && (
                        <img
                          src={team.logo_url}
                          alt=""
                          style={{
                            width: 34,
                            height: 34,
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto',
                          }}
                        />
                      )}
                    </td>

                    <td style={cellStyle}>
                      <Link
                        href={`/team/${team.team_id}`}
                        style={{
                          textDecoration: 'none',
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: 15,
                        }}
                      >
                        {team.team_name}
                      </Link>
                    </td>

                    <td style={{ ...cellStyle, color: '#334155', fontWeight: 600 }}>
                      {team.trainer_name}
                    </td>

                    <td style={cellStyle}>{team.matches_played}</td>
                    <td style={cellStyle}>{team.wins}</td>
                    <td style={cellStyle}>{team.draws}</td>
                    <td style={cellStyle}>{team.losses}</td>

<td
  style={{
    ...cellStyle,
    fontWeight: 950,
    fontSize: 20,
    color: '#0f172a',
  }}
>
  {team.points}
</td>
<td
  style={{
    ...cellStyle,
    fontWeight: 900,
    color:
      team.goal_difference > 0
        ? '#16a34a'
        : team.goal_difference < 0
        ? '#dc2626'
        : '#64748b',
  }}
>
  {team.goal_difference > 0 ? '+' : ''}
  {team.goal_difference}
</td>

                    <td
                      style={{
                        ...cellStyle,
                        fontWeight: 900,
                        color:
                          (team.special_points ?? 0) > 0
                            ? '#7c3aed'
                            : '#475569',
                      }}
                    >
                      {team.special_points ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {isMobile && (
          <section
            className="card"
            style={{
              overflow: 'hidden',
              borderRadius: 18,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '164px 1fr',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 28px 1fr',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    borderRight: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  <div style={mobileHeadCell}>#</div>
                  <div style={mobileHeadCell}>↕</div>
                  <div style={{ ...mobileHeadCell, textAlign: 'left' }}>
                    Verein
                  </div>
                </div>

                {table.map((team) => (
                  <div
                    key={team.team_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 28px 1fr',
                      minHeight: 42,
                      alignItems: 'center',
                      borderRight: '1px solid #dbe3ef',
                      borderBottom: '1px solid #dbe3ef',
                      position: 'relative',
                      background: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background: getZoneColor(team.rank),
                      }}
                    />

                    <div
                      style={{
                        ...mobileCell,
                        fontWeight: 950,
                        paddingLeft: 6,
                      }}
                    >
                      {team.rank}
                    </div>

                    <div style={mobileCell}>
                      {renderMobileMovement(team.rank_change)}
                    </div>

                    <Link
                      href={`/team/${team.team_id}`}
                      style={{
                        minWidth: 0,
                        padding: '7px 5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#0f172a',
                        textDecoration: 'none',
                        overflow: 'hidden',
                      }}
                    >
                      {team.logo_url && (
                        <img
                          src={team.logo_url}
                          alt=""
                          style={{
                            width: 17,
                            height: 17,
                            objectFit: 'contain',
                            flexShrink: 0,
                          }}
                        />
                      )}

                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 11.5,
                          fontWeight: 900,
                        }}
                      >
                        {getShortTeamName(team.team_name)}
                      </span>
                    </Link>
                  </div>
                ))}
              </div>

              <div
                style={{
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                }}
              >
                <div style={{ minWidth: 430 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: rightGridColumns,
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                    }}
                  >
                    <div style={mobileHeadCell}>Sp</div>
                    <div style={mobileHeadCell}>Diff</div>
                    <div style={mobileHeadCell}>Pkt</div>
                    <div style={mobileHeadCell}>Trainer</div>
                    <div style={mobileHeadCell}>S</div>
                    <div style={mobileHeadCell}>U</div>
                    <div style={mobileHeadCell}>N</div>
                    <div style={mobileHeadCell}>SP</div>
                  </div>

                  {table.map((team) => (
                    <div
                      key={team.team_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: rightGridColumns,
                        minHeight: 42,
                        borderBottom: '1px solid #dbe3ef',
                        background: '#ffffff',
                      }}
                    >
                      <MobileStat value={team.matches_played} />
                      <MobileStat
                        value={`${team.goal_difference > 0 ? '+' : ''}${team.goal_difference}`}
                        positive={team.goal_difference > 0}
                        negative={team.goal_difference < 0}
                      />
                      <MobileStat value={team.points} points />
                      <MobileStat value={getShortTrainerName(team.trainer_name)} />
                      <MobileStat value={team.wins} />
                      <MobileStat value={team.draws} />
                      <MobileStat value={team.losses} />
                      <MobileStat
                        value={team.special_points ?? 0}
                        special={(team.special_points ?? 0) > 0}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  )
}

function MobileStat({
  value,
  points,
  muted,
  special,
  positive,
  negative,
}: {
  value: any
  points?: boolean
  muted?: boolean
  special?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div
      style={{
        minHeight: 42,
        padding: '8px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        borderLeft: points ? '2px solid #16a34a' : undefined,
        borderRight: points ? '2px solid #16a34a' : '1px solid #dbe3ef',
        fontSize: points ? 15 : 11,
        fontWeight: points ? 950 : 800,
color: special
  ? '#7c3aed'
  : positive
  ? '#16a34a'
  : negative
  ? '#dc2626'
  : muted
  ? '#94a3b8'
  : '#0f172a',
        background: points ? '#ecfdf5' : 'transparent',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </div>
  )
}

function getShortTeamName(name: string) {
  const map: Record<string, string> = {
    'Bayer 04 Leverkusen': 'Leverkusen',
    '1. FSV Mainz 05': 'Mainz',
    'Hamburger SV': 'HSV',
    '1. FC Heidenheim': 'Heidenheim',
    '1. FC Köln': 'Köln',
    '1. FC Union Berlin': 'Union',
    'FC St. Pauli': 'St. Pauli',
    'RB Leipzig': 'Leipzig',
    'VfB Stuttgart': 'Stuttgart',
    'VfL Wolfsburg': 'Wolfsburg',
    'Werder Bremen': 'Bremen',
    'Bayern München': 'Bayern',
    'Borussia Dortmund': 'Dortmund',
    'Borussia Mönchengladbach': "M'Gladbach",
    'SC Freiburg': 'Freiburg',
    'FC Augsburg': 'Augsburg',
    'Eintracht Frankfurt': 'Frankfurt',
    'TSG Hoffenheim': 'Hoffenheim',
    'FC Schalke 04': 'Schalke',
    'SV Elversberg': 'Elversberg',
    'SC Paderborn 07': 'Paderborn',
  }

  return map[name] ?? name
}

function getShortTrainerName(name: string) {
  if (!name || name === '-') return '-'

  const parts = name.trim().split(' ').filter(Boolean)

  if (parts.length === 1) {
    return parts[0]
  }

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]

  return `${firstName.charAt(0)}.${lastName}`
}

function renderMovement(rankChange: number) {
  if (rankChange > 0) {
    return <span style={{ color: '#16a34a', fontWeight: 900 }}>↑ {rankChange}</span>
  }

  if (rankChange < 0) {
    return <span style={{ color: '#dc2626', fontWeight: 900 }}>↓ {Math.abs(rankChange)}</span>
  }

  return <span style={{ color: '#94a3b8', fontWeight: 900 }}>–</span>
}

function renderMobileMovement(rankChange: number) {
  if (rankChange > 0) {
    return <span style={{ color: '#16a34a', fontWeight: 950 }}>↑{rankChange}</span>
  }

  if (rankChange < 0) {
    return <span style={{ color: '#dc2626', fontWeight: 950 }}>↓{Math.abs(rankChange)}</span>
  }

  return <span style={{ color: '#94a3b8', fontWeight: 950 }}>–</span>
}

const headerStyle: React.CSSProperties = {
  padding: '13px 10px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.16)',
}

const cellStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: 13,
  borderRight: '1px solid #dbe3ef',
  borderBottom: '1px solid #dbe3ef',
  whiteSpace: 'nowrap',
}

const mobileHeadCell: React.CSSProperties = {
  padding: '9px 5px',
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,0.22)',
  whiteSpace: 'nowrap',
}

const mobileCell: React.CSSProperties = {
  padding: '8px 3px',
  textAlign: 'center',
  fontSize: 11.5,
  color: '#0f172a',
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}