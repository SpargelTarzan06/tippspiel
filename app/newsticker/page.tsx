'use client'

import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import { supabase } from '../../lib/supabaseClient'

export default function NewstickerPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [comments, setComments] = useState<Record<string, string>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    setUserId(userData.user.id)

    const { data } = await supabase
      .from('news_ticker_messages')
      .select(`
        *,
        reactions:news_ticker_reactions(*),
        comments:news_ticker_comments(
          *,
          profiles(display_name)
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    setMessages(data || [])

    localStorage.setItem('news_last_seen', new Date().toISOString())

    setLoading(false)
  }

  async function react(messageId: string, reaction: 'like' | 'dislike') {
    const existingReaction = messages
      .find((m) => m.id === messageId)
      ?.reactions?.find((r: any) => r.user_id === userId)

    if (existingReaction) {
      await supabase
        .from('news_ticker_reactions')
        .update({ reaction })
        .eq('id', existingReaction.id)
    } else {
      await supabase
        .from('news_ticker_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction,
        })
    }

    await load()
  }

  async function addComment(messageId: string) {
    const text = comments[messageId]?.trim()

    if (!text) return

    await supabase
      .from('news_ticker_comments')
      .insert({
        message_id: messageId,
        user_id: userId,
        comment: text,
      })

    setComments((prev) => ({
      ...prev,
      [messageId]: '',
    }))

    await load()
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="page-shell" style={{ maxWidth: 950 }}>
          <section className="card" style={{ padding: 28 }}>
            Lade Newsticker...
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main className="page-shell" style={{ maxWidth: 950 }}>
        <section style={heroStyle}>
          <div style={heroGlowStyle} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={eyebrowStyle}>📰 Newsticker</div>

            <h1 style={titleStyle}>Aktuelle Meldungen</h1>
          </div>
        </section>

        {messages.length === 0 ? (
          <InfoCard text="Noch keine Nachrichten vorhanden." />
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {messages.map((news) => {
              const likes =
                news.reactions?.filter(
                  (r: any) => r.reaction === 'like'
                ).length ?? 0

              const dislikes =
                news.reactions?.filter(
                  (r: any) => r.reaction === 'dislike'
                ).length ?? 0

              return (
                <article key={news.id} className="card" style={newsCardStyle}>
                  <div style={newsHeaderStyle}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong style={newsTitleStyle}>
                        {news.title || 'LSV Tippspiel'}
                      </strong>

                      <span style={dateStyle}>
                        {new Date(news.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p style={messageStyle}>{news.message}</p>

                  {news.image_url && (
                    <div style={{ padding: '0 18px 18px' }}>
                      <img
                        src={news.image_url}
                        alt=""
                        style={imageStyle}
                      />
                    </div>
                  )}

                  <div style={reactionRowStyle}>
                    <button
                      onClick={() => react(news.id, 'like')}
                      style={reactionButtonStyle}
                    >
                      👍 {likes}
                    </button>

                    <button
                      onClick={() => react(news.id, 'dislike')}
                      style={reactionButtonStyle}
                    >
                      👎 {dislikes}
                    </button>
                  </div>

                  <div style={commentSectionStyle}>
                    <div style={commentHeaderStyle}>
                      Kommentare ({news.comments?.length ?? 0})
                    </div>

                    {news.comments?.length > 0 && (
                      <div style={commentListStyle}>
                        {news.comments.map((comment: any) => (
                          <div key={comment.id} style={commentCardStyle}>
                            <strong style={commentAuthorStyle}>
                              {comment.profiles?.display_name || 'User'}
                            </strong>

                            <p style={commentTextStyle}>
                              {comment.comment}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={commentInputRowStyle}>
                      <input
                        value={comments[news.id] || ''}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [news.id]: e.target.value,
                          }))
                        }
                        placeholder="Kommentar schreiben..."
                        style={commentInputStyle}
                      />

                      <button
                        onClick={() => addComment(news.id)}
                        style={sendButtonStyle}
                      >
                        Senden
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
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

const heroStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 26,
  marginBottom: 24,
  background: 'linear-gradient(135deg,#052e16,#166534)',
  color: 'white',
  boxShadow: '0 18px 45px rgba(15,23,42,0.12)',
}

const heroGlowStyle: React.CSSProperties = {
  position: 'absolute',
  right: -100,
  top: -100,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
}

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  fontWeight: 950,
  fontSize: 12,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1,
  fontWeight: 950,
}

const newsCardStyle: React.CSSProperties = {
  overflow: 'hidden',
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
}

const newsHeaderStyle: React.CSSProperties = {
  padding: 18,
  borderBottom: '1px solid #e2e8f0',
  background: 'linear-gradient(135deg,#f8fafc,#ffffff)',
}

const newsTitleStyle: React.CSSProperties = {
  fontSize: 20,
  color: '#0f172a',
  fontWeight: 950,
}

const dateStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
}

const messageStyle: React.CSSProperties = {
  lineHeight: 1.8,
  color: '#334155',
  margin: 0,
  padding: 18,
  fontSize: 15,
  fontWeight: 650,
  whiteSpace: 'pre-wrap',
}

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  borderRadius: 16,
  display: 'block',
}

const reactionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: '0 18px 18px',
  flexWrap: 'wrap',
}

const reactionButtonStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 999,
  background: '#ffffff',
  padding: '8px 14px',
  fontWeight: 900,
  color: '#0f172a',
}

const commentSectionStyle: React.CSSProperties = {
  padding: 18,
  borderTop: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const commentHeaderStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 950,
  marginBottom: 12,
}

const commentListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  marginBottom: 14,
}

const commentCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
}

const commentAuthorStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 950,
}

const commentTextStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#334155',
  lineHeight: 1.5,
}

const commentInputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
}

const commentInputStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  padding: '0 14px',
  fontWeight: 700,
  minWidth: 0,
}

const sendButtonStyle: React.CSSProperties = {
  minWidth: 100,
  border: 0,
  borderRadius: 14,
  background: 'linear-gradient(135deg,#16a34a,#166534)',
  color: 'white',
  fontWeight: 900,
}