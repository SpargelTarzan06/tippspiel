'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '../../../components/NavBar'
import { supabase } from '../../../lib/supabaseClient'

type Season = { id: string; name: string }

type FinanceAccount = {
  account_id: string
  user_id: string | null
  placeholder_player_id: string | null
  display_name: string
  balance: number
  total_prize_money: number
  total_penalties: number
}

type FinanceTransaction = {
  id: string
  account_id: string
  season_id: string | null
  season_name: string | null
  type: string
  amount: number
  title: string
  description: string | null
  created_at: string
}

type PrizeRules = Record<number, string>
type ClPrizeRules = { winner: string; finalist: string; semifinalist: string }
type SpecialPrizeRules = { winner: string }

export default function FinanzenPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState('all')
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])

  const [type, setType] = useState('penalty')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [paymentNote, setPaymentNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [latePenaltyAmount, setLatePenaltyAmount] = useState('1')
  const [savingLatePenalty, setSavingLatePenalty] = useState(false)

  const [prizeRules, setPrizeRules] = useState<PrizeRules>({})
  const [clPrizeRules, setClPrizeRules] = useState<ClPrizeRules>({ winner: '', finalist: '', semifinalist: '' })
  const [specialPrizeRules, setSpecialPrizeRules] = useState<SpecialPrizeRules>({ winner: '' })

  const [savingRules, setSavingRules] = useState(false)
  const [savingClRules, setSavingClRules] = useState(false)
  const [savingSpecialRules, setSavingSpecialRules] = useState(false)
  const [message, setMessage] = useState('')
  const [rulesMessage, setRulesMessage] = useState('')
  const [clRulesMessage, setClRulesMessage] = useState('')
  const [specialRulesMessage, setSpecialRulesMessage] = useState('')
  const [latePenaltyMessage, setLatePenaltyMessage] = useState('')
  const [noteMessage, setNoteMessage] = useState('')

  useEffect(() => {
    checkAdmin()
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions(selectedAccountId)
      loadPaymentNote(selectedAccountId)
    }
  }, [selectedAccountId, selectedSeasonFilter])

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

  async function loadInitialData() {
    setLoading(true)
    setMessage('')

    const { data: activeSeasonData } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('is_active', true)
      .single()

    if (!activeSeasonData) {
      setMessage('Keine aktive Saison gefunden.')
      setLoading(false)
      return
    }

    setActiveSeason(activeSeasonData)

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id, name')
      .order('name', { ascending: false })

    setSeasons(seasonsData || [])

    await Promise.all([
      loadAccounts(),
      loadPrizeRules(activeSeasonData.id),
      loadClPrizeRules(activeSeasonData.id),
      loadSpecialPrizeRules(activeSeasonData.id),
      loadLatePenaltyAmount(),
    ])

    setLoading(false)
  }

  async function loadAccounts() {
const { data, error } = await supabase
  .from('active_finance_account_picker')
  .select(`
    account_id,
    display_name,
    account_type,
    team_name
  `)
  .order('team_name', { ascending: true })

    if (error) {
      setMessage(error.message)
      return
    }

const financeSummaryMap = new Map(
  (await supabase
    .from('finance_account_summary')
    .select('*')).data?.map((row: any) => [
      row.account_id,
      row,
    ]) ?? []
)

const rows = (data || []).map((row: any) => {
  const summary = financeSummaryMap.get(row.account_id)

  return {
    account_id: row.account_id,
    user_id: summary?.user_id ?? null,
    placeholder_player_id: summary?.placeholder_player_id ?? null,

    display_name: `${row.team_name} – ${row.display_name}`,

    balance: Number(summary?.balance ?? 0),
    total_prize_money: Number(summary?.total_prize_money ?? 0),
    total_penalties: Number(summary?.total_penalties ?? 0),
  }
})

    setAccounts(rows)
    if (!selectedAccountId && rows.length > 0) setSelectedAccountId(rows[0].account_id)
  }

  async function loadTransactions(accountId: string) {
    let query = supabase
      .from('finance_transactions_with_season')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (selectedSeasonFilter !== 'all') query = query.eq('season_id', selectedSeasonFilter)

    const { data, error } = await query
    if (error) {
      setMessage(error.message)
      return
    }

    setTransactions((data || []).map((row: any) => ({
      id: row.id,
      account_id: row.account_id,
      season_id: row.season_id,
      season_name: row.season_name,
      type: row.type,
      amount: Number(row.amount ?? 0),
      title: row.title,
      description: row.description,
      created_at: row.created_at,
    })))
  }

  async function loadPaymentNote(accountId: string) {
    const { data } = await supabase
      .from('finance_payment_notes')
      .select('note')
      .eq('account_id', accountId)
      .maybeSingle()

    setPaymentNote(data?.note ?? '')
  }

  async function loadLatePenaltyAmount() {
    const { data } = await supabase
      .from('finance_settings')
      .select('value')
      .eq('key', 'late_tip_penalty_amount')
      .maybeSingle()

    setLatePenaltyAmount(data?.value === undefined || data?.value === null ? '1' : String(data.value))
  }

  async function loadPrizeRules(seasonId: string) {
    const { data } = await supabase
      .from('finance_prize_rules')
      .select('rank, amount')
      .eq('season_id', seasonId)
      .eq('competition', 'bundesliga')
      .order('rank', { ascending: true })

    const map: PrizeRules = {}
    for (let rank = 1; rank <= 18; rank++) map[rank] = ''
    for (const row of data || []) map[row.rank] = String(row.amount)
    setPrizeRules(map)
  }

  async function loadSpecialPrizeRules(seasonId: string) {
    const { data } = await supabase
      .from('finance_prize_rules')
      .select('amount')
      .eq('season_id', seasonId)
      .eq('competition', 'special_bets')
      .eq('rank', 1)
      .maybeSingle()

    setSpecialPrizeRules({ winner: data?.amount === undefined || data?.amount === null ? '' : String(data.amount) })
  }

  async function loadClPrizeRules(seasonId: string) {
    const { data } = await supabase
      .from('cl_prize_money')
      .select('placement, amount')
      .eq('season_id', seasonId)

    const map: ClPrizeRules = { winner: '', finalist: '', semifinalist: '' }
    for (const row of data || []) {
      if (row.placement === 'winner') map.winner = String(row.amount)
      if (row.placement === 'finalist') map.finalist = String(row.amount)
      if (row.placement === 'semifinalist') map.semifinalist = String(row.amount)
    }
    setClPrizeRules(map)
  }

  async function saveLatePenaltyAmount() {
    setSavingLatePenalty(true)
    setLatePenaltyMessage('')

    const { error } = await supabase.from('finance_settings').upsert({
      key: 'late_tip_penalty_amount',
      value: Number(latePenaltyAmount || 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    if (error) setLatePenaltyMessage(error.message)
    else setLatePenaltyMessage('Automatische Deadline-Strafe gespeichert.')

    setSavingLatePenalty(false)
  }

  async function savePaymentNote() {
    if (!selectedAccountId) return
    setSavingNote(true)
    setNoteMessage('')

    const { data: existing } = await supabase
      .from('finance_payment_notes')
      .select('id')
      .eq('account_id', selectedAccountId)
      .maybeSingle()

    const payload = { account_id: selectedAccountId, note: paymentNote, updated_at: new Date().toISOString() }

    const { error } = existing?.id
      ? await supabase.from('finance_payment_notes').update(payload).eq('id', existing.id)
      : await supabase.from('finance_payment_notes').insert(payload)

    if (error) setNoteMessage(error.message)
    else setNoteMessage('Notiz gespeichert.')

    setSavingNote(false)
  }

  function updatePrizeRule(rank: number, value: string) {
    setPrizeRules((prev) => ({ ...prev, [rank]: value }))
  }

  function updateClPrizeRule(field: keyof ClPrizeRules, value: string) {
    setClPrizeRules((prev) => ({ ...prev, [field]: value }))
  }

  function updateSpecialPrizeRule(value: string) {
    setSpecialPrizeRules({ winner: value })
  }

  async function savePrizeRules() {
    if (!activeSeason) return
    setRulesMessage('')
    setSavingRules(true)

    const rows = Object.entries(prizeRules)
      .filter(([, value]) => value !== '')
      .map(([rank, value]) => ({
        season_id: activeSeason.id,
        competition: 'bundesliga',
        rank: Number(rank),
        amount: Number(value),
      }))

    const { error } = await supabase.from('finance_prize_rules').upsert(rows, {
      onConflict: 'season_id,competition,rank',
    })

    if (error) setRulesMessage(error.message)
    else setRulesMessage('Bundesliga-Preisgeld-Regeln gespeichert.')

    setSavingRules(false)
  }

  async function saveSpecialPrizeRules() {
    if (!activeSeason) return
    setSpecialRulesMessage('')
    setSavingSpecialRules(true)

    const { error } = await supabase.from('finance_prize_rules').upsert({
      season_id: activeSeason.id,
      competition: 'special_bets',
      rank: 1,
      amount: Number(specialPrizeRules.winner || 0),
    }, { onConflict: 'season_id,competition,rank' })

    if (error) setSpecialRulesMessage(error.message)
    else setSpecialRulesMessage('Sondertipps-Preisgeld gespeichert.')

    setSavingSpecialRules(false)
  }

  async function saveClPrizeRules() {
    if (!activeSeason) return
    setClRulesMessage('')
    setSavingClRules(true)

    const rows = [
      { season_id: activeSeason.id, placement: 'winner', amount: Number(clPrizeRules.winner || 0) },
      { season_id: activeSeason.id, placement: 'finalist', amount: Number(clPrizeRules.finalist || 0) },
      { season_id: activeSeason.id, placement: 'semifinalist', amount: Number(clPrizeRules.semifinalist || 0) },
    ]

    const { error } = await supabase.from('cl_prize_money').upsert(rows, {
      onConflict: 'season_id,placement',
    })

    if (error) setClRulesMessage(error.message)
    else setClRulesMessage('Champions-League-Preisgeld gespeichert.')

    setSavingClRules(false)
  }

  async function saveTransaction() {
    if (!selectedAccountId || !activeSeason) return
    if (!amount || !title) {
      setMessage('Bitte Betrag und Titel ausfüllen.')
      return
    }

    setSaving(true)
    setMessage('')

    const numericAmount = Number(amount)
    const finalAmount = type === 'penalty' ? -Math.abs(numericAmount) : Math.abs(numericAmount)

    const { error } = await supabase.from('finance_transactions_v2').insert({
      account_id: selectedAccountId,
      season_id: activeSeason.id,
      type,
      amount: finalAmount,
      title,
      description,
    })

    if (error) setMessage(error.message)
    else {
      setAmount('')
      setTitle('')
      setDescription('')
      setMessage('Transaktion gespeichert.')
      await Promise.all([loadTransactions(selectedAccountId), loadAccounts()])
    }

    setSaving(false)
  }

  async function deleteTransaction(transactionId: string) {
    const confirmed = window.confirm('Willst du diese Finanzbewegung wirklich löschen?')
    if (!confirmed) return

    const { error } = await supabase.from('finance_transactions_v2').delete().eq('id', transactionId)
    if (error) alert(error.message)
    else await Promise.all([loadTransactions(selectedAccountId), loadAccounts()])
  }

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.account_id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  const filteredBalance = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const filteredPrizeMoney = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const filteredPenalties = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <>
      <NavBar />
      <main style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
        <h1>Finanzen verwalten</h1>
        {activeSeason && <p style={{ color: '#666' }}>Aktive Saison: {activeSeason.name}</p>}
        {message && <p>{message}</p>}

        {loading ? <p>Lade...</p> : (
          <>
            <section style={sectionStyle}>
              <h2>Alle Finanzkonten</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Spieler</th>
                      <th style={thStyle}>Kontostand</th>
                      <th style={thStyle}>Preisgelder</th>
                      <th style={thStyle}>Strafen</th>
                      <th style={thStyle}>Typ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.account_id} onClick={() => setSelectedAccountId(account.account_id)} style={{ cursor: 'pointer', background: account.account_id === selectedAccountId ? '#eef6ff' : 'white' }}>
                        <td style={tdStyle}><strong>{account.display_name}</strong></td>
                        <td style={tdStyle}>{account.balance.toFixed(2)} €</td>
                        <td style={tdStyle}>+{account.total_prize_money.toFixed(2)} €</td>
                        <td style={tdStyle}>-{account.total_penalties.toFixed(2)} €</td>
                        <td style={tdStyle}>{account.user_id ? 'Spieler' : 'Platzhalter'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={sectionStyle}>
              <h2>Ausgewähltes Konto</h2>
              <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
                <label>Spieler auswählen
                  <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                    {accounts.map((account) => (
                      <option key={account.account_id} value={account.account_id}>{account.display_name}{account.user_id ? '' : ' (Platzhalter)'}</option>
                    ))}
                  </select>
                </label>
                <label>Saisonfilter
                  <select value={selectedSeasonFilter} onChange={(e) => setSelectedSeasonFilter(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                    <option value="all">Alle Saisons</option>
                    {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
                  </select>
                </label>
              </div>

              <div style={summaryGridStyle}>
                <SummaryCard title="Ausgewählt" value={selectedAccount?.display_name ?? '-'} />
                <SummaryCard title={selectedSeasonFilter === 'all' ? 'Kontostand gesamt' : 'Kontostand Saisonfilter'} value={`${selectedSeasonFilter === 'all' ? selectedAccount?.balance.toFixed(2) ?? '0.00' : filteredBalance.toFixed(2)} €`} />
                <SummaryCard title="Preisgelder" value={`+${selectedSeasonFilter === 'all' ? selectedAccount?.total_prize_money.toFixed(2) ?? '0.00' : filteredPrizeMoney.toFixed(2)} €`} />
                <SummaryCard title="Strafen" value={`-${selectedSeasonFilter === 'all' ? selectedAccount?.total_penalties.toFixed(2) ?? '0.00' : filteredPenalties.toFixed(2)} €`} />
              </div>

              <h3 style={{ marginTop: 24 }}>Zahlungsnotiz</h3>
              <textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="z. B. bezahlt bis 2025/26, noch 10 € offen, bar erhalten ..." style={{ width: '100%', minHeight: 80 }} />
              <button onClick={savePaymentNote} disabled={savingNote} style={{ marginTop: 10 }}>{savingNote ? 'Speichert...' : 'Notiz speichern'}</button>
              {noteMessage && <p>{noteMessage}</p>}
            </section>

            <section style={sectionStyle}>
              <h2>Manuelle Transaktion</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="penalty">Geldstrafe</option>
                  <option value="bundesliga_prize">Bundesliga Preisgeld</option>
                  <option value="special_prize">Sondertipps Preisgeld</option>
                  <option value="champions_league_prize">Champions League Preisgeld</option>
                  <option value="bonus">Bonus</option>
                  <option value="correction">Korrektur</option>
                </select>
                <input type="number" placeholder="Betrag" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input type="text" placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
                <button onClick={saveTransaction} disabled={saving}>{saving ? 'Speichert...' : 'Transaktion speichern'}</button>
              </div>
            </section>

            <section style={sectionStyle}>
              <h2>Automatische Deadline-Strafe</h2>
              <p style={{ color: '#666' }}>Dieser Betrag wird verwendet, wenn ein Spieler nach der Deadline noch einmal tippt.</p>
              <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
                <input type="number" value={latePenaltyAmount} onChange={(e) => setLatePenaltyAmount(e.target.value)} />
                <button onClick={saveLatePenaltyAmount} disabled={savingLatePenalty}>{savingLatePenalty ? 'Speichert...' : 'Tippstrafe speichern'}</button>
              </div>
              {latePenaltyMessage && <p>{latePenaltyMessage}</p>}
            </section>

            <section style={sectionStyle}>
              <h2>Finanzhistorie</h2>
              {transactions.length === 0 ? <p>Keine Finanzbewegungen gefunden.</p> : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {transactions.map((transaction) => (
                    <div key={transaction.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, background: transaction.amount >= 0 ? '#f0fff4' : '#fff0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{transaction.title}</strong>
                        <strong>{transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)} €</strong>
                      </div>
                      <div style={{ color: '#666', marginTop: 6 }}>{transaction.season_name ?? 'Ohne Saison'} · {transaction.type}</div>
                      {transaction.description && <div style={{ marginTop: 6 }}>{transaction.description}</div>}
                      <div style={{ marginTop: 6, fontSize: 14 }}>{new Date(transaction.created_at).toLocaleString()}</div>
                      <button onClick={() => deleteTransaction(transaction.id)} style={{ marginTop: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Finanzbewegung löschen</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={sectionStyle}>
              <h2>Bundesliga Preisgeld-Regeln</h2>
              <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map((rank) => (
                  <label key={rank} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 12 }}>
                    <span>Platz {rank}</span>
                    <input type="number" value={prizeRules[rank] ?? ''} onChange={(e) => updatePrizeRule(rank, e.target.value)} placeholder="0" />
                  </label>
                ))}
              </div>
              <button onClick={savePrizeRules} disabled={savingRules} style={{ marginTop: 20 }}>{savingRules ? 'Speichert...' : 'Bundesliga-Regeln speichern'}</button>
              {rulesMessage && <p>{rulesMessage}</p>}
            </section>

            <section style={sectionStyle}>
              <h2>Sondertipps Preisgeld</h2>
              <label style={clPrizeRowStyle}><span>Sondertipps-Sieger</span><input type="number" value={specialPrizeRules.winner} onChange={(e) => updateSpecialPrizeRule(e.target.value)} placeholder="0" /></label>
              <button onClick={saveSpecialPrizeRules} disabled={savingSpecialRules} style={{ marginTop: 20 }}>{savingSpecialRules ? 'Speichert...' : 'Sondertipps-Preisgeld speichern'}</button>
              {specialRulesMessage && <p>{specialRulesMessage}</p>}
            </section>

            <section style={sectionStyle}>
              <h2>Champions League Preisgeld-Regeln</h2>
              <div style={{ display: 'grid', gap: 12, maxWidth: 450 }}>
                <label style={clPrizeRowStyle}><span>Sieger</span><input type="number" value={clPrizeRules.winner} onChange={(e) => updateClPrizeRule('winner', e.target.value)} placeholder="0" /></label>
                <label style={clPrizeRowStyle}><span>Finalist</span><input type="number" value={clPrizeRules.finalist} onChange={(e) => updateClPrizeRule('finalist', e.target.value)} placeholder="0" /></label>
                <label style={clPrizeRowStyle}><span>Halbfinalisten</span><input type="number" value={clPrizeRules.semifinalist} onChange={(e) => updateClPrizeRule('semifinalist', e.target.value)} placeholder="0" /></label>
              </div>
              <button onClick={saveClPrizeRules} disabled={savingClRules} style={{ marginTop: 20 }}>{savingClRules ? 'Speichert...' : 'CL-Preisgeld speichern'}</button>
              {clRulesMessage && <p>{clRulesMessage}</p>}
            </section>
          </>
        )}
      </main>
    </>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 14, background: '#fafafa' }}><div style={{ color: '#666', fontSize: 13 }}>{title}</div><strong style={{ fontSize: 18 }}>{value}</strong></div>
}

const sectionStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 10, padding: 20, marginBottom: 32 }
const summaryGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 760 }
const thStyle: React.CSSProperties = { padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd', background: '#f5f5f5' }
const tdStyle: React.CSSProperties = { padding: 10, borderBottom: '1px solid #eee' }
const clPrizeRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12, maxWidth: 450 }
