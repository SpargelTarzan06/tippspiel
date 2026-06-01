'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Team = {
  id: string
  name: string
}

type PlayerOption = {
  id: string
  display_name: string
  source: 'profile' | 'placeholder'
}

type Category = {
  id: string
  name: string
  answer_type: 'team' | 'text' | 'number'
  answer_count: number
  points_per_correct: number
  deadline_at: string | null
  is_active: boolean
}

type AnswerMap = Record<
  string,
  Record<
    number,
    {
      team_id: string | null
      text_answer: string
      number_answer: string
    }
  >
>

export default function AdminSondertippsEintragenPage() {
  const [season, setSeason] = useState<any>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedPlayerSource, setSelectedPlayerSource] =
    useState<'profile' | 'placeholder'>('profile')

  const [answers, setAnswers] = useState<AnswerMap>({})

  const [loading, setLoading] = useState(true)
  const [answersLoading, setAnswersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (season?.id && selectedPlayerId) {
      loadAnswers()
    }
  }, [season?.id, selectedPlayerId, selectedPlayerSource])

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

  async function loadInitialData() {
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

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .order('name')

    setTeams(teamsData || [])

    const { data: categoryData } = await supabase
      .from('special_bet_categories')
      .select('*')
      .eq('season_id', seasonData.id)
      .eq('is_active', true)
      .order('created_at')

    setCategories(categoryData || [])

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name')

    const { data: placeholderData } = await supabase
      .from('placeholder_players')
      .select('id, display_name')
      .order('display_name')

    const profilePlayers: PlayerOption[] =
      profileData?.map((profile) => ({
        id: profile.id,
        display_name: profile.display_name,
        source: 'profile',
      })) || []

    const placeholderPlayers: PlayerOption[] =
      placeholderData?.map((player) => ({
        id: player.id,
        display_name: `${player.display_name} (Platzhalter)`,
        source: 'placeholder',
      })) || []

    const allPlayers = [...profilePlayers, ...placeholderPlayers]

    setPlayers(allPlayers)

    if (allPlayers.length > 0) {
      setSelectedPlayerId(allPlayers[0].id)
      setSelectedPlayerSource(allPlayers[0].source)
    }

    setLoading(false)
  }

  async function loadAnswers() {
    if (!season?.id || !selectedPlayerId) return

    setAnswersLoading(true)
    setMessage('')

    let query = supabase
      .from('special_bet_answers')
      .select('*')
      .eq('season_id', season.id)

    if (selectedPlayerSource === 'profile') {
      query = query.eq('user_id', selectedPlayerId)
    } else {
      query = query.eq('placeholder_player_id', selectedPlayerId)
    }

    const { data, error } = await query

    if (error) {
      setMessage(`Fehler beim Laden: ${error.message}`)
      setAnswersLoading(false)
      return
    }

    const map: AnswerMap = {}

    for (const answer of data || []) {
      if (!map[answer.category_id]) {
        map[answer.category_id] = {}
      }

      map[answer.category_id][answer.answer_index] = {
        team_id: answer.team_id,
        text_answer: answer.text_answer ?? '',
        number_answer:
          answer.number_answer === null || answer.number_answer === undefined
            ? ''
            : String(answer.number_answer),
      }
    }

    setAnswers(map)
    setAnswersLoading(false)
  }

  function handlePlayerChange(value: string) {
    const [source, id] = value.split(':')

    setSelectedPlayerSource(source as 'profile' | 'placeholder')
    setSelectedPlayerId(id)
    setAnswers({})
    setMessage('')
  }

  function updateAnswer(
    categoryId: string,
    index: number,
    field: 'team_id' | 'text_answer' | 'number_answer',
    value: string
  ) {
    setAnswers((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [index]: {
          team_id: prev[categoryId]?.[index]?.team_id ?? null,
          text_answer: prev[categoryId]?.[index]?.text_answer ?? '',
          number_answer: prev[categoryId]?.[index]?.number_answer ?? '',
          [field]: value,
        },
      },
    }))
  }

  async function saveAnswers() {
    if (!season?.id || !selectedPlayerId) return

    setSaving(true)
    setMessage('')

    for (const category of categories) {
      for (let i = 1; i <= category.answer_count; i++) {
        const answer = answers[category.id]?.[i]

        if (!answer) continue

        const hasValue =
          (category.answer_type === 'team' && answer.team_id) ||
          (category.answer_type === 'text' && answer.text_answer.trim()) ||
          (category.answer_type === 'number' && answer.number_answer !== '')

        if (!hasValue) continue

const row: any = {
  season_id: season.id,
  category_id: category.id,
  user_id: selectedPlayerSource === 'profile' ? selectedPlayerId : null,
  placeholder_player_id:
    selectedPlayerSource === 'placeholder' ? selectedPlayerId : null,
  answer_index: i,
  team_id: category.answer_type === 'team' ? answer.team_id : null,
  text_answer:
    category.answer_type === 'text' ? answer.text_answer.trim() : null,
  number_answer:
    category.answer_type === 'number'
      ? Number(answer.number_answer)
      : null,
  updated_at: new Date().toISOString(),
}

        const onConflict =
          selectedPlayerSource === 'profile'
            ? 'category_id,user_id,answer_index'
            : 'category_id,placeholder_player_id,answer_index'

        const { error } = await supabase
          .from('special_bet_answers')
          .upsert(row, {
            onConflict,
          })

        if (error) {
          setMessage(`Fehler: ${error.message}`)
          setSaving(false)
          return
        }
      }
    }

    setMessage('Sondertipps gespeichert.')
    setSaving(false)
    await loadAnswers()
  }

  const selectedValue = `${selectedPlayerSource}:${selectedPlayerId}`

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1050, paddingBottom: 96 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Sondertipps eintragen</h1>

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
              background: message.startsWith('Fehler') || message.includes('Keine')
                ? '#fff1f2'
                : '#f0fdf4',
              color: message.startsWith('Fehler') || message.includes('Keine')
                ? '#991b1b'
                : '#166534',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <section className="card" style={{ padding: 24 }}>
            Lade Sondertipps...
          </section>
        ) : (
          <>
            <section className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
              <div style={sectionHeaderStyle}>Spieler auswählen</div>

              <div style={topControlsStyle}>
                <label style={labelStyle}>
                  Spieler
                  <select
                    value={selectedValue}
                    onChange={(e) => handlePlayerChange(e.target.value)}
                    style={selectStyle}
                  >
                    {players.map((player) => (
                      <option
                        key={`${player.source}:${player.id}`}
                        value={`${player.source}:${player.id}`}
                      >
                        {player.display_name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={saveAnswers}
                  disabled={saving || answersLoading}
                  style={{
                    ...saveButtonStyle,
                    opacity: saving || answersLoading ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Speichert...' : 'Sondertipps speichern'}
                </button>
              </div>
            </section>

            {answersLoading ? (
              <section className="card" style={{ padding: 24 }}>
                Lade Sondertipps...
              </section>
            ) : categories.length === 0 ? (
              <InfoCard text="Keine aktiven Sondertipps vorhanden." />
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {categories.map((category) => (
                  <section
                    key={category.id}
                    className="card"
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={categoryHeaderStyle}>
                      <div>
                        <div style={categoryEyebrowStyle}>
                          {getCategoryIcon(category.answer_type)} Sondertipp
                        </div>

                        <h2 style={categoryTitleStyle}>
                          {category.name}
                        </h2>
                      </div>

                      <div style={pointsBadgeStyle}>
                        {category.points_per_correct} Pkt
                      </div>
                    </div>

                    <div style={answersGridStyle}>
                      {Array.from(
                        { length: category.answer_count },
                        (_, i) => i + 1
                      ).map((index) => {
                        const answer = answers[category.id]?.[index]

                        return (
                          <div key={index} style={answerCardStyle}>
                            {category.answer_count > 1 && (
                              <div style={answerIndexStyle}>
                                Tipp {index}
                              </div>
                            )}

                            {category.answer_type === 'team' && (
                              <select
                                value={answer?.team_id ?? ''}
                                onChange={(e) =>
                                  updateAnswer(
                                    category.id,
                                    index,
                                    'team_id',
                                    e.target.value
                                  )
                                }
                                style={inputStyle}
                              >
                                <option value="">Team auswählen</option>

                                {teams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {category.answer_type === 'text' && (
                              <input
                                type="text"
                                value={answer?.text_answer ?? ''}
                                onChange={(e) =>
                                  updateAnswer(
                                    category.id,
                                    index,
                                    'text_answer',
                                    e.target.value
                                  )
                                }
                                placeholder="Antwort eingeben"
                                style={inputStyle}
                              />
                            )}

                            {category.answer_type === 'number' && (
                              <input
                                type="number"
                                value={answer?.number_answer ?? ''}
                                onChange={(e) =>
                                  updateAnswer(
                                    category.id,
                                    index,
                                    'number_answer',
                                    e.target.value
                                  )
                                }
                                placeholder="Zahl eingeben"
                                style={inputStyle}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {!answersLoading && categories.length > 0 && (
              <div style={stickySaveBarStyle}>
                <button
                  onClick={saveAnswers}
                  disabled={saving}
                  style={{
                    ...stickySaveButtonStyle,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Speichert...' : 'Sondertipps speichern'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 18, color: '#64748b', fontWeight: 850 }}>
      {text}
    </div>
  )
}

function getCategoryIcon(type: Category['answer_type']) {
  if (type === 'team') return '🏆'
  if (type === 'number') return '🔢'
  return '✍️'
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
  right: -100,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,.1)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,.15)',
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
  marginTop: 10,
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

const topControlsStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) auto',
  gap: 14,
  alignItems: 'end',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#334155',
  fontSize: 13,
  fontWeight: 850,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 40,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 850,
}

const saveButtonStyle: React.CSSProperties = {
  minHeight: 42,
  border: 0,
  borderRadius: 999,
  padding: '0 20px',
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  color: 'white',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(22,163,74,0.20)',
  whiteSpace: 'nowrap',
}

const categoryHeaderStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  borderBottom: '1px solid #e2e8f0',
  background: 'linear-gradient(135deg,#ffffff,#f8fafc)',
}

const categoryEyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#166534',
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 8,
}

const categoryTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 20,
  fontWeight: 950,
}

const pointsBadgeStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#f1f5f9',
  color: '#334155',
  fontWeight: 950,
  fontSize: 13,
  flexShrink: 0,
}

const answersGridStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gap: 12,
}

const answerCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
}

const answerIndexStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginBottom: 10,
  padding: '5px 9px',
  borderRadius: 999,
  background: '#f1f5f9',
  color: '#334155',
  fontSize: 12,
  fontWeight: 900,
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

const stickySaveBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 12,
  zIndex: 20,
  marginTop: 18,
  display: 'flex',
  justifyContent: 'flex-end',
}

const stickySaveButtonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 999,
  padding: '0 22px',
  color: 'white',
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(22,163,74,0.22)',
}