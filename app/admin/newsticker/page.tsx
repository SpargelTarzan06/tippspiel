'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Season = {
  id: string
  name: string
}

type NewsMessage = {
  id: string
  season_id: string | null
  title: string | null
  message: string
  image_url?: string | null
  is_active: boolean
  created_at: string
  seasons?: {
    name: string
  } | null
}

export default function AdminNewstickerPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [messages, setMessages] = useState<NewsMessage[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [filterSeasonId, setFilterSeasonId] = useState('active')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadMessages()
  }, [filterSeasonId])

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return false
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profileData?.role !== 'admin') {
      window.location.href = '/'
      return false
    }

    return true
  }

  async function load() {
    setLoading(true)

    const isAdmin = await checkAdmin()
    if (!isAdmin) return

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id, name')
      .order('created_at', { ascending: false })

    setSeasons(seasonsData || [])

    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()

    if (activeSeason?.id) {
      setSeasonId(activeSeason.id)
    }

    setLoading(false)
    await loadMessages()
  }

  async function loadMessages() {
    let query = supabase
      .from('news_ticker_messages')
      .select('*, seasons(name)')
      .order('created_at', { ascending: false })

    if (filterSeasonId === 'active') {
      const { data: activeSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()

      if (activeSeason?.id) {
        query = query.eq('season_id', activeSeason.id)
      }
    } else if (filterSeasonId !== 'all') {
      query = query.eq('season_id', filterSeasonId)
    }

    const { data } = await query
    setMessages(data || [])
  }

  async function createMessage() {
    if (!message.trim()) {
      setStatus('Bitte eine Nachricht eingeben.')
      return
    }

    setSaving(true)
    setStatus('')

    let uploadedImageUrl: string | null = null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('newsticker-images')
        .upload(fileName, imageFile)

      if (uploadError) {
        setStatus(uploadError.message)
        setSaving(false)
        return
      }

      const { data } = supabase.storage
        .from('newsticker-images')
        .getPublicUrl(fileName)

      uploadedImageUrl = data.publicUrl
    }

    const { error } = await supabase.from('news_ticker_messages').insert({
      season_id: seasonId || null,
      title: title.trim() || null,
      message: message.trim(),
      image_url: uploadedImageUrl,
      is_active: true,
    })

    if (error) {
      setStatus(error.message)
      setSaving(false)
      return
    }

    setTitle('')
    setMessage('')
    setImageFile(null)
    setStatus('Nachricht veröffentlicht.')
    await loadMessages()
    setSaving(false)
  }

  async function toggleMessage(row: NewsMessage) {
    const { error } = await supabase
      .from('news_ticker_messages')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)

    if (error) {
      setStatus(error.message)
      return
    }

    await loadMessages()
  }

  async function deleteMessage(id: string) {
    const confirmed = window.confirm('Nachricht wirklich löschen?')
    if (!confirmed) return

    const { error } = await supabase
      .from('news_ticker_messages')
      .delete()
      .eq('id', id)

    if (error) {
      setStatus(error.message)
      return
    }

    await loadMessages()
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 1000 }}>
          <section className="card" style={{ padding: 24 }}>
            Lade Newsticker-Verwaltung...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 1100 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={titleStyle}>Newsticker verwalten</h1>

            <div style={seasonPillStyle}>
              Nachrichten, Bilder und Saisonfilter
            </div>
          </div>
        </section>

        {status && (
          <div
            className="card"
            style={{
              padding: 14,
              marginBottom: 18,
              background:
                status.includes('Fehler') || status.includes('Bitte')
                  ? '#fff1f2'
                  : '#f0fdf4',
              color:
                status.includes('Fehler') || status.includes('Bitte')
                  ? '#991b1b'
                  : '#166534',
              fontWeight: 900,
            }}
          >
            {status}
          </div>
        )}

        <div style={layoutGridStyle}>
          <section className="card" style={{ overflow: 'hidden' }}>
            <div style={sectionHeaderStyle}>Neue Nachricht</div>

            <div style={formGridStyle}>
              <label style={labelStyle}>
                Saison
                <select
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value)}
                  style={inputStyle}
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Titel
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Spieltag 1 ist online"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Nachricht
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nachricht schreiben..."
                  style={{
                    ...inputStyle,
                    minHeight: 130,
                    paddingTop: 12,
                    resize: 'vertical',
                  }}
                />
              </label>

              <label style={labelStyle}>
                Bild
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  style={fileInputStyle}
                />
              </label>

              <button
                onClick={createMessage}
                disabled={saving}
                style={{
                  ...publishButtonStyle,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Speichert...' : 'Nachricht veröffentlichen'}
              </button>
            </div>
          </section>

          <section className="card" style={{ overflow: 'hidden' }}>
            <div style={sectionHeaderStyle}>Nachrichten</div>

            <div style={{ padding: 16 }}>
              <label style={labelStyle}>
                Saison filtern
                <select
                  value={filterSeasonId}
                  onChange={(e) => setFilterSeasonId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="active">Aktive Saison</option>
                  <option value="all">Alle Saisons</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={messageListStyle}>
                {messages.length === 0 ? (
                  <InfoCard text="Keine Nachrichten gefunden." />
                ) : (
                  messages.map((row) => (
                    <article
                      key={row.id}
                      style={{
                        ...messageCardStyle,
                        border: row.is_active
                          ? '1px solid #bbf7d0'
                          : '1px solid #e2e8f0',
                        background: row.is_active ? '#f0fdf4' : '#f8fafc',
                      }}
                    >
                      <div style={messageHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={messageTitleRowStyle}>
                            <strong style={messageTitleStyle}>
                              {row.title || 'Newsticker'}
                            </strong>

                            <span
                              style={{
                                ...statusBadgeStyle,
                                background: row.is_active
                                  ? '#16a34a'
                                  : '#64748b',
                              }}
                            >
                              {row.is_active ? 'AKTIV' : 'INAKTIV'}
                            </span>
                          </div>

                          <div style={dateStyle}>
                            {new Date(row.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <p style={messageTextStyle}>{row.message}</p>

                      {row.image_url && (
                        <img
                          src={row.image_url}
                          alt=""
                          style={imageStyle}
                        />
                      )}

                      <div style={metaStyle}>
                        Saison: {row.seasons?.name ?? 'Keine Saison'}
                      </div>

                      <div style={buttonRowStyle}>
                        <button
                          onClick={() => toggleMessage(row)}
                          style={secondaryButtonStyle}
                        >
                          {row.is_active ? 'Ausblenden' : 'Einblenden'}
                        </button>

                        <button
                          onClick={() => deleteMessage(row.id)}
                          style={dangerButtonStyle}
                        >
                          Löschen
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
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

const isMobile =
  typeof window !== 'undefined' &&
  window.innerWidth < 900

const layoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: isMobile
    ? '1fr'
    : 'minmax(0,.9fr) minmax(0,1.1fr)',
  gap: 18,
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'linear-gradient(135deg,#f8fafc,#ffffff)',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 950,
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 13,
  padding: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#334155',
  fontSize: 13,
  fontWeight: 850,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 750,
}

const fileInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: 10,
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 750,
}

const publishButtonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 999,
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  color: 'white',
  fontWeight: 950,
  padding: '0 22px',
  boxShadow: '0 12px 26px rgba(22,163,74,0.20)',
}

const messageListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 16,
}

const messageCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
}

const messageHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
}

const messageTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const messageTitleStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 17,
  fontWeight: 950,
}

const statusBadgeStyle: React.CSSProperties = {
  color: 'white',
  padding: '3px 8px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 950,
}

const dateStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 750,
}

const messageTextStyle: React.CSSProperties = {
  margin: '12px 0 0',
  color: '#334155',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
}

const imageStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 260,
  objectFit: 'cover',
  borderRadius: 14,
  marginTop: 12,
  display: 'block',
}

const metaStyle: React.CSSProperties = {
  marginTop: 10,
  color: '#64748b',
  fontSize: 13,
  fontWeight: 750,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 14,
}

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 999,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 14px',
  fontWeight: 900,
}

const dangerButtonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 999,
  border: '1px solid #fecdd3',
  background: '#fff1f2',
  color: '#991b1b',
  padding: '0 14px',
  fontWeight: 900,
}