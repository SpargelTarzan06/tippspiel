'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

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
    if (rememberMe) {
  localStorage.setItem('remember_login', 'true')
} else {
  localStorage.removeItem('remember_login')
}
    window.location.href = '/'
  }

  


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
  Login
</h1>

<p style={{ color: '#666', marginBottom: 20 }}>
  Melde dich mit deinem Account an.
</p>

        <div style={{ display: 'grid', gap: 12 }}>
<button
  onClick={handleLogin}
  disabled={loading}
  style={primaryButtonStyle}
>
  {loading ? 'Lädt...' : 'Login'}
</button>

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

<label
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  }}
>
  <input
    type="checkbox"
    checked={rememberMe}
    onChange={(e) => setRememberMe(e.target.checked)}
  />
  Eingeloggt bleiben
</label>

<button
  onClick={handleLogin}
  disabled={loading}
  style={primaryButtonStyle}
>
  {loading ? 'Lädt...' : 'Login'}
</button>

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