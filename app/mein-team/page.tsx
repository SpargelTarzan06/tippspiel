'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabaseClient'
import NavBar from '../../components/NavBar'

type HistoryTab = 'bundesliga' | 'championsLeague'
type Season = { id: string; name: string }

type FinanceTransaction = {
  id: string
  amount: number
  type: string
  title: string
  description: string | null
  created_at: string
  season_name: string | null
}

export default function MeinTeamPage() {
  const [team, setTeam] = useState<any>(null)
  const [seasonName, setSeasonName] = useState('')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [financeSeasonFilter, setFinanceSeasonFilter] = useState('all')
  const [stats, setStats] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [logoMap, setLogoMap] = useState<Record<string, string | null>>({})
  const [financeAccountId, setFinanceAccountId] = useState('')
  const [financeSummary, setFinanceSummary] = useState<any>(null)
  const [projectedPrize, setProjectedPrize] = useState<any>(null)
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [clMatches, setClMatches] = useState<any[]>([])
  const [bestBundesligaResult, setBestBundesligaResult] = useState<any>(null)
  const [bestClResult, setBestClResult] = useState<any>(null)
  const [bestTrainerBundesligaResult, setBestTrainerBundesligaResult] = useState<any>(null)
  const [bestTrainerClResult, setBestTrainerClResult] = useState<any>(null)
  const [historyTab, setHistoryTab] = useState<HistoryTab>('bundesliga')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (financeAccountId) {
      loadFinanceTransactions(financeAccountId)
    }
  }, [financeAccountId, financeSeasonFilter])

  async function load() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setLoading(false)
      return
    }

    setSeasonName(seasonData.name)

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id, name')
      .order('name', { ascending: false })

    setSeasons(seasonsData || [])

    const { data: assignmentData } = await supabase
      .from('user_team_assignments')
      .select('team_id')
      .eq('user_id', userData.user.id)
      .eq('season_id', seasonData.id)
      .maybeSingle()

    if (!assignmentData?.team_id) {
      setLoading(false)
      return
    }

    const teamId = assignmentData.team_id

    const { data: teamsData } = await supabase
      .from('teams')
      .select('name, logo_url')

    setLogoMap(Object.fromEntries((teamsData || []).map((t) => [t.name, t.logo_url])))

    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .eq('id', teamId)
      .single()

    setTeam(teamData)

    await loadChampionsLeague(teamId, seasonData.id)

    const { data: statsData } = await supabase
      .from('active_team_stats')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    setStats(statsData)

    const { data: historyData } = await supabase
      .from('active_team_match_history')
      .select('*')
      .eq('team_id', teamId)
      .order('matchday', { ascending: true })

    setHistory(historyData || [])

    const { data: financeAccount } = await supabase
      .from('finance_account_summary')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (financeAccount) {
      setFinanceAccountId(financeAccount.account_id)
      setFinanceSummary(financeAccount)
    }

    const { data: projectedData } = await supabase
      .from('my_projected_prize_money')
      .select('*')
      .maybeSingle()

    setProjectedPrize(projectedData)

    const { data: bestBl } = await supabase
      .from('team_best_bundesliga_result')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    setBestBundesligaResult(bestBl)

    const { data: bestCl } = await supabase
      .from('team_best_cl_result')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    setBestClResult(bestCl)

    const { data: bestTrainerBl } = await supabase
      .from('user_best_bundesliga_result')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    setBestTrainerBundesligaResult(bestTrainerBl)

    const { data: bestTrainerCl } = await supabase
      .from('user_best_cl_result')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    setBestTrainerClResult(bestTrainerCl)

    setLoading(false)
  }

  async function loadFinanceTransactions(accountId: string) {
    let query = supabase
      .from('finance_transactions_with_season')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (financeSeasonFilter !== 'all') {
      query = query.eq('season_id', financeSeasonFilter)
    }

    const { data } = await query

    setTransactions((data || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount ?? 0),
      type: row.type,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
      season_name: row.season_name,
    })))
  }

  async function loadChampionsLeague(currentTeamId: string, currentSeasonId: string) {
    const { data: matches } = await supabase
      .from('cl_matches')
      .select(`
        *,
        home_team:teams!cl_matches_home_team_id_fkey(name),
        away_team:teams!cl_matches_away_team_id_fkey(name),
        winner_team:teams!cl_matches_winner_team_id_fkey(name)
      `)
      .eq('season_id', currentSeasonId)
      .or(`home_team_id.eq.${currentTeamId},away_team_id.eq.${currentTeamId}`)
      .order('matchday', { ascending: false })

    setClMatches(matches || [])
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1150 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade dein Team...
          </section>
        </main>
      </>
    )
  }

  const displayStats = {
    matches_played: stats?.matches_played ?? 0,
    wins: stats?.wins ?? 0,
    draws: stats?.draws ?? 0,
    losses: stats?.losses ?? 0,
    points: stats?.points ?? 0,
    goal_difference: stats?.goal_difference ?? 0,
    tip_points_for: stats?.tip_points_for ?? 0,
    tip_points_against: stats?.tip_points_against ?? 0,
  }

  const totalPrizeMoney = Number(financeSummary?.total_prize_money ?? 0)
  const totalPenalties = Number(financeSummary?.total_penalties ?? 0)
  const projectedAmount = Number(projectedPrize?.projected_prize_money ?? 0)
  const balance = totalPrizeMoney - totalPenalties
  const finishedHistory = history.filter((m) => m.finished)
  const lastFive = finishedHistory.slice(-5)

  const getResultColor = (result: string) => {
    if (result === 'win') return '#dcfce7'
    if (result === 'loss') return '#fee2e2'
    if (result === 'draw') return '#fef3c7'
    return '#f1f5f9'
  }

  const getResultText = (result: string) => {
    if (result === 'win') return 'Sieg'
    if (result === 'loss') return 'Niederlage'
    if (result === 'draw') return 'Unentschieden'
    return 'Offen'
  }

  const getPhaseText = (phase: string) => {
    if (phase === 'preliminary') return 'Vorrunde'
    if (phase === 'main') return 'Hauptrunde'
    if (phase === 'semifinal') return 'Halbfinale'
    if (phase === 'final') return 'Finale'
    return phase
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1150 }}>
        {!team ? (
          <section className="card" style={{ padding: 24 }}>
            Dir wurde für diese Saison noch kein Team zugewiesen.
          </section>
        ) : (
          <>
            <section style={heroStyle}>
              <div style={heroGlowStyle} />

              <div style={teamHeroContentStyle}>
                <div style={teamIdentityStyle}>
                  {team?.logo_url && (
                    <div style={logoWrapStyle}>
                      <img src={team.logo_url} alt="" style={heroLogoStyle} />
                    </div>
                  )}

                  <div>
                    <div style={eyebrowStyle}>Mein Team</div>
                    <h1 style={teamTitleStyle}>{team?.name}</h1>

                    {seasonName && (
                      <div style={seasonPillStyle}>
                        Aktive Saison: {seasonName}
                      </div>
                    )}
                  </div>
                </div>

                {team?.id && (
                  <Link href={`/team/${team.id}/sondertipps`} style={primaryButtonStyle}>
                    Sondertipps anzeigen
                  </Link>
                )}
              </div>

<div style={heroStatsGridStyle}>
  <HeroStat label="Punkte" value={displayStats.points} highlight />

  <HeroStat label="Spiele" value={displayStats.matches_played} />

  <HeroStat
    label="Differenz"
    value={`${displayStats.goal_difference > 0 ? '+' : ''}${displayStats.goal_difference}`}
    tone={
      displayStats.goal_difference > 0
        ? 'positive'
        : displayStats.goal_difference < 0
        ? 'negative'
        : 'neutral'
    }
  />
</div>
            </section>

            <SectionTitle title="Statistiken" />

            <div style={mobileStatsTopGridStyle}>
              <StatCard label="Siege" value={displayStats.wins} />
              <StatCard label="Unentschieden" value={displayStats.draws} />
              <StatCard label="Niederlagen" value={displayStats.losses} />
            </div>

            <div style={mobileStatsBottomGridStyle}>
              <StatCard label="Tipp-Punkte" value={displayStats.tip_points_for} />
              <StatCard label="Gegenpunkte" value={displayStats.tip_points_against} />
            </div>

            <SectionTitle title="Formkurve" />

            {lastFive.length === 0 ? (
              <InfoCard text="Noch keine abgeschlossenen Spiele." />
            ) : (
              <FormCurve matches={lastFive} logoMap={logoMap} />
            )}

            <div style={historyToggleHeaderStyle}>
              <SectionTitle title="Spielverlauf" />

              <button
                onClick={() => setHistoryOpen((open) => !open)}
                style={toggleButtonStyle}
              >
                {historyOpen ? 'Ausblenden' : 'Anzeigen'}
              </button>
            </div>

            {historyOpen && (
              <>
                <div style={tabRowStyle}>
                  <TabButton
                    active={historyTab === 'bundesliga'}
                    onClick={() => setHistoryTab('bundesliga')}
                  >
                    Bundesliga
                  </TabButton>

                  <TabButton
                    active={historyTab === 'championsLeague'}
                    onClick={() => setHistoryTab('championsLeague')}
                  >
                    Champions League
                  </TabButton>
                </div>

                {historyTab === 'bundesliga' && (
                  <BundesligaHistory
                    history={history}
                    getResultColor={getResultColor}
                    getResultText={getResultText}
                  />
                )}

                {historyTab === 'championsLeague' && (
                  <ChampionsLeagueHistory
                    matches={clMatches}
                    teamId={team.id}
                    getPhaseText={getPhaseText}
                  />
                )}
              </>
            )}

            <SectionTitle title="Historische Bestleistungen" />

            <div style={cardGridStyle}>
              <AchievementCard
                eyebrow="Verein"
                title="Bestes Bundesliga-Ergebnis"
                value={bestBundesligaResult ? `${bestBundesligaResult.bundesliga_rank}. Platz` : '-'}
                subtitle={bestBundesligaResult ? `Saison ${bestBundesligaResult.season_name}` : 'Noch kein Ergebnis'}
              />

              <AchievementCard
                eyebrow="Verein"
                title="Bestes Champions-League-Ergebnis"
                value={bestClResult?.cl_result ?? '-'}
                subtitle={bestClResult ? `Saison ${bestClResult.season_name}` : 'Noch kein Ergebnis'}
              />

              <AchievementCard
                eyebrow="Trainer"
                title="Bestes Bundesliga-Ergebnis"
                value={bestTrainerBundesligaResult ? `${bestTrainerBundesligaResult.bundesliga_rank}. Platz` : '-'}
                subtitle={bestTrainerBundesligaResult ? `Saison ${bestTrainerBundesligaResult.season_name} mit ${bestTrainerBundesligaResult.team_name}` : 'Noch kein Ergebnis'}
              />

              <AchievementCard
                eyebrow="Trainer"
                title="Bestes Champions-League-Ergebnis"
                value={bestTrainerClResult?.cl_result ?? '-'}
                subtitle={bestTrainerClResult ? `Saison ${bestTrainerClResult.season_name} mit ${bestTrainerClResult.team_name}` : 'Noch kein Ergebnis'}
              />
            </div>

            <SectionTitle title="Finanzen" />

            <div style={financeGridStyle}>
<FinanceCard
  title="Kontostand"
  value={`${balance >= 0 ? '+' : ''}${balance.toFixed(2)} €`}
  positive={balance > 0}
  negative={balance < 0}
  highlight={balance === 0}
/>

              <FinanceCard
                title="Preisgeld gesamt"
                value={`+${totalPrizeMoney.toFixed(2)} €`}
                positive
              />

              <FinanceCard
                title="Vorgemerktes Preisgeld"
                value={`${projectedAmount.toFixed(2)} €`}
                subtitle={projectedPrize?.rank ? `Aktueller Platz: ${projectedPrize.rank}` : 'Noch kein Tabellenplatz'}
              />

              <FinanceCard
                title="Strafen gesamt"
                value={`-${totalPenalties.toFixed(2)} €`}
                negative
              />
            </div>

            <div style={financeHeaderStyle}>
              <h3 style={{ margin: 0 }}>Finanzbewegungen</h3>

              <select
                value={financeSeasonFilter}
                onChange={(e) => setFinanceSeasonFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="all">Alle Saisons</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>

            {transactions.length === 0 ? (
              <InfoCard text="Noch keine Finanzbewegungen." />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {transactions.map((t) => (
                  <TransactionCard key={t.id} transaction={t} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 style={sectionTitleStyle}>{title}</h2>
}

function HeroStat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string
  value: string | number
  highlight?: boolean
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div
      style={{
        ...heroStatStyle,
        background: highlight ? 'rgba(236,253,245,0.96)' : 'rgba(255,255,255,0.88)',
      }}
    >
      <div style={statLabelStyle}>{label}</div>
      <div
        style={{
          ...heroStatValueStyle,
          color:
            tone === 'positive'
              ? '#16a34a'
              : tone === 'negative'
              ? '#dc2626'
              : '#0f172a',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BilanzStat({
  wins,
  draws,
  losses,
}: {
  wins: number
  draws: number
  losses: number
}) {
  return (
    <div style={{ ...heroStatStyle, background: 'rgba(255,255,255,0.88)' }}>
      <div style={statLabelStyle}>Bilanz</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        <BilanzValue label="S" value={wins} />
        <BilanzValue label="U" value={draws} />
        <BilanzValue label="N" value={losses} />
      </div>
    </div>
  )
}

function BilanzValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 950,
          color: '#64748b',
          marginBottom: 2,
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: 22, fontWeight: 950, color: '#0f172a' }}>
        {value}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div style={boxStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  )
}

function FormCurve({
  matches,
  logoMap,
}: {
  matches: any[]
  logoMap: Record<string, string | null>
}) {
  const viewWidth = 560
  const viewHeight = 210
  const pointXs = [58, 169, 280, 391, 502]
  const getY = (result: string) => result === 'win' ? 32 : result === 'draw' ? 92 : 152

const leftPadding = 58
const rightPadding = 58

const usableWidth = viewWidth - leftPadding - rightPadding

const points = matches.map((match, index) => {
  const x =
    matches.length === 1
      ? viewWidth / 2
      : leftPadding +
        (usableWidth / (matches.length - 1)) * index

  return {
    x,
    y: getY(match.result),
    match,
  }
})

  const linePath = points
    .map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <div
      className="card"
      style={{
        padding: 16,
        maxWidth: 720,
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        width="100%"
        height="auto"
        style={{ display: 'block' }}
      >
        <line x1={38} y1={32} x2={522} y2={32} stroke="#e2e8f0" />
        <line x1={38} y1={92} x2={522} y2={92} stroke="#e2e8f0" />
        <line x1={38} y1={152} x2={522} y2={152} stroke="#e2e8f0" />

        <text x={8} y={37} fontSize={18} fontWeight="900" fill="#16a34a">S</text>
        <text x={8} y={97} fontSize={18} fontWeight="900" fill="#ca8a04">U</text>
        <text x={8} y={157} fontSize={18} fontWeight="900" fill="#dc2626">N</text>

        <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={5} strokeLinecap="round" />

        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={8} fill="#0f172a" />
            <circle cx={point.x} cy={point.y} r={4} fill="#ffffff" />

            <text
              x={point.x}
              y={184}
              textAnchor="middle"
              fontSize={18}
              fontWeight="900"
              fill="#0f172a"
            >
              {point.match.own_tip_points}:{point.match.opponent_tip_points}
            </text>
          </g>
        ))}
      </svg>

<div
  style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${matches.length}, 1fr)`,
    gap: 0,
    marginTop: 4,
    paddingLeft: 42,
    paddingRight: 42,
  }}
>
        {matches.map((match, index) => (
          <div
            key={index}
            style={{
              minWidth: 0,
              textAlign: 'center',
              fontSize: 11,
              color: '#64748b',
              fontWeight: 800,
            }}
          >
            {logoMap[match.opponent_team_name] && (
              <img
                src={logoMap[match.opponent_team_name] ?? ''}
                alt=""
                style={{
                  width: 24,
                  height: 24,
                  objectFit: 'contain',
                  margin: '0 auto 3px',
                  display: 'block',
                }}
              />
            )}

            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shortOpponentName(match.opponent_team_name)}
            </div>


          </div>
        ))}
      </div>
    </div>
  )
}

function BundesligaHistory({
  history,
  getResultColor,
  getResultText,
}: {
  history: any[]
  getResultColor: (result: string) => string
  getResultText: (result: string) => string
}) {
  if (history.length === 0) return <InfoCard text="Noch keine Spiele." />

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {history.map((match) => (
        <div
          key={match.matchday}
          className="card"
          style={{
            padding: 14,
            background: getResultColor(match.result),
            border: '1px solid rgba(226,232,240,0.9)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <strong>Spieltag {match.matchday}</strong>
            <strong>{getResultText(match.result)}</strong>
          </div>

          <div style={{ marginTop: 8, color: '#334155', fontWeight: 700 }}>
            vs {match.opponent_team_name}
          </div>

          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950 }}>
            {match.own_tip_points}:{match.opponent_tip_points}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChampionsLeagueHistory({
  matches,
  teamId,
  getPhaseText,
}: {
  matches: any[]
  teamId: string
  getPhaseText: (phase: string) => string
}) {
  if (matches.length === 0) return <InfoCard text="Noch keine CL-Spiele." />

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {matches.map((match) => {
        const isHome = match.home_team_id === teamId
        const ownGoals = isHome ? match.home_tip_points : match.away_tip_points
        const oppGoals = isHome ? match.away_tip_points : match.home_tip_points
        const opponent = isHome ? match.away_team?.name : match.home_team?.name
        const won = match.winner_team_id && match.winner_team_id === teamId
        const lost = match.winner_team_id && match.winner_team_id !== teamId

        return (
          <div
            key={match.id}
            className="card"
            style={{
              padding: 14,
              background: won ? '#dcfce7' : lost ? '#fee2e2' : '#fef3c7',
            }}
          >
            <div style={{ fontWeight: 900 }}>
              {getPhaseText(match.phase)} · {match.matchday - 6}. CL-Spieltag
            </div>

            <div style={{ marginTop: 8, color: '#334155', fontWeight: 700 }}>
              vs {opponent}
            </div>

            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950 }}>
              {ownGoals}:{oppGoals}
            </div>
          </div>
        )
      })}
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
        minHeight: 42,
        padding: '0 16px',
        borderRadius: 999,
        border: active ? '0' : '1px solid #cbd5e1',
        background: active ? '#0f172a' : '#ffffff',
        color: active ? 'white' : '#0f172a',
        cursor: 'pointer',
        fontWeight: 900,
      }}
    >
      {children}
    </button>
  )
}

function AchievementCard({
  eyebrow,
  title,
  value,
  subtitle,
}: {
  eyebrow: string
  title: string
  value: string
  subtitle?: string
}) {
  return (
    <div style={boxStyle}>
      <div style={cardEyebrowStyle}>{eyebrow}</div>
      <div style={{ color: '#64748b', fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
      {subtitle && <div style={cardSubtitleStyle}>{subtitle}</div>}
    </div>
  )
}

function FinanceCard({
  title,
  value,
  subtitle,
  highlight,
  positive,
  negative,
}: {
  title: string
  value: string
  subtitle?: string
  highlight?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div
      style={{
        ...boxStyle,
        background: negative
  ? '#fff1f2'
  : positive
  ? '#ecfdf5'
  : highlight
  ? '#f8fafc'
  : '#ffffff',
      }}
    >
      <div style={statLabelStyle}>{title}</div>
      <div
        style={{
          fontSize: highlight ? 26 : 22,
          fontWeight: 950,
          marginTop: 4,
          color: negative
  ? '#dc2626'
  : positive
  ? '#16a34a'
  : '#0f172a',
        }}
      >
        {value}
      </div>

      {subtitle && <div style={cardSubtitleStyle}>{subtitle}</div>}
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: FinanceTransaction }) {
  const positive = Number(transaction.amount) >= 0

  return (
    <div
      className="card"
      style={{
        padding: 14,
        background: positive ? '#f0fdf4' : '#fff1f2',
        border: positive ? '1px solid #bbf7d0' : '1px solid #fecdd3',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <strong>{transaction.title}</strong>
        <strong style={{ color: positive ? '#16a34a' : '#dc2626' }}>
          {positive ? '+' : ''}
          {Number(transaction.amount).toFixed(2)} €
        </strong>
      </div>

      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 700 }}>
        {transaction.season_name ?? 'Ohne Saison'} · {transaction.type}
      </div>

      {transaction.description && (
        <div style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>
          {transaction.description}
        </div>
      )}
    </div>
  )
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 800 }}>
      {text}
    </div>
  )
}

function shortOpponentName(name: string) {
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

const heroStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 24,
  marginBottom: 30,
  background: 'linear-gradient(135deg, #052e16, #166534)',
  color: 'white',
  boxShadow: '0 18px 45px rgba(15,23,42,0.12)',
}

const heroGlowStyle: CSSProperties = {
  position: 'absolute',
  right: -80,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.09)',
}

const teamHeroContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
  flexWrap: 'wrap',
}

const teamIdentityStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
}

const logoWrapStyle: CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 24,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.92)',
}

const heroLogoStyle: CSSProperties = {
  width: 52,
  height: 52,
  objectFit: 'contain',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.13)',
  fontWeight: 900,
  fontSize: 12,
  marginBottom: 10,
}

const teamTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
}

const seasonPillStyle: CSSProperties = {
  marginTop: 12,
  color: 'rgba(255,255,255,0.84)',
  fontWeight: 800,
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 18px',
  borderRadius: 999,
  background: 'white',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 950,
}

const heroStatsGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginTop: 22,
}

const heroStatStyle: CSSProperties = {
  borderRadius: 18,
  padding: '12px 8px',
  color: '#0f172a',
}

const heroStatValueStyle: CSSProperties = {
  fontSize: 'clamp(20px, 5vw, 28px)',
  fontWeight: 950,
  marginTop: 4,
}

const sectionTitleStyle: CSSProperties = {
  margin: '30px 0 14px',
  fontSize: 24,
  fontWeight: 950,
  color: '#0f172a',
}

const mobileStatsTopGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
}

const mobileStatsBottomGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 8,
  marginTop: 8,
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
}

const financeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 12,
  marginBottom: 22,
}

const boxStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 16,
  background: '#ffffff',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
}

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  fontWeight: 850,
}

const statValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
  marginTop: 4,
  color: '#0f172a',
}

const cardEyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  marginBottom: 10,
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#166534',
  fontSize: 12,
  fontWeight: 950,
}

const cardSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  marginTop: 6,
  fontWeight: 700,
}

const historyToggleHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const toggleButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
}

const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 16,
  flexWrap: 'wrap',
}

const financeHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  margin: '28px 0 14px',
}

const selectStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: 'white',
  fontWeight: 800,
}