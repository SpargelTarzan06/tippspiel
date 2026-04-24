import React, { useState, useEffect } from 'react';
import Tabelle from './Tabelle';
import Tipps from './Tipps';
import MeinePunkte from './MeinePunkte';
import Admin from './Admin';

export default function Dashboard({ spieler, onLogout }) {
  const [page, setPage] = useState('tabelle');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const navItems = [
    { id: 'tabelle', icon: '🏆', label: 'BuLi Tabelle' },
    { id: 'tipps', icon: '✏️', label: 'Tipps eingeben' },
    { id: 'meine', icon: '📊', label: 'Meine Punkte' },
    ...(spieler?.ist_admin ? [{ id: 'admin', icon: '⚙️', label: 'Admin' }] : []),
  ];

  return (
    <div className="dashboard">
      <div className="sidebar">
        <div className="sidebar-logo">TIPP<span>LIGA</span></div>
        {spieler && (
          <div className="sidebar-user">
            <div className="sidebar-user-verein">{spieler.vereine?.kurz}</div>
            <div className="sidebar-user-name">{spieler.name}</div>
          </div>
        )}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-logout">
          <button
            className="btn-logout"
            onClick={() => setDarkMode(!darkMode)}
            style={{ marginBottom: 8 }}
          >
            {darkMode ? '☀️ Heller Modus' : '🌙 Dunkler Modus'}
          </button>
          <button className="btn-logout" onClick={onLogout}>Abmelden</button>
        </div>
      </div>
      <main className="main-content">
        {page === 'tabelle' && <Tabelle />}
        {page === 'tipps' && <Tipps spieler={spieler} />}
        {page === 'meine' && <MeinePunkte spieler={spieler} />}
        {page === 'admin' && spieler?.ist_admin && <Admin />}
      </main>
    </div>
  );
}
