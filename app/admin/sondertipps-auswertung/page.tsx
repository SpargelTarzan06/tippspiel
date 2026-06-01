'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

export default function SondertippsAuswertungPage() {
  const [season, setSeason] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [answers, setAnswers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      loadAnswers(selectedCategoryId)
    }
  }, [selectedCategoryId])

  async function load() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      window.location.href = '/'
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

    setSeason(seasonData)

    const { data: categoryData } = await supabase
      .from('special_bet_categories')
      .select('*')
      .eq('season_id', seasonData.id)
      .order('created_at')

    setCategories(categoryData || [])

    if (categoryData && categoryData.length > 0) {
      setSelectedCategoryId(categoryData[0].id)
    }

    setLoading(false)
  }

  async function loadAnswers(categoryId: string) {
    const { data, error } = await supabase
      .from('special_bet_answers')
      .select(`
        id,
        answer_index,
        team_id,
        text_answer,
        number_answer,
        is_correct,
        points,
        evaluated_at,
        profiles (
          display_name
        ),
        teams (
          name
        ),
        special_bet_categories (
          name,
          answer_type,
          points_per_correct
        )
      `)
      .eq('category_id', categoryId)
      .order('profiles(display_name)', { ascending: true })
      .order('answer_index', { ascending: true })

    if (error) {
      setMessage(error.message)
      return
    }

    setAnswers(data || [])
  }

  function getAnswerText(answer: any) {
    const type = answer.special_bet_categories?.answer_type

    if (type === 'team') return answer.teams?.name ?? '-'
    if (type === 'number') return answer.number_answer ?? '-'

    return answer.text_answer ?? '-'
  }

  async function evaluateAnswer(answerId: string, isCorrect: boolean) {
    setSavingId(answerId)
    setMessage('')

    const { error } = await supabase.rpc('evaluate_special_bet_answer', {
      p_answer_id: answerId,
      p_is_correct: isCorrect,
    })

    if (error) {
      setMessage(error.message)
      setSavingId('')
      return
    }

    await loadAnswers(selectedCategoryId)
    setSavingId('')
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1100 }}>
          <section className="card" style={{ padding: 24 }}>
            Lade Sondertipps-Auswertung...
          </section>
        </main>
      </>
    )
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1100 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Sondertipps auswerten</h1>

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
              background:
                message.includes('Fehler') || message.includes('Keine')
                  ? '#fff1f2'
                  : '#f0fdf4',
              color:
                message.includes('Fehler') || message.includes('Keine')
                  ? '#991b1b'
                  : '#166534',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        <section className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div style={sectionHeaderStyle}>Sonderwette auswählen</div>

          <div style={selectorAreaStyle}>
            <label style={labelStyle}>
              Sonderwette
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                style={selectStyle}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedCategory && (
              <div style={pointsInfoStyle}>
                <div style={pointsLabelStyle}>Punkte pro richtigem Tipp</div>
                <div style={pointsValueStyle}>
                  {selectedCategory.points_per_correct}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card" style={{ overflow: 'hidden' }}>
          <div style={sectionHeaderStyle}>Abgegebene Tipps</div>

          <div style={answersGridStyle}>
            {answers.length === 0 ? (
              <InfoCard text="Noch keine Tipps für diese Sonderwette vorhanden." />
            ) : (
              answers.map((answer) => {
                const evaluatedCorrect = answer.is_correct === true
                const evaluatedWrong = answer.is_correct === false
                const isSaving = savingId === answer.id

                return (
                  <article
                    key={answer.id}
                    style={{
                      ...answerCardStyle,
                      border: evaluatedCorrect
                        ? '1px solid #bbf7d0'
                        : evaluatedWrong
                        ? '1px solid #fecdd3'
                        : '1px solid #e2e8f0',
                      background: evaluatedCorrect
                        ? '#f0fdf4'
                        : evaluatedWrong
                        ? '#fff1f2'
                        : '#ffffff',
                    }}
                  >
                    <div style={answerContentStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={playerNameStyle}>
                          {answer.profiles?.display_name ?? 'Unbekannt'}
                        </div>

                        <div style={tipMetaStyle}>
                          Tipp {answer.answer_index}
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={tipLabelStyle}>Antwort</div>
                        <div style={answerValueStyle}>
                          {getAnswerText(answer)}
                        </div>
                      </div>

                      <div style={pointsBoxStyle}>
                        <div style={pointsLabelStyle}>Punkte</div>
                        <div style={answerPointsStyle}>
                          {answer.points ?? 0}
                        </div>
                      </div>

                      <div style={buttonRowStyle}>
                        <button
                          onClick={() => evaluateAnswer(answer.id, true)}
                          disabled={isSaving}
                          style={{
                            ...correctButtonStyle,
                            opacity: isSaving ? 0.7 : 1,
                          }}
                        >
                          ✅ Richtig
                        </button>

                        <button
                          onClick={() => evaluateAnswer(answer.id, false)}
                          disabled={isSaving}
                          style={{
                            ...wrongButtonStyle,
                            opacity: isSaving ? 0.7 : 1,
                          }}
                        >
                          ❌ Falsch
                        </button>
                      </div>
                    </div>

                    <div style={statusLineStyle}>
                      {evaluatedCorrect
                        ? '✅ Als richtig bewertet'
                        : evaluatedWrong
                        ? '❌ Als falsch bewertet'
                        : '⏳ Noch nicht bewertet'}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </main>
    </>
  )
}

function InfoCard({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#64748b',
        fontWeight: 850,
      }}
    >
      {text}
    </div>
  )
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

const selectorAreaStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) 190px',
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

const pointsInfoStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  padding: 12,
  background: '#f8fafc',
}

const pointsLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 850,
}

const pointsValueStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 950,
  marginTop: 2,
}

const answersGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
}

const answerCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 14,
}

const answerContentStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1.5fr 90px 190px',
  gap: 12,
  alignItems: 'center',
}

const playerNameStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 950,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const tipMetaStyle: React.CSSProperties = {
  marginTop: 3,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
}

const tipLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 850,
}

const answerValueStyle: React.CSSProperties = {
  marginTop: 3,
  color: '#0f172a',
  fontWeight: 950,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const pointsBoxStyle: React.CSSProperties = {
  textAlign: 'center',
}

const answerPointsStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1,
  marginTop: 4,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const correctButtonStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 40,
  border: 0,
  borderRadius: 12,
  background: '#16a34a',
  color: 'white',
  fontWeight: 950,
  padding: '0 10px',
}

const wrongButtonStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 40,
  border: 0,
  borderRadius: 12,
  background: '#dc2626',
  color: 'white',
  fontWeight: 950,
  padding: '0 10px',
}

const statusLineStyle: React.CSSProperties = {
  marginTop: 10,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 850,
}