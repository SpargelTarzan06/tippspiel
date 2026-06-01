'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  const handleSignup = async () => {
    if (!displayName.trim()) {
      setMessage('Bitte gib deinen Namen ein.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage(
      'Account erstellt. Du kannst dich jetzt einloggen. Ein Admin muss dich danach noch deinem Team zuordnen.'
    )

    setMode('login')
    setPassword('')
    setLoading(false)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: '#f5f5f5',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid #ddd',
          borderRadius: 16,
          padding: 24,
          background: 'white',
          boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
        }}
      >
        <h1 style={{ marginTop: 0 }}>
          {mode === 'login' ? 'Login' : 'Registrieren'}
        </h1>

        <p style={{ color: '#666', marginBottom: 20 }}>
          {mode === 'login'
            ? 'Melde dich mit deinem Account an.'
            : 'Erstelle deinen Account. Danach ordnet dich ein Admin deinem Team zu.'}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {mode === 'signup' && (
            <input
              placeholder="Anzeigename"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          )}

          <input
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {mode === 'login' ? (
            <button
              onClick={handleLogin}
              disabled={loading}
              style={primaryButtonStyle}
            >
              {loading ? 'Lädt...' : 'Login'}
            </button>
          ) : (
            <button
              onClick={handleSignup}
              disabled={loading}
              style={primaryButtonStyle}
            >
              {loading ? 'Erstellt...' : 'Registrieren'}
            </button>
          )}

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setMessage('')
            }}
            style={secondaryButtonStyle}
          >
            {mode === 'login'
              ? 'Noch keinen Account? Registrieren'
              : 'Schon einen Account? Zum Login'}
          </button>
        </div>

        {message && (
          <p
            style={{
              marginTop: 16,
              padding: 10,
              borderRadius: 8,
              background: '#f5f5f5',
              border: '1px solid #ddd',
            }}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid #ccc',
  fontSize: 15,
}

const primaryButtonStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid #111',
  background: '#111',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid #ccc',
  background: 'white',
  color: 'black',
  fontWeight: 600,
  cursor: 'pointer',
}