'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Profile = {
  id: string
  display_name: string
  email: string | null
  role: string | null
}

type Team = {
  id: string
  name: string
}

type Season = {
  id: string
  name: string
}

export default function TeamsZuweisenPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])

  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedSeasonId) {
      loadSeasonTeams(selectedSeasonId)
      loadAssignments(selectedSeasonId)
    }
  }, [selectedSeasonId])

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
      router.push('/')
    }
  }

  async function loadInitialData() {
    setLoading(true)
    setMessage('')

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, email, role')
      .order('display_name')

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id, name')
      .order('created_at', { ascending: false })

    setProfiles(profilesData || [])
    setSeasons(seasonsData || [])

    const activeSeason = seasonsData?.[0]
    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id)
    }

    setLoading(false)
  }

  async function loadSeasonTeams(seasonId: string) {
    const { data, error } = await supabase
      .from('season_teams')
      .select('team_id, is_active, team:teams(id, name)')
      .eq('season_id', seasonId)
      .eq('is_active', true)

    if (error) {
      setMessage(error.message)
      setTeams([])
      return
    }

    const rows = (data || [])
      .map((row: any) => ({
        id: row.team?.id ?? row.team_id,
        name: row.team?.name ?? 'Unbekanntes Team',
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setTeams(rows)
  }

  async function loadAssignments(seasonId: string) {
    const { data, error } = await supabase
      .from('user_team_assignments')
      .select('user_id, team_id')
      .eq('season_id', seasonId)

    if (error) {
      setMessage(error.message)
      setAssignments({})
      return
    }

    const map: Record<string, string> = {}

    for (const row of data || []) {
      map[row.user_id] = row.team_id
    }

    setAssignments(map)
  }

  function updateAssignment(userId: string, teamId: string) {
    setAssignments((prev) => ({
      ...prev,
      [userId]: teamId,
    }))
  }

  async function saveAssignments() {
    if (!selectedSeasonId) return

    setSaving(true)
    setMessage('')

    const selectedTeamIds = Object.values(assignments).filter(Boolean)
    const duplicates = selectedTeamIds.filter(
      (teamId, index) => selectedTeamIds.indexOf(teamId) !== index
    )

    if (duplicates.length > 0) {
      setMessage('Fehler: Ein Team wurde mehreren Spielern zugeordnet.')
      setSaving(false)
      return
    }

    const rows = Object.entries(assignments)
      .filter(([, team_id]) => team_id)
      .map(([user_id, team_id]) => ({
        season_id: selectedSeasonId,
        user_id,
        team_id,
      }))

    const { error: deleteError } = await supabase
      .from('user_team_assignments')
      .delete()
      .eq('season_id', selectedSeasonId)

    if (deleteError) {
      setMessage(deleteError.message)
      setSaving(false)
      return
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('user_team_assignments')
        .insert(rows)

      if (insertError) {
        setMessage(insertError.message)
        setSaving(false)
        return
      }
    }

    setMessage('Zuweisungen gespeichert.')
    await loadAssignments(selectedSeasonId)
    setSaving(false)
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <h1>Teams zuweisen</h1>

        <p style={{ color: '#666' }}>
          Diese Seite nutzt nur noch echte User. Platzhalter werden nicht mehr verwendet.
        </p>

        {loading ? (
          <p>Lade...</p>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <label>
                Saison:{' '}
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {message && <p style={{ marginBottom: 20 }}>{message}</p>}

            <div style={{ display: 'grid', gap: 12 }}>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: 16,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{profile.display_name}</div>
                    <div style={{ fontSize: 14, color: '#666' }}>
                      {profile.email ?? 'Keine E-Mail'}
                    </div>
                  </div>

                  <select
                    value={assignments[profile.id] || ''}
                    onChange={(e) => updateAssignment(profile.id, e.target.value)}
                    style={{ padding: 8 }}
                  >
                    <option value="">Kein Team</option>

                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={saveAssignments}
              disabled={saving}
              style={{
                marginTop: 24,
                padding: '10px 18px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Speichert...' : 'Zuweisungen speichern'}
            </button>
          </>
        )}
      </main>
    </>
  )
}
