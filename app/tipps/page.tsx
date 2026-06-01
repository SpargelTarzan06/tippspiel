'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import NavBar from '../../components/NavBar'

export default function TippsPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [initialMatches, setInitialMatches] = useState<any[]>([])
  const [selectedMatchday, setSelectedMatchday] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [activeSeasonName, setActiveSeasonName] = useState('')
  const [userId, setUserId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [unlockedMatchdays, setUnlockedMatchdays] = useState<number[]>([])
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
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    setUserId(userData.user.id)

    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('is_active', true)
      .single()

    if (seasonError || !seasonData) {
      alert('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setActiveSeasonName(seasonData.name)
    setSeasonId(seasonData.id)

    const { data: unlockedData } = await supabase
      .from('matchday_locks')
      .select('matchday')
      .eq('season_id', seasonData.id)
      .eq('is_unlocked', true)

    setUnlockedMatchdays((unlockedData || []).map((row) => row.matchday))

    const { data, error } = await supabase
      .from('my_predictions_view')
      .select('*')
      .order('matchday', { ascending: true })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    setMatches(data || [])
    setInitialMatches(data || [])

    const nowTime = new Date().getTime()

    const currentMatch =
      data?.find(
        (m) =>
          m.deadline_at &&
          new Date(m.deadline_at).getTime() >= nowTime
      ) ?? data?.[data.length - 1]

    if (currentMatch) {
      setSelectedMatchday(currentMatch.matchday)
    }

    setLoading(false)
  }

  const getCountdown = (deadline: string | null) => {
    if (!deadline) return 'Keine Deadline'

    const diff = new Date(deadline).getTime() - now.getTime()

    if (diff <= 0) return 'Deadline vorbei'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)

    return `${days}T ${hours}h ${minutes}m`
  }

  const isDeadlinePassed = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline).getTime() <= now.getTime()
  }

  const canEditMatch = (match: any) => {
    const isUnlocked = unlockedMatchdays.includes(match.matchday)

    if (isUnlocked) {
      return false
    }

    const deadlinePassed = isDeadlinePassed(match.deadline_at)

    if (!deadlinePassed) {
      return true
    }

    const initialMatch = initialMatches.find(
      (m) => m.match_id === match.match_id
    )

    const alreadySaved =
      initialMatch?.pred_home !== null &&
      initialMatch?.pred_away !== null

    return !alreadySaved
  }

  const handleChange = (matchId: string, field: string, value: string) => {
    setSavedMessage('')

    setMatches((prev) =>
      prev.map((m) =>
        m.match_id === matchId
          ? {
              ...m,
              [field]: value === '' ? null : Number(value),
            }
          : m
      )
    )
  }

  async function saveMatchday() {
    const currentMatches = matches.filter(
      (m) => m.matchday === selectedMatchday
    )

    const incomplete = currentMatches.some(
      (m) =>
        canEditMatch(m) &&
        (m.pred_home === null || m.pred_away === null)
    )

    if (incomplete) {
      alert('Bitte alle offenen Tipps für diesen Spieltag ausfüllen.')
      return
    }

    setSaving(true)
    setSavedMessage('')

    let latePenaltyNeeded = false
    let penaltyInfo: any = null

    const payload = currentMatches.map((match) => ({
      match_id: match.match_id,
      pred_home: match.pred_home,
      pred_away: match.pred_away,
    }))

    const { error } = await supabase.rpc('save_matchday_predictions', {
      p_matchday: selectedMatchday,
      p_predictions: payload,
    })

    if (error) {
      setSaving(false)
      alert(error.message)
      return
    }

    const deadlinePassed = currentMatches.some((match) =>
      isDeadlinePassed(match.deadline_at)
    )

    if (deadlinePassed) {
      const { error } = await supabase.rpc('create_late_tip_penalty', {
        p_season_id: seasonId,
        p_matchday: selectedMatchday,
        p_user_id: userId,
        p_placeholder_player_id: null,
      })

      if (error) {
        setSaving(false)
        alert(error.message)
        return
      }
    }

    if (latePenaltyNeeded && penaltyInfo) {
      const { error } = await supabase.rpc('create_late_tip_penalty', {
        p_season_id: seasonId,
        p_matchday: penaltyInfo.matchday,
        p_user_id: userId,
        p_placeholder_player_id: null,
      })

      if (error) {
        setSaving(false)
        alert(error.message)
        return
      }
    }

    setSavedMessage(
      latePenaltyNeeded
        ? 'Tipps gespeichert. Wegen verspäteter Abgabe wurde 1 € Strafe eingetragen.'
        : 'Tipps gespeichert.'
    )

    await load()
    setSaving(false)
  }

  if (loading) {
    return (
      <>
        <NavBar />

        <main className="page-shell" style={{ maxWidth: 980 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Tipps...
          </section>
        </main>
      </>
    )
  }

  const matchdays = [...new Set(matches.map((m) => m.matchday))]
  const filteredMatches = matches.filter((m) => m.matchday === selectedMatchday)
  const deadline = filteredMatches[0]?.deadline_at ?? null
  const deadlinePassed = isDeadlinePassed(deadline)

  const editableMatches = filteredMatches.filter(canEditMatch)
  const lockedMatches = filteredMatches.filter((m) => !canEditMatch(m))

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 980 }}>
        <section
          className="card"
          style={{
            padding: isMobile ? 18 : 28,
            marginBottom: 22,
            background: deadlinePassed
              ? 'linear-gradient(135deg, #fff7ed, #ffedd5)'
              : 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
            border: deadlinePassed
              ? '1px solid #fdba74'
              : '1px solid #86efac',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.72)',
                  fontWeight: 800,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                ⚽ Tippspiel
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? 28 : 40,
                  lineHeight: 1,
                  fontWeight: 900,
                  color: '#0f172a',
                }}
              >
                Spieltag {selectedMatchday}
              </h1>

              {activeSeasonName && (
                <div
                  style={{
                    marginTop: 12,
                    color: '#475569',
                    fontWeight: 700,
                  }}
                >
                  Saison: {activeSeasonName}
                </div>
              )}
            </div>

            <div
              style={{
                minWidth: isMobile ? '100%' : 320,
                flex: 1,
                maxWidth: isMobile ? '100%' : 420,
                background: 'rgba(255,255,255,0.82)',
                borderRadius: 18,
                padding: 18,
                border: '1px solid rgba(255,255,255,0.9)',
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#64748b',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                  }}
                >
                  Spieltag wählen
                </div>

                <select
                  value={selectedMatchday}
                  onChange={(e) => {
                    setSelectedMatchday(Number(e.target.value))
                    setSavedMessage('')
                  }}
                  style={selectStyle}
                >
                  {matchdays.map((md) => (
                    <option key={md} value={md}>
                      Spieltag {md}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <InfoRow
                  label="Deadline"
                  value={
                    deadline
                      ? new Date(deadline).toLocaleString()
                      : 'Keine Deadline'
                  }
                />

                <InfoRow
                  label="Countdown"
                  value={getCountdown(deadline)}
                  strong
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {!deadlinePassed && (
              <StatusBox
                color="#166534"
                background="#dcfce7"
                text="Du kannst deine Tipps bis zur Deadline beliebig ändern."
              />
            )}

            {deadlinePassed && editableMatches.length > 0 && (
              <StatusBox
                color="#b45309"
                background="#fef3c7"
                text="Deadline vorbei: Fehlende Tipps können einmalig nachgetragen werden."
              />
            )}

            {deadlinePassed && editableMatches.length === 0 && (
              <StatusBox
                color="#475569"
                background="#e2e8f0"
                text="Deadline vorbei: Deine Tipps sind gesperrt."
              />
            )}
          </div>
        </section>

        {filteredMatches.length === 0 ? (
          <section className="card" style={{ padding: 22 }}>
            Keine Spiele für diesen Spieltag gefunden.
          </section>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 14 }}>
              {filteredMatches.map((match) => {
                const editable = canEditMatch(match)
                const locked = !editable

                return (
                  <div
                    key={match.match_id}
                    className="card"
                    style={{
                      padding: isMobile ? 16 : 20,
                      background: locked
                        ? 'linear-gradient(135deg, #f8fafc, #f1f5f9)'
                        : 'linear-gradient(135deg, #ffffff, #f8fafc)',
                      border: locked
                        ? '1px solid #cbd5e1'
                        : '1px solid rgba(34,197,94,0.18)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: isMobile ? 8 : 12,
                        alignItems: 'center',
                        marginBottom: 18,
                      }}
                    >
                      <TeamLabel
                        name={match.home_team_name}
                        logoUrl={match.home_logo_url}
                      />

                      <div
                        style={{
                          width: isMobile ? 44 : 52,
                          height: isMobile ? 44 : 52,
                          borderRadius: 18,
                          background: '#0f172a',
                          color: 'white',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: 14,
                        }}
                      >
                        VS
                      </div>

                      <TeamLabel
                        name={match.away_team_name}
                        logoUrl={match.away_logo_url}
                        alignRight
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        disabled={locked}
                        value={match.pred_home ?? ''}
                        onChange={(e) =>
                          handleChange(
                            match.match_id,
                            'pred_home',
                            e.target.value
                          )
                        }
                        style={scoreInputStyle}
                      />

                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                          color: '#0f172a',
                        }}
                      >
                        :
                      </div>

                      <input
                        type="number"
                        min="0"
                        disabled={locked}
                        value={match.pred_away ?? ''}
                        onChange={(e) =>
                          handleChange(
                            match.match_id,
                            'pred_away',
                            e.target.value
                          )
                        }
                        style={scoreInputStyle}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        {locked && (
                          <Badge
                            text="Gesperrt"
                            background="#e2e8f0"
                            color="#475569"
                          />
                        )}

                        {deadlinePassed && editable && (
                          <Badge
                            text="Nachtrag möglich"
                            background="#fef3c7"
                            color="#b45309"
                          />
                        )}
                      </div>

                      {match.points !== null && (
                        <div
                          style={{
                            fontWeight: 800,
                            color: '#0f172a',
                          }}
                        >
                          {match.points} Punkte
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="card"
              style={{
                marginTop: 20,
                padding: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={saveMatchday}
                disabled={saving || editableMatches.length === 0}
                style={{
                  minHeight: 48,
                  padding: '0 22px',
                  borderRadius: 999,
                  border: '0',
                  background:
                    saving || editableMatches.length === 0
                      ? '#cbd5e1'
                      : 'linear-gradient(135deg, #16a34a, #047857)',
                  color: 'white',
                  fontWeight: 900,
                  cursor:
                    saving || editableMatches.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  boxShadow:
                    saving || editableMatches.length === 0
                      ? 'none'
                      : '0 12px 26px rgba(22,163,74,0.25)',
                }}
              >
                {saving ? 'Speichert...' : 'Spieltag speichern'}
              </button>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {savedMessage && (
                  <Badge
                    text={savedMessage}
                    background="#dcfce7"
                    color="#166534"
                  />
                )}

                {lockedMatches.length > 0 && (
                  <Badge
                    text={`${lockedMatches.length} Spiel(e) gesperrt`}
                    background="#e2e8f0"
                    color="#475569"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}

function TeamLabel({
  name,
  logoUrl,
  alignRight,
}: {
  name: string
  logoUrl: string | null
  alignRight?: boolean
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        gap: 8,
        textAlign: alignRight ? 'right' : 'left',
      }}
    >
      {!alignRight && logoUrl && (
        <img
          src={logoUrl}
          alt=""
          style={{
            width: 30,
            height: 30,
            objectFit: 'contain',
            flexShrink: 0,
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}

      <strong
        style={{
          minWidth: 0,
          fontSize: 14,
          color: '#0f172a',
          lineHeight: 1.25,
          overflowWrap: 'anywhere',
        }}
      >
        {name}
      </strong>

      {alignRight && logoUrl && (
        <img
          src={logoUrl}
          alt=""
          style={{
            width: 30,
            height: 30,
            objectFit: 'contain',
            flexShrink: 0,
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}

function Badge({
  text,
  background,
  color,
}: {
  text: string
  background: string
  color: string
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        background,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {text}
    </div>
  )
}

function StatusBox({
  text,
  background,
  color,
}: {
  text: string
  background: string
  color: string
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background,
        color,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  )
}

function InfoRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: strong ? 16 : 14,
        fontWeight: strong ? 900 : 700,
      }}
    >
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: 'white',
  padding: '0 14px',
  fontWeight: 700,
  fontSize: 15,
}

const scoreInputStyle: React.CSSProperties = {
  width: 82,
  height: 72,
  borderRadius: 18,
  border: '2px solid #cbd5e1',
  textAlign: 'center',
  fontWeight: 900,
  fontSize: 28,
  background: 'white',
  color: '#0f172a',
}