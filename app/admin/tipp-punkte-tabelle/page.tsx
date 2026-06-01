'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

export default function TippPunkteTabellePage() {
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
const { data: userData } = await supabase.auth.getUser()

if (!userData.user) {
  router.push('/login')
  return
}

const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userData.user.id)
  .maybeSingle()

    if (profile?.role !== 'admin') {
      router.push('/')
      return
    }

    const { data } = await supabase
      .from('active_tip_points_table_ranked')
      .select('*')
      .order('rank')

    setRows(data || [])
    setLoading(false)
  }

  if (loading) {
    return <main style={{ padding: 20 }}>Lade...</main>
  }

  return (
    <>
      <NavBar />

      <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <h1>Tipp-Punkte-Tabelle</h1>

        <p style={{ color: '#666', marginBottom: 20 }}>
          Diese Tabelle ignoriert die direkten Duelle und sortiert nur nach den
          reinen Tipp-Punkten.
        </p>

        <div
          style={{
            overflowX: 'auto',
            border: '1px solid #ddd',
            borderRadius: 14,
            background: 'white',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 620,
            }}
          >
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>#</th>
                <th style={th}></th>
                <th style={th}>Spieler</th>
                <th style={th}>Tipp-Punkte</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.user_id ?? row.player_name}
                  style={{
                    borderBottom: '1px solid #eee',
                    background: row.rank === 1 ? '#dcfce7' : 'white',
                  }}
                >
                  <td style={td}>
                    <strong>{row.rank}</strong>
                  </td>

                  <td style={td}>
                    {row.logo_url && (
                      <img
                        src={row.logo_url}
                        alt=""
                        style={{
                          width: 28,
                          height: 28,
                          objectFit: 'contain',
                        }}
                      />
                    )}
                  </td>

                  <td style={td}>
                    <strong>{row.player_name}</strong>
                  </td>

                  <td style={{ ...td, fontWeight: 900 }}>
                    {row.tip_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}

const th: React.CSSProperties = {
  padding: 12,
  textAlign: 'left',
  borderBottom: '2px solid #ddd',
}

const td: React.CSSProperties = {
  padding: 12,
}