'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

const navItems = [
  { href: '/', label: 'Tabelle' },
  { href: '/newsticker', label: 'News', isNews: true },
  { href: '/tipps', label: 'Tipps' },
  { href: '/duelle', label: 'Duelle' },
  { href: '/mein-team', label: 'Mein Team' },
  { href: '/champions-league', label: 'Champions League' },
  { href: '/sondertipps', label: 'Sondertipps' },
  { href: '/ewige-tabelle', label: 'Ewige Tabelle' },
  { href: '/archiv', label: 'Archiv' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const pathname = usePathname()
  const [hasUnreadNews, setHasUnreadNews] = useState(false)
  const mobileNavRef = useRef<HTMLDivElement | null>(null)
  const activeItemRef = useRef<HTMLAnchorElement | null>(null)
useEffect(() => {
  const container = mobileNavRef.current
  const activeItem = activeItemRef.current

  if (!container || !activeItem) return

  const containerWidth = container.clientWidth
  const itemLeft = activeItem.offsetLeft
  const itemWidth = activeItem.clientWidth

  container.scrollTo({
    left: itemLeft - containerWidth / 2 + itemWidth / 2,
    behavior: 'smooth',
  })
}, [pathname])
  useEffect(() => {
    loadNewsStatus()
  }, [])

  async function loadNewsStatus() {
    const { data } = await supabase
      .from('news_ticker_messages')
      .select('created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!data || data.length === 0) return

    const lastSeen = localStorage.getItem('news_last_seen')

    if (
      !lastSeen ||
      new Date(data[0].created_at).getTime() >
        new Date(lastSeen).getTime()
    ) {
      setHasUnreadNews(true)
    }
  }

  const handleNewsClick = () => {
    localStorage.setItem('news_last_seen', new Date().toISOString())
    setHasUnreadNews(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="site-header">
      <nav className="site-nav">
<div style={{ width: 1 }} />

        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.isNews ? handleNewsClick : undefined}
              className={`nav-link ${isActive(item.href) ? 'is-active' : ''}`}
            >
              <span>{item.label}</span>

              {item.isNews && hasUnreadNews && <span className="news-dot" />}
            </Link>
          ))}

          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </nav>

      <div className="mobile-nav-scroll" ref={mobileNavRef}>
        {navItems.map((item) => (
<Link
  key={item.href}
  ref={isActive(item.href) ? activeItemRef : null}
  href={item.href}
            onClick={item.isNews ? handleNewsClick : undefined}
            className={`mobile-nav-item ${isActive(item.href) ? 'is-active' : ''}`}
          >
            <span>{item.label}</span>
            {item.isNews && hasUnreadNews && <span className="news-dot" />}
          </Link>
        ))}

        <button onClick={handleLogout} className="mobile-nav-item logout-mobile">
          Logout
        </button>
      </div>
    </header>
  )
}