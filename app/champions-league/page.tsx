'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

type Tab = 'preliminary' | 'main' | 'knockout'

export default function ChampionsLeaguePage() {
  const [activeTab, setActiveTab] = useState<Tab>('preliminary')
  const [preliminaryGroups, setPreliminaryGroups] = useState<any[]>([])
  const [mainGroups, setMainGroups] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setLoading(false)
      return
    }

    const seasonId = seasonData.id

    const { data: preliminaryData } = await supabase
      .from('active_cl_group_table')
      .select('*')
      .eq('phase', 'preliminary')
      .order('group_name')
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })

    setPreliminaryGroups(groupRows(preliminaryData || []))

    const { data: mainData } = await supabase
      .from('active_cl_group_table')
      .select('*')
      .eq('phase', 'main')
      .order('group_name')
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })

    setMainGroups(groupRows(mainData || []))

    const { data: matchData } = await supabase
      .from('cl_matches')
      .select(`
        *,
        home_team:teams!cl_matches_home_team_id_fkey(name),
        away_team:teams!cl_matches_away_team_id_fkey(name),
        winner_team:teams!cl_matches_winner_team_id_fkey(name)
      `)
      .eq('season_id', seasonId)
      .order('matchday')
      .order('created_at')

    setMatches(matchData || [])
    setLoading(false)
  }

  function groupRows(rows: any[]) {
    return Object.values(
      rows.reduce((acc: any, row: any) => {
        if (!acc[row.group_name]) {
          acc[row.group_name] = {
            name: row.group_name,
            standings: [],
          }
        }

        acc[row.group_name].standings.push(row)
        return acc
      }, {})
    )
  }

  const preliminaryMatches = matches.filter((m) => m.phase === 'preliminary')
  const mainMatches = matches.filter((m) => m.phase === 'main')
  const knockoutMatches = matches.filter(
    (m) => m.phase === 'semifinal' || m.phase === 'final'
  )

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell">
          <section className="card" style={{ padding: 28 }}>
            Lade Champions League...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell">
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>🏆 Champions League</div>

            <h1 style={titleStyle}>Königsklasse</h1>

            <p style={subtitleStyle}>
              Gruppenphase, Hauptrunde und K.-o.-Duelle im Überblick.
            </p>

            <div style={tabRowStyle}>
              <TabButton
                active={activeTab === 'preliminary'}
                onClick={() => setActiveTab('preliminary')}
              >
                Vorrunde
              </TabButton>

              <TabButton
                active={activeTab === 'main'}
                onClick={() => setActiveTab('main')}
              >
                Hauptrunde
              </TabButton>

              <TabButton
                active={activeTab === 'knockout'}
                onClick={() => setActiveTab('knockout')}
              >
                K.-o.-Runde
              </TabButton>
            </div>
          </div>
        </section>

        {activeTab === 'preliminary' && (
          <>
            <SectionTitle title="Vorrunde" />
            <GroupGrid groups={preliminaryGroups} highlightTop={3} />

<MatchdayList
  key="preliminary-round"
  title="Spiele"
  matches={preliminaryMatches}
  startMatchday={7}
  endMatchday={16}
  groups={preliminaryGroups}
/>
          </>
        )}

        {activeTab === 'main' && (
          <>
            <SectionTitle title="Hauptrunde" />
            <GroupGrid groups={mainGroups} highlightTop={2} />

<MatchdayList
  key="main-round"
  title="Spiele"
  matches={mainMatches}
  startMatchday={17}
  endMatchday={26}
  groups={mainGroups}
/>
          </>
        )}

        {activeTab === 'knockout' && (
          <>
            <SectionTitle title="K.-o.-Runde" />
            <TournamentBracket matches={knockoutMatches} />
          </>
        )}
      </main>
    </>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 style={sectionTitleStyle}>{title}</h2>
}

function GroupGrid({
  groups,
  highlightTop,
}: {
  groups: any[]
  highlightTop: number
}) {
  return (
    <div style={groupGridStyle}>
      {groups.map((group: any) => (
        <section key={group.name} className="card" style={{ overflow: 'hidden' }}>
          <div style={groupHeaderStyle}>{group.name}</div>

          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Sp</th>
                <th style={thStyle}>Pkt</th>
                <th style={thStyle}>Diff</th>
              </tr>
            </thead>

            <tbody>
              {group.standings.map((team: any, index: number) => {
                const rank = index + 1
                const zoneColor =
                  rank <= highlightTop
                    ? '#16a34a'
                    : rank === highlightTop + 1
                    ? '#f59e0b'
                    : '#e2e8f0'

                return (
                  <tr key={team.team_id}>
                    <td style={{ ...tdStyle, fontWeight: 950 }}>
                      <span style={{ ...rankBarStyle, background: zoneColor }} />
                      {rank}
                    </td>

                    <td style={{ ...tdStyle, fontWeight: 900 }}>
                      {shortTeamName(team.team_name)}
                    </td>

                    <td style={tdStyle}>{team.matches_played}</td>

                    <td style={{ ...tdStyle, fontSize: 18, fontWeight: 950 }}>
                      {team.points}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

function MatchdayList({
  title,
  matches,
  startMatchday,
  endMatchday,
  groups,
}: {
  title: string
  matches: any[]
  startMatchday: number
  endMatchday: number
  groups: any[]
}) {
  const availableMatchdays = Array.from(
    new Set(
      matches
        .filter((m) => m.matchday >= startMatchday && m.matchday <= endMatchday)
        .map((m) => m.matchday)
    )
  ).sort((a, b) => a - b)

  const [selectedMatchday, setSelectedMatchday] = useState<number>(
    availableMatchdays[0] ?? startMatchday
  )

  useEffect(() => {
    if (
      availableMatchdays.length > 0 &&
      !availableMatchdays.includes(selectedMatchday)
    ) {
      setSelectedMatchday(availableMatchdays[0])
    }
  }, [matches])

  const selectedMatches = matches.filter((m) => m.matchday === selectedMatchday)
  const phase = selectedMatches[0]?.phase ?? matches[0]?.phase ?? 'preliminary'

  const groupedMatches = groupMatchesByGroup(selectedMatches, groups)

  return (
    <section style={{ marginTop: 30 }}>
      <div style={matchdayHeaderStyle}>
        <h3 style={{ margin: 0 }}>{title}</h3>

        {availableMatchdays.length > 0 && (
          <select
            value={selectedMatchday}
            onChange={(e) => setSelectedMatchday(Number(e.target.value))}
            style={selectStyle}
          >
            {availableMatchdays.map((day) => {
              const dayPhase = matches.find((m) => m.matchday === day)?.phase ?? phase

              return (
                <option key={day} value={day}>
                  {getClMatchdayLabel(day, dayPhase)}
                </option>
              )
            })}
          </select>
        )}
      </div>

      {availableMatchdays.length === 0 ? (
        <InfoCard text="Noch keine Spiele angelegt." />
      ) : (
        <section className="card" style={{ padding: 16 }}>
          <div style={matchdayTitleStyle}>
            {getClMatchdayLabel(selectedMatchday, phase)}
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {Object.entries(groupedMatches).map(([group, groupMatches]) => (
              <div
                key={group}
                className="card"
                style={{
                  overflow: 'hidden',
                  border: '1px solid #dbeafe',
                }}
              >
                <div style={groupMatchHeaderStyle}>{group}</div>

                <div
                  style={{
                    padding: 12,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  {(groupMatches as any[]).map((match) => (
                    <MatchRow key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}

function MatchRow({ match }: { match: any }) {
  return (
    <div style={matchRowStyle}>
      <TeamName name={shortTeamName(match.home_team?.name)} />

      <div style={scoreBoxStyle}>
        {match.finished ? `${match.home_tip_points}:${match.away_tip_points}` : '-:-'}
      </div>

      <TeamName name={shortTeamName(match.away_team?.name)} alignRight />
    </div>
  )
}

function TeamName({ name, alignRight }: { name?: string; alignRight?: boolean }) {
  return (
    <div
      style={{
        minWidth: 0,
        textAlign: alignRight ? 'right' : 'left',
        fontWeight: 900,
        color: '#0f172a',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {name ?? 'Team'}
    </div>
  )
}

function TournamentBracket({ matches }: { matches: any[] }) {
  const semifinals = groupSeries(matches.filter((m) => m.phase === 'semifinal'))
  const finals = groupSeries(matches.filter((m) => m.phase === 'final'))

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <div style={bracketGridStyle}>
        {semifinals.map((serie: any, index: number) => (
          <BracketCard
            key={serie.key}
            title={`Halbfinale ${index + 1}`}
            serie={serie}
            neededWins={3}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          {finals.map((serie: any) => (
            <BracketCard
              key={serie.key}
              title="Finale"
              serie={serie}
              neededWins={2}
              final
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BracketCard({
  title,
  serie,
  neededWins,
  final,
}: {
  title: string
  serie: any
  neededWins: number
  final?: boolean
}) {
  const winner =
    serie.homeWins >= neededWins
      ? serie.home
      : serie.awayWins >= neededWins
      ? serie.away
      : null

  return (
    <section
      className="card"
      style={{
        padding: 18,
        border: final ? '2px solid #2563eb' : '1px solid #e2e8f0',
        background: final
          ? 'linear-gradient(135deg, #eff6ff, #ffffff)'
          : '#ffffff',
      }}
    >
      <div style={bracketTitleStyle}>{title}</div>

      <div style={seriesHeaderStyle}>
        <strong>{shortTeamName(serie.home)}</strong>

        <strong style={seriesScoreStyle}>
          {serie.homeWins}:{serie.awayWins}
        </strong>

        <strong style={{ textAlign: 'right' }}>{shortTeamName(serie.away)}</strong>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {serie.matches.map((match: any) => {
          const homeWon = match.winner_team?.name === match.home_team?.name
          const awayWon = match.winner_team?.name === match.away_team?.name

          return (
            <div key={match.id} style={bracketMatchStyle}>
              <span
                style={{
                  fontWeight: homeWon ? 950 : 700,
                  color: homeWon ? '#16a34a' : '#334155',
                }}
              >
                {shortTeamName(match.home_team?.name)}
              </span>

              <strong>
                {match.home_tip_points}:{match.away_tip_points}
              </strong>

              <span
                style={{
                  textAlign: 'right',
                  fontWeight: awayWon ? 950 : 700,
                  color: awayWon ? '#16a34a' : '#334155',
                }}
              >
                {shortTeamName(match.away_team?.name)}
              </span>
            </div>
          )
        })}
      </div>

      {winner && <div style={winnerStyle}>Sieger: {shortTeamName(winner)}</div>}
    </section>
  )
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
        color: active ? '#172554' : 'white',
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
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 800 }}>
      {text}
    </div>
  )
}

function groupMatchesByGroup(matches: any[], groups: any[]) {
  const teamToGroup = new Map<string, string>()

  for (const group of groups) {
    for (const row of group.standings || []) {
      if (row.team_name) {
        teamToGroup.set(row.team_name, group.name)
      }
    }
  }

  return matches.reduce((acc, match) => {
    const group =
      match.group_name ??
      teamToGroup.get(match.home_team?.name) ??
      teamToGroup.get(match.away_team?.name) ??
      'Ohne Gruppe'

    if (!acc[group]) {
      acc[group] = []
    }

    acc[group].push(match)

    return acc
  }, {} as Record<string, any[]>)
}

function shortTeamName(name?: string) {
  if (!name) return ''

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

function getClMatchdayLabel(matchday: number, phase: string) {
  if (phase === 'preliminary') return `Vorrunde ${matchday - 6}. Spieltag`
  if (phase === 'main') return `Hauptrunde ${matchday - 16}. Spieltag`
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return `CL-Spieltag ${matchday}`
}

function groupSeries(matches: any[]) {
  const map: Record<string, any> = {}

  for (const match of matches) {
    const key = `${match.home_team?.name}-${match.away_team?.name}`

    if (!map[key]) {
      map[key] = {
        key,
        home: match.home_team?.name,
        away: match.away_team?.name,
        homeWins: 0,
        awayWins: 0,
        matches: [],
      }
    }

    map[key].matches.push(match)

    if (match.winner_team_id) {
      if (match.winner_team?.name === match.home_team?.name) {
        map[key].homeWins += 1
      }

      if (match.winner_team?.name === match.away_team?.name) {
        map[key].awayWins += 1
      }
    }
  }

  return Object.values(map)
}

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 26,
  marginBottom: 28,
  background: 'linear-gradient(135deg, #172554, #1d4ed8)',
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

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.13)',
  fontWeight: 950,
  fontSize: 12,
  marginBottom: 12,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  lineHeight: 1,
  fontWeight: 950,
}

const subtitleStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: '12px 0 0',
  color: 'rgba(255,255,255,0.82)',
  fontWeight: 700,
}

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 22,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '28px 0 14px',
  fontSize: 24,
  fontWeight: 950,
  color: '#0f172a',
}

const groupGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18,
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  marginBottom: 28,
}

const groupHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg, #eff6ff, #ffffff)',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 950,
  color: '#172554',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  background: 'white',
}

const thStyle: React.CSSProperties = {
  padding: '12px 8px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 950,
  borderRight: '1px solid rgba(255,255,255,0.16)',
}

const tdStyle: React.CSSProperties = {
  padding: '11px 8px',
  borderBottom: '1px solid #e2e8f0',
  borderRight: '1px solid #eef2f7',
  fontSize: 13,
  color: '#0f172a',
}

const rankBarStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 4,
  height: 22,
  borderRadius: 99,
  marginRight: 7,
  verticalAlign: 'middle',
}

const matchdayHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 14,
}

const selectStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  padding: '0 8px',
  background: 'white',
  fontWeight: 700,
  fontSize: 13,
  maxWidth: 200,
}

const matchdayTitleStyle: React.CSSProperties = {
  marginBottom: 14,
  fontWeight: 950,
  color: '#0f172a',
}

const groupMatchHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'linear-gradient(135deg,#172554,#1d4ed8)',
  color: 'white',
  fontWeight: 900,
  fontSize: 15,
}

const matchRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 10,
  alignItems: 'center',
  padding: 10,
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#ffffff',
}

const scoreBoxStyle: React.CSSProperties = {
  minWidth: 52,
  padding: '7px 9px',
  borderRadius: 12,
  background: '#0f172a',
  color: 'white',
  fontWeight: 950,
  textAlign: 'center',
}

const bracketGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 20,
  alignItems: 'start',
}

const bracketTitleStyle: React.CSSProperties = {
  marginBottom: 14,
  fontSize: 20,
  fontWeight: 950,
  color: '#172554',
}

const seriesHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 12,
  alignItems: 'center',
  marginBottom: 14,
}

const seriesScoreStyle: React.CSSProperties = {
  minWidth: 66,
  padding: '8px 12px',
  borderRadius: 14,
  background: '#0f172a',
  color: 'white',
  textAlign: 'center',
  fontSize: 20,
}

const bracketMatchStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 10,
  padding: 10,
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#f8fafc',
  alignItems: 'center',
}

const winnerStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  background: '#dcfce7',
  color: '#166534',
  fontWeight: 950,
  textAlign: 'center',
}