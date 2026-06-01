'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

type Tab = 'bundesliga' | 'championsLeague'

type Team = {
  id: string
  name: string
  logo_url: string | null
}

export default function DuellePage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('bundesliga')
  const [matchday, setMatchday] = useState(1)
  const [matchdays, setMatchdays] = useState<number[]>([])
  const [clMatchdays, setClMatchdays] = useState<{ matchday: number; phase: string }[]>([])
  const [statusMap, setStatusMap] = useState<Record<number, any>>({})
  const [unlockedMatchdays, setUnlockedMatchdays] = useState<number[]>([])
  const [bundesligaDuels, setBundesligaDuels] = useState<any[]>([])
  const [clDuels, setClDuels] = useState<any[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [activeSeasonName, setActiveSeasonName] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (seasonId && matchday) {
      loadDuels(seasonId, matchday)
    }
  }, [seasonId, matchday])

  async function loadInitialData() {
    setLoading(true)
    setMessage('')

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
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setSeasonId(seasonData.id)
    setActiveSeasonName(seasonData.name)

    const { data: lockData } = await supabase
      .from('matchday_locks')
      .select('matchday')
      .eq('season_id', seasonData.id)
      .eq('is_unlocked', true)

    const unlockedDays = (lockData || []).map((row) => row.matchday)
    setUnlockedMatchdays(unlockedDays)

    const { data: assignmentData } = await supabase
      .from('user_team_assignments')
      .select('team_id')
      .eq('user_id', userData.user.id)
      .eq('season_id', seasonData.id)
      .maybeSingle()

    setMyTeamId(assignmentData?.team_id ?? null)

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, logo_url')

    const teamMap: Record<string, Team> = {}

    for (const team of teamsData || []) {
      teamMap[team.id] = team
    }

    setTeams(teamMap)

    const allDays = Array.from({ length: 34 }, (_, i) => i + 1)
    setMatchdays(allDays)

    const { data: clMatchdayData } = await supabase
      .from('cl_matches')
      .select('matchday, phase')
      .eq('season_id', seasonData.id)
      .order('matchday', { ascending: true })

    const uniqueClMatchdays = Array.from(
      new Map(
        (clMatchdayData || []).map((row) => [
          row.matchday,
          { matchday: row.matchday, phase: row.phase },
        ])
      ).values()
    )

    setClMatchdays(uniqueClMatchdays)

    const { data: statusData } = await supabase
      .from('matchday_tip_status')
      .select('*')
      .order('matchday')

    setStatusMap(
      Object.fromEntries((statusData || []).map((row) => [row.matchday, row]))
    )

    const currentDay =
      statusData?.find((row) => !unlockedDays.includes(row.matchday))
        ?.matchday ?? allDays[allDays.length - 1]

    setMatchday(currentDay)
    setLoading(false)
  }

  async function loadDuels(currentSeasonId: string, currentMatchday: number) {
    const { data: blData } = await supabase
      .from('fantasy_matches')
      .select('*')
      .eq('season_id', currentSeasonId)
      .eq('matchday', currentMatchday)
      .order('id', { ascending: true })

    setBundesligaDuels(blData || [])

    const { data: clData } = await supabase
      .from('cl_matches')
      .select(`
        *,
        home_team:teams!cl_matches_home_team_id_fkey(id, name, logo_url),
        away_team:teams!cl_matches_away_team_id_fkey(id, name, logo_url),
        winner_team:teams!cl_matches_winner_team_id_fkey(name)
      `)
      .eq('season_id', currentSeasonId)
      .eq('matchday', currentMatchday)
      .order('id', { ascending: true })

    setClDuels(clData || [])
  }

  const status = statusMap[matchday]
  const unlocked = unlockedMatchdays.includes(matchday)

  const myBundesligaMatch = useMemo(() => {
    if (!myTeamId) return null

    return (
      bundesligaDuels.find(
        (match) =>
          match.home_team_id === myTeamId || match.away_team_id === myTeamId
      ) || null
    )
  }, [bundesligaDuels, myTeamId])

  const otherBundesligaMatches = useMemo(() => {
    if (!myBundesligaMatch) return bundesligaDuels
    return bundesligaDuels.filter((match) => match.id !== myBundesligaMatch.id)
  }, [bundesligaDuels, myBundesligaMatch])

  const myClMatch = useMemo(() => {
    if (!myTeamId) return null

    return (
      clDuels.find(
        (match) =>
          match.home_team_id === myTeamId || match.away_team_id === myTeamId
      ) || null
    )
  }, [clDuels, myTeamId])

  const otherClMatches = useMemo(() => {
    if (!myClMatch) return clDuels
    return clDuels.filter((match) => match.id !== myClMatch.id)
  }, [clDuels, myClMatch])

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1200 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Duelle...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1200 }}>
        <section
          className="card"
          style={{
            padding: 28,
            marginBottom: 26,
            background:
              activeTab === 'championsLeague'
                ? 'linear-gradient(135deg, #172554, #1e3a8a)'
                : 'linear-gradient(135deg, #052e16, #166534)',
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={heroCircleStyle} />

          <div style={heroContentStyle}>
            <div>
              <div style={heroBadgeStyle}>⚔️ Direktvergleich</div>

              <h1 style={heroTitleStyle}>Duelle</h1>

              {activeSeasonName && (
                <div style={heroSubtitleStyle}>
                  Saison: {activeSeasonName}
                </div>
              )}
            </div>

            <div style={selectorPanelStyle}>
              <div style={selectorLabelStyle}>Spieltag auswählen</div>

              <select
                value={matchday}
                onChange={(e) => setMatchday(Number(e.target.value))}
                style={selectStyle}
              >
                {(activeTab === 'championsLeague'
                  ? clMatchdays.map((row) => row.matchday)
                  : matchdays
                ).map((day) => {
                  const phase =
                    clMatchdays.find((row) => row.matchday === day)?.phase ??
                    getPhaseForMatchday(day)

                  return (
                    <option key={day} value={day}>
                      {activeTab === 'championsLeague'
                        ? getClMatchdayLabel(day, phase)
                        : `${day}. Spieltag`}
                    </option>
                  )
                })}
              </select>

              {status && (
                <div
                  style={{
                    ...statusPillStyle,
                    background: unlocked
                      ? 'rgba(34,197,94,0.18)'
                      : 'rgba(251,191,36,0.18)',
                    border: unlocked
                      ? '1px solid rgba(34,197,94,0.3)'
                      : '1px solid rgba(251,191,36,0.3)',
                  }}
                >
                  {unlocked
                    ? 'Duelle freigeschaltet'
                    : `${status.finished_players}/${status.player_count} Teilnehmer fertig`}
                </div>
              )}
            </div>
          </div>

          <div style={tabRowStyle}>
            <ModernTabButton
              active={activeTab === 'bundesliga'}
              onClick={() => {
                setActiveTab('bundesliga')
                setMatchday(matchdays[0] ?? 1)
              }}
            >
              Bundesliga-Duelle
            </ModernTabButton>

            <ModernTabButton
              active={activeTab === 'championsLeague'}
              onClick={() => {
                setActiveTab('championsLeague')
                setMatchday(clMatchdays[0]?.matchday ?? 7)
              }}
            >
              Champions-League-Duelle
            </ModernTabButton>
          </div>
        </section>

        {message && <InfoBox text={message} />}

        {!unlocked && (
          <div
            className="card"
            style={{
              padding: 16,
              marginBottom: 24,
              background: '#fff7ed',
              color: '#92400e',
              fontWeight: 800,
              border: '1px solid #f59e0b',
            }}
          >
            Die Duelle sind sichtbar. Der Tippvergleich wird erst
            freigeschaltet, wenn der Spieltag im Adminbereich freigegeben wurde.
          </div>
        )}

        {activeTab === 'bundesliga' && (
          <>
            <SectionTitle title="Mein Duell" />

            <section style={{ marginBottom: 32 }}>
              {myBundesligaMatch ? (
                <BundesligaDuelCard
                  match={myBundesligaMatch}
                  teams={teams}
                  myTeamId={myTeamId}
                  unlocked={unlocked}
                  highlighted
                />
              ) : (
                <InfoBox text="Für dein Team wurde an diesem Spieltag kein Duell gefunden." />
              )}
            </section>

            <SectionTitle title="Alle Bundesliga-Duelle" />

            <section>
              {otherBundesligaMatches.length === 0 ? (
                <InfoBox text="Keine weiteren Duelle gefunden." />
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {otherBundesligaMatches.map((match) => (
                    <BundesligaDuelCard
                      key={match.id}
                      match={match}
                      teams={teams}
                      myTeamId={myTeamId}
                      unlocked={unlocked}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'championsLeague' && (
          <>
            <SectionTitle title="Mein Champions-League-Duell" />

            <section style={{ marginBottom: 32 }}>
              {myClMatch ? (
                <ClDuelCard
                  match={myClMatch}
                  myTeamId={myTeamId}
                  unlocked={unlocked}
                  highlighted
                />
              ) : (
                <InfoBox text="Für dein Team wurde an diesem Spieltag kein Champions-League-Duell gefunden." />
              )}
            </section>

            <SectionTitle title="Alle Champions-League-Duelle" />

            <section>
              {otherClMatches.length === 0 ? (
                <InfoBox text="Keine weiteren Champions-League-Duelle für diesen Spieltag gefunden." />
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {otherClMatches.map((match) => (
                    <ClDuelCard
                      key={match.id}
                      match={match}
                      myTeamId={myTeamId}
                      unlocked={unlocked}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  )
}

function BundesligaDuelCard({
  match,
  teams,
  myTeamId,
  unlocked,
  highlighted = false,
}: {
  match: any
  teams: Record<string, Team>
  myTeamId: string | null
  unlocked: boolean
  highlighted?: boolean
}) {
  const home = teams[match.home_team_id]
  const away = teams[match.away_team_id]

  const homeScore = getScore(match, 'home')
  const awayScore = getScore(match, 'away')
  const showScore = unlocked && homeScore !== null && awayScore !== null

  return (
    <div style={duelCardStyle(highlighted)}>
      <div style={duelGridStyle}>
        <TeamBox team={home} align="right" isMine={match.home_team_id === myTeamId} />

        <ScoreBox
          score={showScore ? `${homeScore} : ${awayScore}` : '- : -'}
          label={unlocked ? 'freigeschaltet' : 'gesperrt'}
          highlighted={highlighted}
        />

        <TeamBox team={away} align="left" isMine={match.away_team_id === myTeamId} />
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        {unlocked ? (
          <Link href={`/duelle/bundesliga/${match.id}`} style={buttonLinkStyle}>
            Tippvergleich ansehen
          </Link>
        ) : (
          <span style={lockedTextStyle}>Tippvergleich noch gesperrt</span>
        )}
      </div>
    </div>
  )
}

function ClDuelCard({
  match,
  myTeamId,
  unlocked,
  highlighted = false,
}: {
  match: any
  myTeamId: string | null
  unlocked: boolean
  highlighted?: boolean
}) {
  const homeScore =
    match.home_tip_points !== undefined && match.home_tip_points !== null
      ? Number(match.home_tip_points)
      : null

  const awayScore =
    match.away_tip_points !== undefined && match.away_tip_points !== null
      ? Number(match.away_tip_points)
      : null

  const showScore = unlocked && homeScore !== null && awayScore !== null

  return (
    <div style={duelCardStyle(highlighted)}>
      <div style={duelGridStyle}>
        <TeamBox team={match.home_team} align="right" isMine={match.home_team_id === myTeamId} />

        <ScoreBox
          score={showScore ? `${homeScore} : ${awayScore}` : '- : -'}
          label=""
          highlighted={highlighted}
        />

        <TeamBox team={match.away_team} align="left" isMine={match.away_team_id === myTeamId} />
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        {!unlocked ? (
          <span style={lockedTextStyle}>Tippvergleich noch gesperrt</span>
        ) : match.id ? (
          <Link href={`/duelle/champions-league/${match.id}`} style={buttonLinkStyle}>
            Tippvergleich ansehen
          </Link>
        ) : (
          <span style={{ color: '#666', fontWeight: 700 }}>
            Vergleich nicht verfügbar
          </span>
        )}
      </div>
    </div>
  )
}

function TeamBox({
  team,
  align,
  isMine,
}: {
  team?: Team
  align: 'left' | 'right'
  isMine: boolean
}) {
  const label = team?.name ?? 'Unbekannt'

return (
  <div
    style={{
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      fontWeight: isMine ? 900 : 750,
      textAlign: 'center',
      padding: '0 4px',
    }}
  >
    {team?.logo_url && (
      <img
        src={team.logo_url}
        alt=""
        style={{
          width: 42,
          height: 42,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    )}

    <span
      style={{
        fontSize: 14,
        lineHeight: 1.2,
        color: '#0f172a',
        wordBreak: 'break-word',
      }}
    >
      {isMine ? '⭐ ' : ''}
      {label}
    </span>
  </div>
)
}

function ScoreBox({
  score,
  label,
  highlighted,
}: {
  score: string
  label: string
  highlighted: boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
<div
  style={{
    minWidth: 104,
    padding: '10px 14px',
    borderRadius: 22,
    background: '#0f172a',
    color: 'white',
    fontSize: 20,
    fontWeight: 950,
    boxShadow: '0 14px 28px rgba(15,23,42,0.18)',
  }}
>
  {score}
</div>

      <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 800 }}>
        {label}
      </div>
    </div>
  )
}

function ModernTabButton({
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
        minHeight: 48,
        padding: '0 18px',
        borderRadius: 999,
        border: active ? '2px solid white' : '1px solid rgba(255,255,255,0.22)',
        background: active ? 'white' : 'rgba(255,255,255,0.10)',
        color: active ? '#0f172a' : 'white',
        fontWeight: 900,
      }}
    >
      {children}
    </button>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: '0 0 14px',
        fontSize: 24,
        fontWeight: 900,
        color: '#0f172a',
      }}
    >
      {title}
    </h2>
  )
}

function InfoBox({ text }: { text: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 22,
        background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
        fontWeight: 700,
        color: '#475569',
      }}
    >
      {text}
    </div>
  )
}

function getPhaseForMatchday(matchday: number) {
  if (matchday >= 7 && matchday <= 16) return 'preliminary'
  if (matchday >= 17 && matchday <= 26) return 'main'
  if (matchday >= 27 && matchday <= 31) return 'semifinal'
  if (matchday >= 32) return 'final'
  return 'preliminary'
}

function getClMatchdayLabel(matchday: number, phase: string) {
  if (phase === 'preliminary') return `Vorrunde ${matchday - 6}. Spieltag`
  if (phase === 'main') return `Hauptrunde ${matchday - 16}. Spieltag`
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return `CL-Spieltag ${matchday}`
}

function getPhaseText(phase: string) {
  if (phase === 'preliminary') return 'Vorrunde'
  if (phase === 'main') return 'Hauptrunde'
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return phase
}

function getScore(match: any, side: 'home' | 'away') {
  const columns =
    side === 'home'
      ? ['home_tip_points', 'home_points', 'home_score']
      : ['away_tip_points', 'away_points', 'away_score']

  for (const column of columns) {
    if (match[column] !== undefined && match[column] !== null) {
      return Number(match[column])
    }
  }

  return null
}

const heroCircleStyle: React.CSSProperties = {
  position: 'absolute',
  top: -120,
  right: -120,
  width: 320,
  height: 320,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
}

const heroContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 22,
  flexWrap: 'wrap',
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.14)',
  fontWeight: 800,
  fontSize: 13,
  marginBottom: 14,
}

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1,
  fontWeight: 900,
}

const heroSubtitleStyle: React.CSSProperties = {
  marginTop: 14,
  color: 'rgba(255,255,255,0.82)',
  fontWeight: 700,
}

const selectorPanelStyle: React.CSSProperties = {
  minWidth: 280,
  flex: 1,
  maxWidth: 420,
  background: 'rgba(255,255,255,0.10)',
  borderRadius: 22,
  padding: 18,
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(10px)',
}

const selectorLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  marginBottom: 10,
  opacity: 0.75,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  borderRadius: 14,
  border: '0',
  padding: '0 14px',
  fontWeight: 800,
  fontSize: 15,
  background: 'white',
  color: '#0f172a',
}

const statusPillStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  fontWeight: 800,
}

const tabRowStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  marginTop: 22,
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const duelGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 8,
  alignItems: 'center',
}

const duelCardStyle = (highlighted: boolean): React.CSSProperties => ({
  border: highlighted ? '2px solid #16a34a' : '1px solid #e2e8f0',
  borderRadius: 22,
  padding: highlighted ? 22 : 18,
  background: highlighted
    ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
    : 'linear-gradient(135deg, #ffffff, #f8fafc)',
  boxShadow: highlighted
    ? '0 16px 34px rgba(22,163,74,0.14)'
    : '0 10px 24px rgba(15,23,42,0.06)',
})

const teamNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  color: '#0f172a',
}

const buttonLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 999,
  background: '#111827',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 900,
}

const lockedTextStyle: React.CSSProperties = {
  color: '#b45309',
  fontWeight: 800,
}