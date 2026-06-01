'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

type Team = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
  answer_type: 'team' | 'text' | 'number'
  answer_count: number
  points_per_correct: number
  deadline_at: string | null
}

type AnswerMap = Record<
  string,
  Record<
    number,
    {
      team_id: string | null
      text_answer: string
      number_answer: string
      is_correct: boolean | null
      points: number
    }
  >
>

export default function SondertippsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [seasonId, setSeasonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMessage('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!seasonData) {
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setSeasonId(seasonData.id)

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

    const { data: answerData } = await supabase
      .from('special_bet_answers')
      .select('*')
      .eq('season_id', seasonData.id)
      .eq('user_id', userData.user.id)

    const map: AnswerMap = {}

    for (const answer of answerData || []) {
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
        is_correct:
          answer.is_correct === null || answer.is_correct === undefined
            ? null
            : Boolean(answer.is_correct),
        points: Number(answer.points ?? 0),
      }
    }

    setAnswers(map)
    setLoading(false)
  }

  function isLocked(category: Category) {
    if (!category.deadline_at) return false
    return new Date(category.deadline_at).getTime() <= new Date().getTime()
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
          is_correct: prev[categoryId]?.[index]?.is_correct ?? null,
          points: prev[categoryId]?.[index]?.points ?? 0,
          [field]: value,
        },
      },
    }))
  }

  async function saveAnswers() {
    setSaving(true)
    setMessage('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    for (const category of categories) {
      if (isLocked(category)) continue

      for (let i = 1; i <= category.answer_count; i++) {
        const answer = answers[category.id]?.[i]

        if (!answer) continue

        const hasValue =
          (category.answer_type === 'team' && answer.team_id) ||
          (category.answer_type === 'text' && answer.text_answer.trim()) ||
          (category.answer_type === 'number' && answer.number_answer !== '')

        if (!hasValue) continue

        const row = {
          season_id: seasonId,
          category_id: category.id,
          user_id: userData.user.id,
          answer_index: i,
          team_id: category.answer_type === 'team' ? answer.team_id : null,
          text_answer:
            category.answer_type === 'text' ? answer.text_answer.trim() : null,
          number_answer:
            category.answer_type === 'number'
              ? Number(answer.number_answer)
              : null,
          is_correct: null,
          points: 0,
          evaluated_at: null,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('special_bet_answers')
          .upsert(row, {
            onConflict: 'category_id,user_id,answer_index',
          })

        if (error) {
          setMessage(`Fehler: ${error.message}`)
          setSaving(false)
          return
        }
      }
    }

    setMessage('Sondertipps gespeichert.')
    await load()
    setSaving(false)
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1000 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Sondertipps...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1000, paddingBottom: 96 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>🎯 Sondertipps</div>

            <h1 style={titleStyle}>Saison-Prognosen</h1>


          </div>
        </section>

        {message && (
          <div
            className="card"
            style={{
              padding: 14,
              marginBottom: 18,
              fontWeight: 850,
              color: message.startsWith('Fehler') ? '#991b1b' : '#166534',
              background: message.startsWith('Fehler') ? '#fff1f2' : '#f0fdf4',
            }}
          >
            {message}
          </div>
        )}

        {categories.length === 0 ? (
          <InfoCard text="Aktuell sind keine Sondertipps aktiv." />
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {categories.map((category) => {
              const locked = isLocked(category)

              return (
                <section
                  key={category.id}
                  className="card"
                  style={{
                    overflow: 'hidden',
                    background: locked ? '#f8fafc' : '#ffffff',
                    border: locked ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={categoryHeaderStyle}>
                    <div>
                      <div style={categoryEyebrowStyle}>
                        {getCategoryIcon(category.answer_type)} Sondertipp
                      </div>

                      <h2 style={categoryTitleStyle}>{category.name}</h2>
                    </div>

                    <div style={locked ? lockedBadgeStyle : openBadgeStyle}>
                      {locked ? '🔒 Geschlossen' : '🟢 Offen'}
                    </div>
                  </div>

                  <div style={categoryMetaStyle}>
                    <span>
                      <strong>{category.points_per_correct}</strong> Punkte pro richtiger Antwort
                    </span>

                    {category.deadline_at && (
                      <span>
                        Deadline:{' '}
                        <strong>{new Date(category.deadline_at).toLocaleString()}</strong>
                      </span>
                    )}
                  </div>

                  <div style={answerGridStyle}>
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
                              disabled={locked}
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
                              disabled={locked}
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
                              disabled={locked}
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

                          <EvaluationStatus answer={answer} />
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {categories.length > 0 && (
          <div style={saveBarStyle}>
            <button
              onClick={saveAnswers}
              disabled={saving}
              style={{
                ...saveButtonStyle,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Speichert...' : '💾 Sondertipps speichern'}
            </button>
          </div>
        )}
      </main>
    </>
  )
}

function EvaluationStatus({
  answer,
}: {
  answer: AnswerMap[string][number] | undefined
}) {
  if (!answer) {
    return (
      <div style={neutralStatusStyle}>
        Noch kein Tipp abgegeben
      </div>
    )
  }

  if (answer.is_correct === true) {
    return (
      <div style={successStatusStyle}>
        ✅ Richtig · +{answer.points ?? 0} Punkte
      </div>
    )
  }

  if (answer.is_correct === false) {
    return (
      <div style={dangerStatusStyle}>
        ❌ Falsch · 0 Punkte
      </div>
    )
  }

  return (
    <div style={neutralStatusStyle}>
      ⏳ Noch nicht ausgewertet
    </div>
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
  borderRadius: 28,
  padding: 26,
  marginBottom: 24,
  background: 'linear-gradient(135deg, #052e16, #166534)',
  color: 'white',
  boxShadow: '0 18px 45px rgba(15,23,42,0.12)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -90,
  top: -100,
  width: 280,
  height: 280,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.13)',
  fontWeight: 950,
  fontSize: 12,
  marginBottom: 12,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1,
  fontWeight: 950,
}



const categoryHeaderStyle: React.CSSProperties = {
  padding: 18,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  borderBottom: '1px solid #e2e8f0',
  flexWrap: 'wrap',
}

const categoryEyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#166534',
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
}

const categoryTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 950,
}

const openBadgeStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#dcfce7',
  color: '#166534',
  fontWeight: 950,
  fontSize: 13,
}

const lockedBadgeStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#fee2e2',
  color: '#991b1b',
  fontWeight: 950,
  fontSize: 13,
}

const categoryMetaStyle: React.CSSProperties = {
  padding: '12px 18px',
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  color: '#64748b',
  fontSize: 13,
  fontWeight: 750,
  borderBottom: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const answerGridStyle: React.CSSProperties = {
  padding: 18,
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
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: 'white',
  color: '#0f172a',
  fontWeight: 800,
}

const neutralStatusStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 14,
  background: '#f1f5f9',
  color: '#475569',
  fontSize: 13,
  fontWeight: 850,
}

const successStatusStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 14,
  background: '#dcfce7',
  color: '#166534',
  fontSize: 13,
  fontWeight: 950,
}

const dangerStatusStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 14,
  background: '#fee2e2',
  color: '#991b1b',
  fontSize: 13,
  fontWeight: 950,
}

const saveBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 12,
  zIndex: 20,
  marginTop: 24,
  display: 'flex',
  justifyContent: 'flex-end',
}

const saveButtonStyle: React.CSSProperties = {
  minHeight: 48,
  border: 0,
  borderRadius: 999,
  padding: '0 22px',
  color: 'white',
  fontWeight: 950,
  background: 'linear-gradient(135deg, #16a34a, #166534)',
  boxShadow: '0 14px 28px rgba(22,163,74,0.24)',
}