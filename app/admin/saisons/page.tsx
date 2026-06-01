'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Season = {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export default function AdminSaisonsPage() {
  const router = useRouter()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [newSeasonName, setNewSeasonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadSeasons()
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

  async function loadSeasons() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('seasons')
      .select('id, name, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setSeasons(data || [])
    setLoading(false)
  }

  async function createSeason() {
    const name = newSeasonName.trim()

    if (!name) return

    const confirmed = window.confirm(
      `Neue Saison "${name}" erstellen?\n\nDabei wird die bisher aktive Saison deaktiviert, die neue Saison aktiviert und der Spielplan kopiert.`
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase.rpc('create_new_season', {
      new_season_name: name,
    })

    if (error) {
      setMessage(`Fehler: ${error.message}`)
      setSaving(false)
      return
    }

    setNewSeasonName('')
    setMessage(
      'Neue Saison wurde erstellt, aktiviert und der Spielplan wurde kopiert.'
    )

    await loadSeasons()
    setSaving(false)
  }

  async function activateSeason(seasonId: string) {
    const confirmed = window.confirm(
      'Diese Saison wirklich aktiv setzen? Dadurch wechseln alle aktiven Ansichten auf diese Saison.'
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error: resetError } = await supabase
      .from('seasons')
      .update({ is_active: false })
      .neq('id', seasonId)

    if (resetError) {
      setMessage(resetError.message)
      setSaving(false)
      return
    }

    const { error: activeError } = await supabase
      .from('seasons')
      .update({ is_active: true })
      .eq('id', seasonId)

    if (activeError) {
      setMessage(activeError.message)
      setSaving(false)
      return
    }

    setMessage('Aktive Saison geändert.')
    await loadSeasons()
    setSaving(false)
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <h1>Saisons verwalten</h1>

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <section
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <h2>Neue Saison erstellen & aktivieren</h2>

              <p style={{ color: '#666' }}>
                Erstellt eine neue Saison, setzt sie direkt aktiv und kopiert
                den Spielplan sowie die Fantasy-Duelle aus der aktuell aktiven
                Saison.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="z. B. 2026/27"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  style={{ padding: 8 }}
                />

                <button onClick={createSeason} disabled={saving}>
                  {saving ? 'Erstellt...' : 'Saison erstellen & aktivieren'}
                </button>
              </div>
            </section>

            {message && <p>{message}</p>}

            <section
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 20,
              }}
            >
              <h2>Alle Saisons</h2>

              <div style={{ display: 'grid', gap: 12 }}>
                {seasons.map((season) => (
                  <div
                    key={season.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      background: season.is_active ? '#f0fff4' : 'white',
                    }}
                  >
                    <div>
                      <strong>{season.name}</strong>

                      {season.is_active && (
                        <span style={{ marginLeft: 10, color: 'green' }}>
                          aktiv
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => activateSeason(season.id)}
                      disabled={saving || season.is_active}
                    >
                      {season.is_active ? 'Aktiv' : 'Aktiv setzen'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}