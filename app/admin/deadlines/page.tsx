'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type DeadlineMap = Record<number, string>

export default function AdminDeadlinesPage() {
  const [season, setSeason] = useState<any>(null)
  const [deadlines, setDeadlines] = useState<DeadlineMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadData()
  }, [])

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('Admin check failed:', error)
      return
    }

    if (profileData?.role !== 'admin') {
      window.location.href = '/'
    }
  }

  async function loadData() {
    setLoading(true)
    setMessage('')

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

    setSeason(seasonData)

    const { data } = await supabase
      .from('matchday_deadlines')
      .select('matchday, deadline_at')
      .eq('season_id', seasonData.id)
      .order('matchday')

    const map: DeadlineMap = {}

    for (let i = 1; i <= 34; i++) {
      map[i] = ''
    }

    for (const row of data || []) {
      map[row.matchday] = row.deadline_at
        ? toDatetimeLocal(row.deadline_at)
        : ''
    }

    setDeadlines(map)
    setLoading(false)
  }

  function updateDeadline(matchday: number, value: string) {
    setDeadlines((prev) => ({
      ...prev,
      [matchday]: value,
    }))
  }

  async function saveDeadlines() {
    if (!season) return

    setSaving(true)
    setMessage('')

    const rows = Object.entries(deadlines)
      .filter(([, value]) => value)
      .map(([matchday, value]) => ({
        season_id: season.id,
        matchday: Number(matchday),
        deadline_at: new Date(value).toISOString(),
      }))

    const { error } = await supabase
      .from('matchday_deadlines')
      .upsert(rows, {
        onConflict: 'season_id,matchday',
      })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSaving(false)
      return
    }

    setMessage('Deadlines gespeichert.')
    setSaving(false)
    await loadData()
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1000 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Deadlines verwalten</h1>

            {season && (
              <div style={seasonPillStyle}>
                Aktive Saison: {season.name}
              </div>
            )}
          </div>
        </section>

        {message && (
          <div
            className="card"
            style={{
              padding: 14,
              marginBottom: 18,
              background: message.startsWith('Fehler') ? '#fff1f2' : '#f0fdf4',
              color: message.startsWith('Fehler') ? '#991b1b' : '#166534',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <section className="card" style={{ padding: 24 }}>
            Lade Deadlines...
          </section>
        ) : (
          <>
            <section className="card" style={{ overflow: 'hidden' }}>
              <div style={sectionHeaderStyle}>
                Bundesliga-Spieltage
              </div>

              <div style={deadlineGridStyle}>
                {Array.from({ length: 34 }, (_, i) => i + 1).map((matchday) => (
                  <label key={matchday} style={deadlineCardStyle}>
                    <div>
                      <div style={matchdayTitleStyle}>
                        {matchday}. Spieltag
                      </div>

                      <div style={matchdaySubtitleStyle}>
                        Tippabgabe bis
                      </div>
                    </div>

                    <input
                      type="datetime-local"
                      value={deadlines[matchday] || ''}
                      onChange={(e) =>
                        updateDeadline(matchday, e.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>
                ))}
              </div>
            </section>

            <div style={saveBarStyle}>
              <button
                onClick={saveDeadlines}
                disabled={saving}
                style={{
                  ...saveButtonStyle,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Speichert...' : 'Deadlines speichern'}
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}

function toDatetimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 24,
  padding: 24,
  marginBottom: 20,
  background: 'linear-gradient(135deg,#052e16,#166534)',
  color: 'white',
  boxShadow: '0 14px 34px rgba(15,23,42,0.10)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -90,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.13)',
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
}

const seasonPillStyle: React.CSSProperties = {
  marginTop: 12,
  color: 'rgba(255,255,255,0.86)',
  fontWeight: 850,
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg,#f8fafc,#ffffff)',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 950,
}

const deadlineGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
}

const deadlineCardStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '150px minmax(0,1fr)',
  gap: 14,
  alignItems: 'center',
  padding: 14,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
}

const matchdayTitleStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 950,
}

const matchdaySubtitleStyle: React.CSSProperties = {
  marginTop: 3,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 750,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
}

const saveBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 12,
  zIndex: 20,
  marginTop: 18,
  display: 'flex',
  justifyContent: 'flex-end',
}

const saveButtonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 999,
  padding: '0 22px',
  color: 'white',
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(22,163,74,0.22)',
}