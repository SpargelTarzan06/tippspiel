'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

type Tab = 'bundesliga' | 'championsLeague'

export default function ArchivPage() {
  const [seasons, setSeasons] = useState<any[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('bundesliga')
  const [bundesligaTable, setBundesligaTable] = useState<any[]>([])
  const [clGroups, setClGroups] = useState<any[]>([])
  const [clMatches, setClMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    loadSeasons()
  }, [])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (selectedSeasonId) {
      loadArchive(selectedSeasonId)
    }
  }, [selectedSeasonId])

  async function loadSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('id, name')
      .order('name', { ascending: false })

    setSeasons(data || [])

    if (data && data.length > 0) {
      setSelectedSeasonId(data[0].id)
    }

    setLoading(false)
  }

  async function loadArchive(seasonId: string) {
    setLoading(true)

    const { data: tableData } = await supabase
      .from('season_team_results')
      .select(`
        *,
        team:teams!season_team_results_team_id_fkey(
          name,
          logo_url
        )
      `)
      .eq('season_id', seasonId)
      .order('bundesliga_rank', { ascending: true })

    setBundesligaTable(tableData || [])

    const { data: groupData } = await supabase
      .from('cl_group_standings')
      .select('*')
      .eq('season_id', seasonId)
      .order('phase')
      .order('group_name')
      .order('rank', { ascending: true })

    setClGroups(groupData || [])

    const { data: matchData } = await supabase
      .from('cl_matches')
      .select(`
        *,
        home_team:teams!cl_matches_home_team_id_fkey(name),
        away_team:teams!cl_matches_away_team_id_fkey(name),
        winner_team:teams!cl_matches_winner_team_id_fkey(name)
      `)
      .eq('season_id', seasonId)
      .in('phase', ['semifinal', 'final'])
      .order('matchday', { ascending: true })

    setClMatches(matchData || [])
    setLoading(false)
  }

  const semifinals = clMatches.filter((m) => m.phase === 'semifinal')
  const finals = clMatches.filter((m) => m.phase === 'final')
  const selectedSeasonName =
    seasons.find((season) => season.id === selectedSeasonId)?.name ?? 'Saison'

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1180 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>📚 Archiv</div>
            <h1 style={titleStyle}>{selectedSeasonName}</h1>

            <div style={heroControlsStyle}>
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                style={selectStyle}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>

              <div style={tabRowStyle}>
                <TabButton
                  active={activeTab === 'bundesliga'}
                  onClick={() => setActiveTab('bundesliga')}
                >
                  ⚽ Bundesliga
                </TabButton>

                <TabButton
                  active={activeTab === 'championsLeague'}
                  onClick={() => setActiveTab('championsLeague')}
                >
                  🏆 Champions League
                </TabButton>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="card" style={{ padding: 28 }}>
            Lade Archiv...
          </section>
        ) : (
          <>
            {activeTab === 'bundesliga' && (
              <BundesligaArchiveTable rows={bundesligaTable} isMobile={isMobile} />
            )}

            {activeTab === 'championsLeague' && (
              <ChampionsLeagueArchive
                groups={clGroups}
                semifinals={semifinals}
                finals={finals}
              />
            )}
          </>
        )}
      </main>
    </>
  )
}

function BundesligaArchiveTable({
  rows,
  isMobile,
}: {
  rows: any[]
  isMobile: boolean
}) {
  if (rows.length === 0) {
    return <InfoCard text="Für diese Saison wurde noch kein Bundesliga-Endstand gespeichert." />
  }

  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div style={sectionHeaderStyle}>Bundesliga-Endstand</div>

      {isMobile ? (
        <div style={mobileListStyle}>
          {rows.map((row) => {
            const diff = row.bundesliga_goal_difference
            const rank = row.bundesliga_rank

            return (
              <div key={row.team_id} style={mobileRowStyle}>
                <div style={mobileRankStyle}>{rank}</div>

                {row.team?.logo_url && (
                  <img src={row.team.logo_url} alt="" style={mobileLogoStyle} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={mobileTeamNameStyle}>
                    {shortTeamName(row.team?.name)}
                  </div>

                  <div style={mobileTrainerStyle}>
                    {shortTrainerName(row.trainer_name)}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={mobilePointsStyle}>
                    {row.bundesliga_points ?? '-'}
                  </div>

                  <div
                    style={{
                      ...mobileDiffStyle,
                      color:
                        diff > 0
                          ? '#16a34a'
                          : diff < 0
                          ? '#dc2626'
                          : '#64748b',
                    }}
                  >
                    {diff === null || diff === undefined ? '-' : formatDiff(diff)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={headRowStyle}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Punkte</th>
                <th style={thStyle}>Diff</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const rank = row.bundesliga_rank
                const zoneColor =
                  rank === 1
                    ? '#16a34a'
                    : rank <= 4
                    ? '#22c55e'
                    : rank === 5
                    ? '#2563eb'
                    : rank === 6
                    ? '#7c3aed'
                    : rank === 16
                    ? '#f59e0b'
                    : rank >= 17
                    ? '#dc2626'
                    : '#e2e8f0'

                return (
                  <tr key={row.team_id}>
                    <td style={{ ...tdStyle, fontWeight: 950 }}>
                      <span style={{ ...rankBarStyle, background: zoneColor }} />
                      {rank}
                    </td>

                    <td style={tdStyle}>
                      <div style={teamCellStyle}>
                        {row.team?.logo_url && (
                          <img src={row.team.logo_url} alt="" style={logoStyle} />
                        )}

                        <div>
                          <strong>{shortTeamName(row.team?.name)}</strong>

                          <div style={trainerDesktopStyle}>
                            Trainer: {shortTrainerName(row.trainer_name)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={pointsCellStyle}>{row.bundesliga_points ?? '-'}</td>

                    <td style={diffStyle(row.bundesliga_goal_difference)}>
                      {row.bundesliga_goal_difference === null ||
                      row.bundesliga_goal_difference === undefined
                        ? '-'
                        : formatDiff(row.bundesliga_goal_difference)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ChampionsLeagueArchive({
  groups,
  semifinals,
  finals,
}: {
  groups: any[]
  semifinals: any[]
  finals: any[]
}) {
  const preliminaryGroups = groupByName(
    groups.filter((g) => g.phase === 'preliminary')
  )

  const mainGroups = groupByName(groups.filter((g) => g.phase === 'main'))

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section>
        <SectionTitle title="Vorrunde" subtitle="Grün = weitergekommen" />

        {Object.keys(preliminaryGroups).length === 0 ? (
          <InfoCard text="Keine Vorrundengruppen gespeichert." />
        ) : (
          <GroupGrid
            groups={preliminaryGroups}
            highlight={(team) => team.rank <= 3}
            warning={(team) => team.rank === 4}
          />
        )}
      </section>

      <section>
        <SectionTitle title="Hauptrunde" subtitle="Grün = Halbfinale erreicht" />

        {Object.keys(mainGroups).length === 0 ? (
          <InfoCard text="Keine Hauptrundengruppen gespeichert." />
        ) : (
          <GroupGrid
            groups={mainGroups}
            highlight={(team) => team.rank <= 2}
          />
        )}
      </section>

      <section>
        <SectionTitle title="K.-o.-Phase" subtitle="Endstand der Serien" />
        <KnockoutTree semifinals={semifinals} finals={finals} />
      </section>
    </div>
  )
}

function groupByName(rows: any[]) {
  return rows.reduce((acc: Record<string, any[]>, row) => {
    const key = row.group_name || row.name || 'Ohne Gruppe'

    if (!acc[key]) acc[key] = []

    acc[key].push(row)

    return acc
  }, {})
}

function GroupGrid({
  groups,
  highlight,
  warning,
}: {
  groups: Record<string, any[]>
  highlight: (team: any) => boolean
  warning?: (team: any) => boolean
}) {
  return (
    <div style={groupGridStyle}>
      {Object.entries(groups).map(([groupName, teams]) => (
        <section key={groupName} className="card" style={{ overflow: 'hidden' }}>
          <div style={groupHeaderStyle}>{groupName}</div>

          <div style={{ display: 'grid' }}>
            {teams.map((team: any) => {
              const isQualified = highlight(team)
              const isWarning = warning?.(team)
              const zoneColor = isQualified
                ? '#16a34a'
                : isWarning
                ? '#f59e0b'
                : '#e2e8f0'

              return (
                <div key={`${groupName}-${team.team_id}`} style={groupRowStyle}>
                  <div style={{ fontWeight: 950 }}>
                    <span style={{ ...rankBarStyle, background: zoneColor }} />
                    {team.rank}.
                  </div>

                  <div style={teamCellStyle}>
                    {team.logo_url && (
                      <img src={team.logo_url} alt="" style={smallLogoStyle} />
                    )}

                    <strong>{shortTeamName(team.team_name)}</strong>
                  </div>

                  <div style={{ fontWeight: 950, fontSize: 17 }}>
                    {team.points}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function KnockoutTree({
  semifinals,
  finals,
}: {
  semifinals: any[]
  finals: any[]
}) {
  const semifinalSeries = groupSeries(semifinals)
  const finalSeries = groupSeries(finals)

  return (
    <div style={koGridStyle}>
      <div>
        <h3 style={koTitleStyle}>Halbfinale</h3>

        <div style={{ display: 'grid', gap: 14 }}>
          {semifinalSeries.length === 0 ? (
            <InfoCard text="Kein Halbfinale gespeichert." />
          ) : (
            semifinalSeries.map((series: any) => (
              <SimpleKoCard key={series.key} series={series} />
            ))
          )}
        </div>
      </div>

      <div>
        <h3 style={koTitleStyle}>Finale</h3>

        <div style={{ display: 'grid', gap: 14 }}>
          {finalSeries.length === 0 ? (
            <InfoCard text="Kein Finale gespeichert." />
          ) : (
            finalSeries.map((series: any) => (
              <SimpleKoCard key={series.key} series={series} final />
            ))
          )}
        </div>
      </div>

      <div>
        <h3 style={koTitleStyle}>Champion</h3>
        <ChampionCard finals={finals} />
      </div>
    </div>
  )
}

function groupSeries(matches: any[]) {
  const map: Record<string, any> = {}

  for (const match of matches) {
    const teamA = match.home_team?.name ?? 'Team A'
    const teamB = match.away_team?.name ?? 'Team B'
    const key = [teamA, teamB].sort().join('-')

    if (!map[key]) {
      map[key] = {
        key,
        teamA,
        teamB,
        teamAWins: 0,
        teamBWins: 0,
      }
    }

    if (match.winner_team?.name === teamA) map[key].teamAWins += 1
    if (match.winner_team?.name === teamB) map[key].teamBWins += 1
  }

  return Object.values(map)
}

function SimpleKoCard({ series, final }: { series: any; final?: boolean }) {
  const teamAWon = series.teamAWins > series.teamBWins
  const teamBWon = series.teamBWins > series.teamAWins

  return (
    <section
      className="card"
      style={{
        padding: 16,
        border: final ? '2px solid #2563eb' : '1px solid #e2e8f0',
        background: final
          ? 'linear-gradient(135deg,#eff6ff,#ffffff)'
          : '#ffffff',
      }}
    >
      <div style={koTeamStyle(teamAWon)}>{shortTeamName(series.teamA)}</div>

      <div style={koScoreStyle}>
        {series.teamAWins}:{series.teamBWins}
      </div>

      <div style={koTeamStyle(teamBWon)}>{shortTeamName(series.teamB)}</div>
    </section>
  )
}

function ChampionCard({ finals }: { finals: any[] }) {
  const winnerCounts: Record<string, number> = {}

  for (const match of finals) {
    if (match.winner_team?.name) {
      winnerCounts[match.winner_team.name] =
        (winnerCounts[match.winner_team.name] || 0) + 1
    }
  }

  const champion =
    Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return (
    <section style={championCardStyle}>
      <div style={{ fontSize: 34 }}>🏆</div>
      <div style={{ color: '#92400e', fontWeight: 950, marginTop: 8 }}>
        Champion
      </div>

      <div style={{ fontSize: 25, fontWeight: 950, marginTop: 6 }}>
        {champion ? shortTeamName(champion) : 'Noch offen'}
      </div>
    </section>
  )
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 950 }}>{title}</h2>
      {subtitle && (
        <div style={{ color: '#64748b', fontSize: 14, marginTop: 4, fontWeight: 750 }}>
          {subtitle}
        </div>
      )}
    </div>
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

function shortTeamName(name?: string) {
  if (!name) return 'Team'

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

function shortTrainerName(name?: string | null) {
  if (!name) return '-'

  const parts = name.trim().split(' ').filter(Boolean)

  if (parts.length === 1) return parts[0]

  return `${parts[0].charAt(0)}.${parts[parts.length - 1]}`
}

function formatDiff(value: number) {
  return `${value > 0 ? '+' : ''}${value}`
}

function diffStyle(value: number): React.CSSProperties {
  return {
    ...tdStyle,
    fontWeight: 950,
    color:
      value > 0
        ? '#16a34a'
        : value < 0
        ? '#dc2626'
        : '#64748b',
  }
}

function koTeamStyle(active: boolean): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    background: active ? '#dcfce7' : '#f8fafc',
    color: active ? '#166534' : '#334155',
    fontWeight: 950,
    textAlign: 'center',
  }
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

const heroControlsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  marginTop: 22,
}

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const selectStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.34)',
  padding: '0 14px',
  background: 'rgba(255,255,255,0.96)',
  color: '#052e16',
  fontWeight: 950,
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg,#f8fafc,#ffffff)',
  color: '#0f172a',
  fontWeight: 950,
  borderBottom: '1px solid #e2e8f0',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 620,
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

const pointsCellStyle: React.CSSProperties = {
  ...tdStyle,
  fontSize: 18,
  fontWeight: 950,
}

const trainerDesktopStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  marginTop: 2,
  fontWeight: 750,
}

const rankBarStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 4,
  height: 22,
  borderRadius: 99,
  marginRight: 7,
  verticalAlign: 'middle',
}

const teamCellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const logoStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  objectFit: 'contain',
  flexShrink: 0,
}

const mobileListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  background: '#f8fafc',
}

const mobileRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 12,
  background: 'white',
}

const mobileRankStyle: React.CSSProperties = {
  width: 28,
  fontWeight: 950,
  color: '#0f172a',
  flexShrink: 0,
}

const mobileLogoStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  objectFit: 'contain',
  flexShrink: 0,
}

const mobileTeamNameStyle: React.CSSProperties = {
  fontWeight: 950,
  color: '#0f172a',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const mobileTrainerStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  marginTop: 2,
  fontWeight: 750,
}

const mobilePointsStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
  color: '#0f172a',
  lineHeight: 1,
}

const mobileDiffStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  marginTop: 3,
}

const smallLogoStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  objectFit: 'contain',
  flexShrink: 0,
}

const groupGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
}

const groupHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg,#eff6ff,#ffffff)',
  color: '#172554',
  fontWeight: 950,
  borderBottom: '1px solid #e2e8f0',
}

const groupRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr auto',
  gap: 10,
  alignItems: 'center',
  padding: '11px 12px',
  borderBottom: '1px solid #e2e8f0',
  background: '#ffffff',
}

const koGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 20,
  alignItems: 'start',
}

const koTitleStyle: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#0f172a',
  fontWeight: 950,
}

const koScoreStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  textAlign: 'center',
  color: '#0f172a',
  margin: '10px 0',
}

const championCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(135deg,#fef3c7,#ffffff)',
  border: '1px solid #fbbf24',
  boxShadow: '0 12px 32px rgba(180,83,9,0.12)',
  textAlign: 'center',
}