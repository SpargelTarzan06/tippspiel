'use client'
'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function ResetPasswordPage() {
  const router = useRouter()
  

  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    verifyRecoveryToken()
  }, [])

  async function verifyRecoveryToken() {
const params = new URLSearchParams(window.location.search)

const tokenHash = params.get('token_hash')
const type = params.get('type')

    if (!tokenHash || type !== 'recovery') {
      setMessage('Der Passwort-Link ist ungültig oder abgelaufen.')
      setChecking(false)
      return
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (error) {
      setMessage('Der Passwort-Link ist ungültig oder abgelaufen.')
      setChecking(false)
      return
    }

    setReady(true)
    setChecking(false)
  }

  async function savePassword() {
    setMessage('')

    if (password.length < 6) {
      setMessage('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    if (password !== passwordRepeat) {
      setMessage('Die Passwörter stimmen nicht überein.')
      return
    }

    setSaving(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Passwort erfolgreich geändert. Du wirst zum Login weitergeleitet.')

    setTimeout(() => {
      router.push('/login')
    }, 1800)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #052e16, #166534)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'white',
          borderRadius: 24,
          padding: 28,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            padding: '7px 12px',
            borderRadius: 999,
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 900,
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          Passwort zurücksetzen
        </div>

        <h1 style={{ margin: 0, fontSize: 30, color: '#0f172a', fontWeight: 950 }}>
          Neues Passwort vergeben
        </h1>

        {checking ? (
          <p style={textStyle}>Link wird geprüft...</p>
        ) : !ready ? (
          <p style={{ ...textStyle, color: '#dc2626' }}>{message}</p>
        ) : (
          <>
            <p style={textStyle}>
              Gib hier dein neues Passwort ein. Danach kannst du dich direkt wieder einloggen.
            </p>

            <label style={labelStyle}>
              Neues Passwort
              <input
                type="password"
                placeholder="Mindestens 6 Zeichen"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Passwort wiederholen
              <input
                type="password"
                placeholder="Passwort erneut eingeben"
                value={passwordRepeat}
                onChange={(e) => setPasswordRepeat(e.target.value)}
                style={inputStyle}
              />
            </label>

            <button
              onClick={savePassword}
              disabled={saving}
              style={{
                width: '100%',
                minHeight: 48,
                border: 0,
                borderRadius: 999,
                marginTop: 18,
                background: saving
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #16a34a, #047857)',
                color: 'white',
                fontWeight: 950,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Speichert...' : 'Passwort speichern'}
            </button>

            {message && (
              <p
                style={{
                  marginTop: 18,
                  color: message.includes('erfolgreich') ? '#166534' : '#dc2626',
                  fontWeight: 800,
                }}
              >
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  )
}

const textStyle: React.CSSProperties = {
  color: '#64748b',
  fontWeight: 700,
  lineHeight: 1.5,
  marginTop: 10,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 18,
  color: '#0f172a',
  fontWeight: 850,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  padding: '0 12px',
  marginTop: 7,
  fontSize: 15,
}