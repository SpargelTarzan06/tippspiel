'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

export default function TippstatusPage() {
  const router = useRouter()

  const [seasonId, setSeasonId] = useState('')
  const [seasonName, setSeasonName] = useState('')

  const [selectedMatchday, setSelectedMatchday] = useState(1)
  const [matchdays, setMatchdays] = useState<number[]>([])

  const [allRows, setAllRows] = useState<any[]>([])
  const [lockedMatchdays, setLockedMatchdays] = useState<Record<number, boolean>>(
    {}
  )

  const [loading, setLoading] = useState(true)
  const [savingUnlock, setSavingUnlock] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMessage('')

const { data: userData } = await supabase.auth.getUser()

if (!userData.user) {
  router.push('/login')
  return
}

const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userData.user.id)
  .maybeSingle()

if (profileError) {
  console.error(profileError)
  setLoading(false)
  return
}

if (profileData?.role !== 'admin') {
  router.push('/')
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
    setSeasonName(seasonData.name)

    const { data: statusData, error: statusError } = await supabase
      .from('prediction_status_by_matchday')
      .select('*')
      .order('matchday', { ascending: true })
      .order('has_submitted', { ascending: true })
      .order('player_name', { ascending: true })

    if (statusError) {
      setMessage(statusError.message)
      setLoading(false)
      return
    }

    const rows = statusData || []
    setAllRows(rows)

    const days = [...new Set(rows.map((row) => row.matchday))].filter(Boolean)
    setMatchdays(days)

    const firstOpenDay =
      rows.find((row) => !row.has_submitted)?.matchday ??
      days[days.length - 1] ??
      1

    setSelectedMatchday(firstOpenDay)

    const { data: lockData } = await supabase
      .from('matchday_locks')
      .select('matchday, is_unlocked')
      .eq('season_id', seasonData.id)

    const lockMap = Object.fromEntries(
      (lockData || []).map((row) => [row.matchday, row.is_unlocked])
    )

    setLockedMatchdays(lockMap)

    setLoading(false)
  }

  async function unlockMatchday() {
    if (!seasonId || !selectedMatchday) return

    const confirmed = window.confirm(
      `Spieltag ${selectedMatchday} wirklich freischalten? Danach sind die Tipps gesperrt und die Duelle sichtbar.`
    )

    if (!confirmed) return

    setSavingUnlock(true)
    setMessage('')

    const { error } = await supabase.rpc('unlock_matchday_tips', {
      p_season_id: seasonId,
      p_matchday: selectedMatchday,
    })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSavingUnlock(false)
      return
    }

    setMessage(`Spieltag ${selectedMatchday} wurde freigeschaltet.`)

    await load()

    setSavingUnlock(false)
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Lade...</main>
  }

  const rows = allRows.filter((row) => row.matchday === selectedMatchday)
  const missing = rows.filter((row) => !row.has_submitted)
  const done = rows.filter((row) => row.has_submitted)
  const isUnlocked = Boolean(lockedMatchdays[selectedMatchday])

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1>Tippstatus</h1>

        {seasonName && (
          <p style={{ color: '#666' }}>Aktive Saison: {seasonName}</p>
        )}

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #ddd',
              background: '#f5f5f5',
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            border: '1px solid #ddd',
            borderRadius: 14,
            padding: 18,
            marginBottom: 24,
            background: isUnlocked ? '#f0fff4' : '#fff7ed',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <label>
                Spieltag:{' '}
                <select
                  value={selectedMatchday}
                  onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                  style={selectStyle}
                >
                  {matchdays.map((day) => (
                    <option key={day} value={day}>
                      {day}. Spieltag
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ marginTop: 10, color: '#666' }}>
                {done.length}/{rows.length} Teilnehmer vollständig getippt
              </div>
            </div>

            <div>
              {isUnlocked ? (
                <strong style={{ color: '#166534' }}>
                  Spieltag ist freigeschaltet
                </strong>
              ) : (
                <button
                  onClick={unlockMatchday}
                  disabled={savingUnlock}
                  style={unlockButtonStyle}
                >
                  {savingUnlock
                    ? 'Schaltet frei...'
                    : 'Spieltag freischalten'}
                </button>
              )}
            </div>
          </div>

          {!isUnlocked && (
            <p style={{ marginTop: 12, color: '#92400e', fontWeight: 700 }}>
              Freischalten bedeutet: Tipps werden gesperrt und die Duelle werden
              sichtbar.
            </p>
          )}
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
          }}
        >
          <StatusSection
            title={`Müssen noch tippen (${missing.length})`}
            rows={missing}
            color="#fff0f0"
          />

          <StatusSection
            title={`Bereits getippt (${done.length})`}
            rows={done}
            color="#f0fff4"
          />
        </div>
      </main>
    </>
  )
}

function StatusSection({
  title,
  rows,
  color,
}: {
  title: string
  rows: any[]
  color: string
}) {
  return (
    <section
      style={{
        border: '1px solid #ddd',
        borderRadius: 14,
        padding: 18,
        background: '#fafafa',
      }}
    >
      <h2>{title}</h2>

      {rows.length === 0 ? (
        <p>Keine Einträge.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div
              key={`${row.user_id}-${row.matchday}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr auto',
                gap: 10,
                alignItems: 'center',
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 10,
                background: color,
              }}
            >
              {row.logo_url ? (
                <img
                  src={row.logo_url}
                  alt=""
                  style={{
                    width: 28,
                    height: 28,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div />
              )}

              <div>
                <strong>{row.player_name}</strong>

                <div style={{ color: '#666', fontSize: 13 }}>
                  {row.team_name}
                  
                </div>
              </div>

              <strong>
                {row.submitted_tips}/{row.required_tips}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const selectStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: '1px solid #ccc',
}

const unlockButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #111',
  background: '#111',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
}