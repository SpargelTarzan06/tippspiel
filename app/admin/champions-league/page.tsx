'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Team = {
  id: string
  name: string
}

type Group = {
  id: string
  name: string
  phase: string
}

type Assignment = {
  group_id: string
  team_id: string
}
type ClMatch = {
  id: string
  matchday: number
  phase: string
  home_team_id: string
  away_team_id: string
  home_tip_points: number | null
  away_tip_points: number | null
}
export default function ChampionsLeagueAdminPage() {
  const [seasonId, setSeasonId] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [matches, setMatches] = useState<ClMatch[]>([])
  const [newMatchday, setNewMatchday] = useState(7)
  const [newPhase, setNewPhase] = useState('preliminary')
  const [newHomeTeamId, setNewHomeTeamId] = useState('')
  const [newAwayTeamId, setNewAwayTeamId] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setLoading(false)
      return
    }

    setSeasonId(seasonData.id)

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .order('name')

    setTeams(teamsData || [])

    const { data: groupsData } = await supabase
      .from('cl_groups')
      .select('id, name, phase')
      .eq('season_id', seasonData.id)
      .order('phase')
      .order('name')

    setGroups(groupsData || [])

    const { data: assignmentData } = await supabase
      .from('cl_group_teams')
      .select('group_id, team_id')
      .eq('season_id', seasonData.id)

    setAssignments(assignmentData || [])
    const { data: matchesData } = await supabase
    .from('cl_matches')
    .select(
      'id, matchday, phase, home_team_id, away_team_id, home_tip_points, away_tip_points'
    )
    .eq('season_id', seasonData.id)
    .order('matchday', { ascending: true })

setMatches(matchesData || [])
    setLoading(false)
  }

  function getTeamForGroup(groupId: string, slot: number) {
    const groupAssignments = assignments.filter(
      (a) => a.group_id === groupId
    )

    return groupAssignments[slot]?.team_id ?? ''
  }

  function updateAssignment(
    groupId: string,
    slot: number,
    teamId: string
  ) {
    setAssignments((prev) => {
      const filtered = prev.filter((a) => {
        const groupAssignments = prev.filter(
          (x) => x.group_id === groupId
        )

        return a !== groupAssignments[slot]
      })

      if (!teamId) {
        return filtered
      }

      return [
        ...filtered,
        {
          group_id: groupId,
          team_id: teamId,
        },
      ]
    })
  }

  async function saveAssignments() {
    setSaving(true)
    setMessage('')
    
    
    const { error: deleteError } = await supabase
      .from('cl_group_teams')
      .delete()
      .eq('season_id', seasonId)

    if (deleteError) {
      setMessage(deleteError.message)
      setSaving(false)
      return
    }

    for (const assignment of assignments) {
      const { error } = await supabase
        .from('cl_group_teams')
        .insert({
          season_id: seasonId,
          group_id: assignment.group_id,
          team_id: assignment.team_id,
        })

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }
    }

    setMessage('Gruppen gespeichert.')
    setSaving(false)
    await load()
  }
  async function addClMatch() {
  setMessage('')

  if (!newHomeTeamId || !newAwayTeamId) {
    setMessage('Bitte Heimteam und Auswärtsteam auswählen.')
    return
  }

  if (newHomeTeamId === newAwayTeamId) {
    setMessage('Heimteam und Auswärtsteam dürfen nicht identisch sein.')
    return
  }

  const { error } = await supabase.from('cl_matches').insert({
    season_id: seasonId,
    matchday: newMatchday,
    phase: newPhase,
    home_team_id: newHomeTeamId,
    away_team_id: newAwayTeamId,
    home_tip_points: 0,
    away_tip_points: 0,
    home_correct_results: 0,
    away_correct_results: 0,
    home_two_point_tips: 0,
    away_two_point_tips: 0,
    home_scoring_tips: 0,
    away_scoring_tips: 0,
    home_match_points: 0,
    away_match_points: 0,
    finished: false,
  })

  if (error) {
    setMessage(error.message)
    return
  }

  setMessage('CL-Duell angelegt.')
  setNewHomeTeamId('')
  setNewAwayTeamId('')
  await load()
}

async function calculateClMatchday(matchday: number) {
  setCalculating(true)
  setMessage('')

  const { data: seasonData } = await supabase
    .from('seasons')
    .select('name')
    .eq('id', seasonId)
    .single()

  if (!seasonData) {
    setMessage('Saison nicht gefunden.')
    setCalculating(false)
    return
  }

  const { error } = await supabase.rpc('calculate_cl_matchday', {
    target_season_name: seasonData.name,
    target_matchday: matchday,
  })

  if (error) {
    setMessage(error.message)
    setCalculating(false)
    return
  }

  setMessage(`${getClMatchdayLabel(matchday, matches.find((m) => m.matchday === matchday)?.phase ?? 'preliminary')} wurde berechnet.`)
  setCalculating(false)
  await load()
}

async function deleteClMatch(matchId: string) {
  const { error } = await supabase
    .from('cl_matches')
    .delete()
    .eq('id', matchId)

  if (error) {
    setMessage(error.message)
    return
  }

  setMessage('CL-Duell gelöscht.')
  await load()
}

function getTeamName(teamId: string) {
  return teams.find((team) => team.id === teamId)?.name ?? 'Unbekannt'
}

function getPhaseText(phase: string) {
  if (phase === 'preliminary') return 'Vorrunde'
  if (phase === 'main') return 'Hauptrunde'
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return phase
}
function getClMatchdayLabel(matchday: number, phase: string) {
  if (phase === 'preliminary') return `Vorrunde ${matchday - 6}. Spieltag`
  if (phase === 'main') return `Hauptrunde ${matchday - 16}. Spieltag`
  if (phase === 'semifinal') return 'Halbfinale'
  if (phase === 'final') return 'Finale'
  return `CL-Spieltag ${matchday}`
}
async function generatePreliminaryMatches() {
  setSaving(true)
  setMessage('')
  const confirmed = window.confirm(
  'Achtung: Der komplette Vorrunden-Spielplan wird neu erzeugt. Bestehende Vorrunden-Duelle werden gelöscht. Fortfahren?'
)

if (!confirmed) {
  setSaving(false)
  return
}
  const { error } = await supabase.rpc('generate_cl_preliminary_matches', {
    target_season_id: seasonId,
  })

  if (error) {
    setMessage(error.message)
    setSaving(false)
    return
  }

  setMessage('Vorrunden-Spielplan wurde automatisch erzeugt.')
  setSaving(false)
  await load()
}
async function generateMainRoundMatches() {
  setSaving(true)
  setMessage('')
  const confirmed = window.confirm(
  'Achtung: Der komplette Hauptrunden-Spielplan wird neu erzeugt. Bestehende Hauptrunden-Duelle werden gelöscht. Fortfahren?'
)

if (!confirmed) {
  setSaving(false)
  return
}
  const { error } = await supabase.rpc(
    'generate_cl_main_round_matches',
    {
      target_season_id: seasonId,
    }
  )

  if (error) {
    setMessage(error.message)
    setSaving(false)
    return
  }

  setMessage('Hauptrunden-Spielplan wurde erzeugt.')
  setSaving(false)
  await load()
}


async function generateSemifinalMatches() {
  setSaving(true)
  setMessage('')
  const confirmed = window.confirm(
  'Achtung: Das Halbfinale wird neu erzeugt. Bestehende Halbfinal-Duelle werden gelöscht. Fortfahren?'
)

if (!confirmed) {
  setSaving(false)
  return
}
  const { error } = await supabase.rpc('generate_cl_semifinal_matches', {
    target_season_id: seasonId,
  })

  if (error) {
    setMessage(error.message)
    setSaving(false)
    return
  }

  setMessage('Halbfinale wurde erzeugt.')
  setSaving(false)
  await load()
}

async function generateFinalMatches() {
  setSaving(true)
  setMessage('')
  const confirmed = window.confirm(
  'Achtung: Das Finale wird neu erzeugt. Bestehende Final-Duelle werden gelöscht. Fortfahren?'
)

if (!confirmed) {
  setSaving(false)
  return
}
  const { error } = await supabase.rpc('generate_cl_final_matches', {
    target_season_id: seasonId,
  })

  if (error) {
    setMessage(error.message)
    setSaving(false)
    return
  }

  setMessage('Finale wurde erzeugt.')
  setSaving(false)
  await load()
}


  if (loading) {
    return <main style={{ padding: 20 }}>Lade...</main>
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <h1>Champions League verwalten</h1>

        {message && <p>{message}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {groups.map((group) => (
            <section
              key={group.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 16,
              }}
            >
              <h2>
              {group.name}{' '}
              <span style={{ color: '#666', fontSize: 14 }}>
                ({group.phase === 'main' ? 'Hauptrunde' : 'Vorrunde'})
              </span>
            </h2>

              <div style={{ display: 'grid', gap: 10 }}>
                {Array.from(
                { length: group.phase === 'main' ? 5 : 6 },
                (_, i) => i
              ).map((slot) => (
                  <select
                    key={slot}
                    value={getTeamForGroup(group.id, slot)}
                    onChange={(e) =>
                      updateAssignment(
                        group.id,
                        slot,
                        e.target.value
                      )
                    }
                    style={{
                      padding: 8,
                      width: '100%',
                    }}
                  >
                    <option value="">Team auswählen</option>

                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </section>
          ))}
        </div>

        <button
          onClick={saveAssignments}
          disabled={saving}
          style={{
            marginTop: 24,
            padding: '10px 18px',
          }}
        >
          {saving ? 'Speichert...' : 'Gruppen speichern'}
        </button>
          <button
  onClick={generatePreliminaryMatches}
  disabled={saving}
  style={{
    marginTop: 12,
    marginLeft: 12,
    padding: '10px 18px',
  }}
>
  Vorrunden-Spielplan erzeugen
</button>
          
          <button
  onClick={generateMainRoundMatches}
  disabled={saving}
  style={{
    marginTop: 12,
    marginLeft: 12,
    padding: '10px 18px',
  }}
>
  Hauptrunden-Spielplan erzeugen
</button>
<button
  onClick={generateSemifinalMatches}
  disabled={saving}
  style={{
    marginTop: 12,
    marginLeft: 12,
    padding: '10px 18px',
  }}
>
  Halbfinale erzeugen
</button>

<button
  onClick={generateFinalMatches}
  disabled={saving}
  style={{
    marginTop: 12,
    marginLeft: 12,
    padding: '10px 18px',
  }}
>
  Finale erzeugen
</button>
          
          <section style={{ marginTop: 40 }}>
  <h2>CL-Duelle manuell anlegen</h2>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '120px 180px 1fr 1fr auto',
      gap: 10,
      alignItems: 'center',
    }}
  >
    <select
      value={newMatchday}
      onChange={(e) => setNewMatchday(Number(e.target.value))}
      style={{ padding: 8 }}
    >
      {Array.from({ length: 28 }, (_, i) => i + 7).map((day) => (
        <option key={day} value={day}>
          {getClMatchdayLabel(day, newPhase)}
        </option>
      ))}
    </select>

    <select
      value={newPhase}
      onChange={(e) => setNewPhase(e.target.value)}
      style={{ padding: 8 }}
    >
      <option value="preliminary">Vorrunde</option>
      <option value="main">Hauptrunde</option>
      <option value="semifinal">Halbfinale</option>
      <option value="final">Finale</option>
    </select>

    <select
      value={newHomeTeamId}
      onChange={(e) => setNewHomeTeamId(e.target.value)}
      style={{ padding: 8 }}
    >
      <option value="">Heimteam</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>

    <select
      value={newAwayTeamId}
      onChange={(e) => setNewAwayTeamId(e.target.value)}
      style={{ padding: 8 }}
    >
      <option value="">Auswärtsteam</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>

    <button onClick={addClMatch} style={{ padding: '9px 14px' }}>
      Duell anlegen
    </button>
  </div>
</section>

<section style={{ marginTop: 32 }}>
  <h2>CL-Spielplan</h2>

  {matches.length === 0 ? (
    <p>Noch keine CL-Duelle angelegt.</p>
  ) : (
    <div style={{ display: 'grid', gap: 10 }}>
      {matches.map((match) => (
        <div
          key={match.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 130px 1fr auto auto',
            gap: 10,
            alignItems: 'center',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 10,
            background: '#fafafa',
          }}
        >
          <strong>{getClMatchdayLabel(match.matchday, match.phase)}</strong>

          <span>{getPhaseText(match.phase)}</span>

          <span>
            {getTeamName(match.home_team_id)} -{' '}
            {getTeamName(match.away_team_id)}
          </span>

          <strong>
            {match.home_tip_points ?? 0}:{match.away_tip_points ?? 0}
          </strong>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => calculateClMatchday(match.matchday)}
              disabled={calculating}
            >
              Berechnen
            </button>

            <button onClick={() => deleteClMatch(match.id)}>
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      </main>
    </>
  )
}