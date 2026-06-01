'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import NavBar from '../../components/NavBar'

export default function AdminPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        window.location.href = '/login'
        return
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (error) {
        console.error(error)
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(profileData)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return <main style={{ padding: 20 }}>Lade...</main>
  }

  if (profile?.role !== 'admin') {
    return (
      <>
        <NavBar />

        <main style={{ padding: 20 }}>
          <h1>Kein Zugriff</h1>
          <p>Du bist kein Admin.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />

      <main
        style={{
          padding: 24,
          maxWidth: 1000,
          margin: '0 auto',
        }}
      >
        <h1 style={{ marginBottom: 24 }}>Admin-Bereich</h1>

        <div
          style={{
            display: 'grid',
            gap: 24,
          }}
        >
          <AdminSection
            title="Spielbetrieb"
            links={[
              {
  href: '/admin/newsticker',
  label: 'Newsticker verwalten',
},
              { href: '/admin/ergebnisse', label: 'Ergebnisse eintragen' },
              { href: '/admin/tipps-verwalten', label: 'Tipps verwalten' },
              { href: '/admin/tippstatus', label: 'Tippstatus' },
              { href: '/admin/deadlines', label: 'Deadlines verwalten' },
              { href: '/admin/champions-league', label: 'Champions League verwalten' },
              { href: '/admin/sondertipps', label: 'Sondertipps verwalten' },
              {
  href: '/admin/sondertipps-auswertung',
  label: 'Sondertipps auswerten',
},
            ]}
          />

          <AdminSection
            title="Importe"
            links={[
              { href: '/admin/tipps-import', label: 'Tipps importieren' },
              { href: '/admin/ergebnisse-import', label: 'Ergebnisse importieren' },
              { href: '/admin/spielplan-import', label: 'Spielplan importieren' },
            ]}
          />

          <AdminSection
            title="Teilnehmer & Teams"
            links={[
              { href: '/admin/teams-zuweisen', label: 'Teams zuweisen' },
            ]}
          />

          <AdminSection
            title="Saison & Finanzen"
            links={[
              { href: '/admin/finanzen', label: 'Finanzen' },
              { href: '/admin/tipp-punkte-tabelle', label: 'Tipp-Punkte-Tabelle' },
              { href: '/admin/saisons', label: 'Saisons verwalten' },
              { href: '/admin/saisonabschluss', label: 'Saisonabschluss speichern' },
            ]}
          />
        </div>
      </main>
    </>
  )
}

function AdminSection({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <section
      style={{
        border: '1px solid #ddd',
        borderRadius: 12,
        padding: 20,
        background: '#fafafa',
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'block',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #ddd',
              background: 'white',
              color: 'black',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  )
}
