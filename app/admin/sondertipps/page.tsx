'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Category = {
  id: string
  name: string
  answer_type: 'team' | 'text' | 'number'
  answer_count: number
  points_per_correct: number
  deadline_at: string | null
  is_active: boolean
}

export default function AdminSondertippsPage() {
  const [season, setSeason] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [newCategory, setNewCategory] = useState({
    name: '',
    answer_type: 'team' as 'team' | 'text' | 'number',
    answer_count: 1,
    points_per_correct: 3,
    deadline_at: '',
  })

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

    const { data: categoryData, error } = await supabase
      .from('special_bet_categories')
      .select('*')
      .eq('season_id', seasonData.id)
      .order('created_at')

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setCategories(categoryData || [])
    setLoading(false)
  }

  function updateCategory(id: string, field: keyof Category, value: any) {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === id
          ? {
              ...category,
              [field]: value,
            }
          : category
      )
    )
  }

  async function createCategory() {
    if (!season) return

    if (!newCategory.name.trim()) {
      setMessage('Bitte einen Namen eingeben.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('special_bet_categories').insert({
      season_id: season.id,
      name: newCategory.name.trim(),
      answer_type: newCategory.answer_type,
      answer_count: Number(newCategory.answer_count),
      points_per_correct: Number(newCategory.points_per_correct),
      deadline_at: newCategory.deadline_at
        ? new Date(newCategory.deadline_at).toISOString()
        : null,
      is_active: true,
    })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setNewCategory({
      name: '',
      answer_type: 'team',
      answer_count: 1,
      points_per_correct: 3,
      deadline_at: '',
    })

    setMessage('Sonderwette erstellt.')
    await loadData()
    setSaving(false)
  }

  async function deleteCategory(categoryId: string) {
    const confirmed = window.confirm(
      'Diese Sonderwette wirklich löschen? Alle Tipps und Bewertungen zu dieser Wette werden ebenfalls gelöscht.'
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    await supabase
      .from('special_bet_answers')
      .delete()
      .eq('category_id', categoryId)

    await supabase
      .from('special_bet_results')
      .delete()
      .eq('category_id', categoryId)

    const { error } = await supabase
      .from('special_bet_categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Sonderwette wurde gelöscht.')
    await loadData()
    setSaving(false)
  }

  async function saveCategories() {
    if (!season) return

    setSaving(true)
    setMessage('')

    for (const category of categories) {
      const { error } = await supabase
        .from('special_bet_categories')
        .update({
          name: category.name,
          answer_type: category.answer_type,
          answer_count: Number(category.answer_count),
          points_per_correct: Number(category.points_per_correct),
          deadline_at: category.deadline_at
            ? new Date(category.deadline_at).toISOString()
            : null,
          is_active: category.is_active,
        })
        .eq('id', category.id)

      if (error) {
        setMessage(`Fehler: ${error.message}`)
        setSaving(false)
        return
      }
    }

    setMessage('Sonderwetten gespeichert.')
    await loadData()
    setSaving(false)
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1100 }}>
          <section className="card" style={{ padding: 24 }}>
            Lade Sondertipps-Verwaltung...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1100, paddingBottom: 96 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Sondertipps verwalten</h1>

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
                message.startsWith('Fehler') || message.includes('Bitte')
                  ? '#fff1f2'
                  : '#f0fdf4',
              color:
                message.startsWith('Fehler') || message.includes('Bitte')
                  ? '#991b1b'
                  : '#166534',
              fontWeight: 900,
            }}
          >
            {message}
          </div>
        )}

        <section className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div style={sectionHeaderStyle}>Neue Sonderwette erstellen</div>

          <div style={createGridStyle}>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Frage / Titel
              <input
                type="text"
                placeholder="z. B. Wer wird Meister?"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Typ
              <select
                value={newCategory.answer_type}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    answer_type: e.target.value as 'team' | 'text' | 'number',
                  }))
                }
                style={inputStyle}
              >
                <option value="team">Mannschaft</option>
                <option value="text">Text</option>
                <option value="number">Zahl</option>
              </select>
            </label>

            <label style={labelStyle}>
              Antworten
              <input
                type="number"
                min="1"
                value={newCategory.answer_count}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    answer_count: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Punkte
              <input
                type="number"
                min="0"
                value={newCategory.points_per_correct}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    points_per_correct: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Deadline
              <input
                type="datetime-local"
                value={newCategory.deadline_at}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    deadline_at: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <button
              onClick={createCategory}
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.7 : 1,
              }}
            >
              Sonderwette erstellen
            </button>
          </div>
        </section>

        <div style={actionRowStyle}>
          <button
            onClick={saveCategories}
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Speichert...' : 'Sonderwetten speichern'}
          </button>

          <Link href="/admin/sondertipps-auswertung" style={secondaryLinkStyle}>
            Sondertipps auswerten
          </Link>
        </div>

        {categories.length === 0 ? (
          <InfoCard text="Noch keine Sonderwetten vorhanden." />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {categories.map((category) => (
              <section
                key={category.id}
                className="card"
                style={{
                  overflow: 'hidden',
                  background: category.is_active ? '#ffffff' : '#f8fafc',
                }}
              >
                <div style={categoryHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={categoryEyebrowStyle}>
                      {getCategoryIcon(category.answer_type)} Sonderwette
                    </div>

                    <h2 style={categoryTitleStyle}>{category.name}</h2>
                  </div>

                  <span
                    style={{
                      ...statusBadgeStyle,
                      background: category.is_active ? '#dcfce7' : '#e2e8f0',
                      color: category.is_active ? '#166534' : '#475569',
                    }}
                  >
                    {category.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>

                <div style={editGridStyle}>
                  <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                    Name
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) =>
                        updateCategory(category.id, 'name', e.target.value)
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Typ
                    <select
                      value={category.answer_type}
                      onChange={(e) =>
                        updateCategory(
                          category.id,
                          'answer_type',
                          e.target.value as 'team' | 'text' | 'number'
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="team">Mannschaft</option>
                      <option value="text">Text</option>
                      <option value="number">Zahl</option>
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Antworten
                    <input
                      type="number"
                      min="1"
                      value={category.answer_count}
                      onChange={(e) =>
                        updateCategory(
                          category.id,
                          'answer_count',
                          Number(e.target.value)
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Punkte
                    <input
                      type="number"
                      min="0"
                      value={category.points_per_correct}
                      onChange={(e) =>
                        updateCategory(
                          category.id,
                          'points_per_correct',
                          Number(e.target.value)
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Deadline
                    <input
                      type="datetime-local"
                      value={
                        category.deadline_at
                          ? toDatetimeLocal(category.deadline_at)
                          : ''
                      }
                      onChange={(e) =>
                        updateCategory(
                          category.id,
                          'deadline_at',
                          e.target.value
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={category.is_active}
                      onChange={(e) =>
                        updateCategory(
                          category.id,
                          'is_active',
                          e.target.checked
                        )
                      }
                    />
                    Aktiv
                  </label>
                </div>

                <div style={categoryFooterStyle}>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    disabled={saving}
                    style={dangerButtonStyle}
                  >
                    Sonderwette löschen
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}

        <div style={stickySaveBarStyle}>
          <button
            onClick={saveCategories}
            disabled={saving}
            style={{
              ...stickySaveButtonStyle,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Speichert...' : 'Sonderwetten speichern'}
          </button>
        </div>
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
  padding: 22,
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
  fontSize: 30,
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

const createGridStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  alignItems: 'end',
}

const editGridStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
  gap: 12,
  alignItems: 'end',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#334155',
  fontSize: 13,
  fontWeight: 850,
  minWidth: 0,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 40,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '0 10px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  fontSize: 13,
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  border: 0,
  borderRadius: 999,
  padding: '0 14px',
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  color: 'white',
  fontWeight: 950,
  boxShadow: '0 12px 26px rgba(22,163,74,0.18)',
  whiteSpace: 'normal',
  lineHeight: 1.15,
}

const actionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 10,
  marginBottom: 18,
}

const secondaryLinkStyle: React.CSSProperties = {
  minHeight: 42,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  border: '1px solid #cbd5e1',
  padding: '0 14px',
  background: '#ffffff',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 900,
  textAlign: 'center',
}

const categoryHeaderStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
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
  fontSize: 19,
  fontWeight: 950,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const statusBadgeStyle: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  fontWeight: 950,
  fontSize: 12,
  flexShrink: 0,
}

const checkboxLabelStyle: React.CSSProperties = {
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#334155',
  fontWeight: 900,
}

const categoryFooterStyle: React.CSSProperties = {
  padding: '0 16px 16px',
  display: 'flex',
  justifyContent: 'flex-end',
}

const dangerButtonStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 240,
  minHeight: 38,
  borderRadius: 999,
  border: '1px solid #fecdd3',
  background: '#fff1f2',
  color: '#991b1b',
  padding: '0 14px',
  fontWeight: 900,
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