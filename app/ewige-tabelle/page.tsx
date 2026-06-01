'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

type TeamRow = {
  team_id: string
  team_name: string
  matches_played: number
  wins: number
  draws: number
  losses: number
  points: number
  goal_difference: number
  tip_points_for: number
  tip_points_against: number
}

type PlayerRow = {
  user_id: string
  display_name: string
  seasons_played: number
  matches_played: number
  wins: number
  draws: number
  losses: number
  points: number
  goal_difference: number
  tip_points_for: number
  tip_points_against: number
}

export default function EwigeTabellePage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams')
  const [teamRows, setTeamRows] = useState<TeamRow[]>([])
  const [playerRows, setPlayerRows] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: teamsData } = await supabase
      .from('all_time_team_table')
      .select('*')
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })

    const { data: playersData } = await supabase
      .from('all_time_player_table')
      .select('*')
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })

    setTeamRows(teamsData || [])
    setPlayerRows(playersData || [])
    setLoading(false)
  }

  const podiumRows = activeTab === 'teams' ? teamRows.slice(0, 3) : playerRows.slice(0, 3)

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1150 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>🏆 Ewige Tabelle</div>

            <h1 style={titleStyle}>Alle Zeiten</h1>

            <div style={tabRowStyle}>
              <TabButton
                active={activeTab === 'teams'}
                onClick={() => setActiveTab('teams')}
              >
                ⚽ Mannschaften
              </TabButton>

              <TabButton
                active={activeTab === 'players'}
                onClick={() => setActiveTab('players')}
              >
                👤 Spieler
              </TabButton>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="card" style={{ padding: 28 }}>
            Lade ewige Tabelle...
          </section>
        ) : (
          <>
            <Podium rows={podiumRows} activeTab={activeTab} />

            {activeTab === 'teams' ? (
              <TeamTable rows={teamRows} />
            ) : (
              <PlayerTable rows={playerRows} />
            )}
          </>
        )}
      </main>
    </>
  )
}

function Podium({
  rows,
  activeTab,
}: {
  rows: any[]
  activeTab: 'teams' | 'players'
}) {
  if (rows.length === 0) return null

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={podiumGridStyle}>
      {rows.map((row, index) => (
        <div key={activeTab === 'teams' ? row.team_id : row.user_id} style={podiumCardStyle}>
          <div style={podiumMedalStyle}>{medals[index]}</div>

          <div style={podiumNameStyle}>
            {activeTab === 'teams'
              ? shortTeamName(row.team_name)
              : row.display_name}
          </div>

          <div style={podiumPointsStyle}>{row.points} Pkt</div>
        </div>
      ))}
    </div>
  )
}
function TeamTable({ rows }: { rows: TeamRow[] }) {
  if (rows.length === 0) return <InfoCard text="Keine Daten vorhanden." />

  return (
    <StickyStatsTable
      rows={rows}
      type="teams"
    />
  )
}

function PlayerTable({ rows }: { rows: PlayerRow[] }) {
  if (rows.length === 0) return <InfoCard text="Keine Daten vorhanden." />

  return (
    <StickyStatsTable
      rows={rows}
      type="players"
    />
  )
}
function StickyStatsTable({
  rows,
  type,
}: {
  rows: any[]
  type: 'teams' | 'players'
}) {
  const leftWidth = type === 'teams' ? 170 : 180
  const rightGridColumns =
    type === 'teams'
      ? '52px 42px 42px 42px 56px 64px 76px'
      : '64px 52px 42px 42px 42px 56px 64px 76px'

  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: '100%' }}>
        <div
          style={{
            width: leftWidth,
            flexShrink: 0,
            background: '#ffffff',
            boxShadow: '8px 0 18px rgba(15,23,42,0.08)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr',
              background: '#0f172a',
              color: 'white',
              minHeight: 44,
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 950,
            }}
          >
            <div style={{ paddingLeft: 10 }}>#</div>
            <div>{type === 'teams' ? 'Verein' : 'Spieler'}</div>
          </div>

          {rows.map((row, index) => (
            <div
              key={type === 'teams' ? row.team_id : row.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr',
                minHeight: 48,
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                background: index < 3 ? '#f0fdf4' : '#ffffff',
              }}
            >
              <div
                style={{
                  paddingLeft: 10,
                  fontWeight: 950,
                  color: '#0f172a',
                }}
              >
                {index + 1}
              </div>

              <div
                style={{
                  minWidth: 0,
                  fontWeight: 950,
                  color: '#0f172a',
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  paddingRight: 8,
                }}
              >
                {type === 'teams'
                  ? shortTeamName(row.team_name)
                  : shortPlayerName(row.display_name)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ minWidth: type === 'teams' ? 434 : 498 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: rightGridColumns,
                background: '#0f172a',
                color: 'white',
                minHeight: 44,
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 950,
              }}
            >
              {type === 'players' && <HeaderCell>Saisons</HeaderCell>}
              <HeaderCell>Sp</HeaderCell>
              <HeaderCell>S</HeaderCell>
              <HeaderCell>U</HeaderCell>
              <HeaderCell>N</HeaderCell>
              <HeaderCell>Pkt</HeaderCell>
              <HeaderCell>Diff</HeaderCell>
              <HeaderCell>Tipp</HeaderCell>
            </div>

            {rows.map((row, index) => (
              <div
                key={type === 'teams' ? row.team_id : row.user_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: rightGridColumns,
                  minHeight: 48,
                  alignItems: 'center',
                  borderBottom: '1px solid #e2e8f0',
                  background: index < 3 ? '#f0fdf4' : '#ffffff',
                }}
              >
                {type === 'players' && (
                  <StatCell>{row.seasons_played}</StatCell>
                )}

                <StatCell>{row.matches_played}</StatCell>
                <StatCell>{row.wins}</StatCell>
                <StatCell>{row.draws}</StatCell>
                <StatCell>{row.losses}</StatCell>

                <StatCell points>{row.points}</StatCell>

                <StatCell
                  color={
                    row.goal_difference > 0
                      ? '#16a34a'
                      : row.goal_difference < 0
                      ? '#dc2626'
                      : '#64748b'
                  }
                >
                  {formatDiff(row.goal_difference)}
                </StatCell>

                <StatCell>{row.tip_points_for}</StatCell>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '0 6px',
        borderLeft: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {children}
    </div>
  )
}

function StatCell({
  children,
  points,
  color,
}: {
  children: React.ReactNode
  points?: boolean
  color?: string
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '0 6px',
        fontWeight: points ? 950 : 850,
        fontSize: points ? 18 : 13,
        color: color ?? '#0f172a',
        borderLeft: '1px solid #eef2f7',
      }}
    >
      {children}
    </div>
  )
}

function shortPlayerName(name?: string) {
  if (!name) return '-'

  const parts = name.trim().split(' ').filter(Boolean)

  if (parts.length === 1) return parts[0]

  return `${parts[0].charAt(0)}.${parts[parts.length - 1]}`
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 16px',
        borderRadius: 999,
        border: active ? '0' : '1px solid rgba(255,255,255,0.28)',
        background: active ? '#ffffff' : 'rgba(255,255,255,0.12)',
        color: active ? '#052e16' : 'white',
        cursor: 'pointer',
        fontWeight: 950,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 850 }}>
      {text}
    </div>
  )
}

function formatDiff(value: number) {
  return `${value > 0 ? '+' : ''}${value}`
}

function diffStyle(value: number): React.CSSProperties {
  return {
    ...tdCenterStyle,
    fontWeight: 950,
    color:
      value > 0
        ? '#16a34a'
        : value < 0
        ? '#dc2626'
        : '#64748b',
  }
}

function shortTeamName(name: string) {
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
  }

  return map[name] ?? name
}

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 26,
  marginBottom: 24,
  background: 'linear-gradient(135deg,#052e16,#166534)',
  color: 'white',
  boxShadow: '0 18px 45px rgba(15,23,42,0.12)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -100,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  fontWeight: 950,
  fontSize: 12,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1,
  fontWeight: 950,
}

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 22,
}

const podiumGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
  marginBottom: 18,
}

const podiumCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 16,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
}

const podiumMedalStyle: React.CSSProperties = {
  fontSize: 28,
}

const podiumNameStyle: React.CSSProperties = {
  marginTop: 8,
  color: '#0f172a',
  fontWeight: 950,
  fontSize: 17,
}

const podiumPointsStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#166534',
  fontWeight: 950,
  fontSize: 22,
}

const tableScrollStyle: React.CSSProperties = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 760,
  borderCollapse: 'separate',
  borderSpacing: 0,
  background: '#ffffff',
}

const headRowStyle: React.CSSProperties = {
  background: '#0f172a',
  color: 'white',
}

const thStyle: React.CSSProperties = {
  padding: '13px 10px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 950,
  borderRight: '1px solid rgba(255,255,255,0.16)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 10px',
  fontSize: 13,
  color: '#0f172a',
  borderRight: '1px solid #eef2f7',
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
}

const tdCenterStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
}

const pointsCellStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  fontWeight: 950,
  fontSize: 18,
  color: '#0f172a',
}