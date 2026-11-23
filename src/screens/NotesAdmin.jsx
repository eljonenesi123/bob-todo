import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendLetter, deletePhoto, letterWords } from '../lib/photo'
import PhotoPicker from '../components/PhotoPicker'
import './Notes.css'

const fmt = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

async function fetchAdminData(userId) {
  const [people, notes, rewards] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role').neq('id', userId),
    supabase.from('notes').select('*').eq('author_id', userId).order('created_at', { ascending: false }),
    supabase.from('rewards').select('*').eq('author_id', userId).order('streak_required'),
  ])
  return { people: people.data ?? [], notes: notes.data ?? [], rewards: rewards.data ?? [] }
}

// How many devices the other person has connected; null if we can't tell (e.g. SQL 05 not run yet)
async function fetchDevices(personId) {
  if (!personId) return null
  const { data, error } = await supabase.rpc('push_device_count', { person: personId })
  return error ? null : data
}

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)

// What happened to a note, in plain words. tone: 'done' | 'wait' | 'problem'
function noteStatus(n, devices, who) {
  if (n.opened_at) return { label: `Opened ${fmt(n.opened_at)}`, tone: 'done' }
  if (n.kind === 'day_complete') return { label: 'Opens after a finished day', tone: 'wait' }
  if (n.deliver_at && new Date(n.deliver_at) > new Date()) return { label: `Arrives ${fmt(n.deliver_at)}`, tone: 'wait' }
  if (n.notified_at) return { label: `Sent to ${who}’s phone ${fmt(n.notified_at)}`, tone: 'done' }
  if (devices === 0) return { label: `Not sent: ${who} hasn’t turned on notifications`, tone: 'problem' }
  if (n.notify_error) return { label: 'The phone didn’t take it yet. Bob retries every 5 minutes.', tone: 'problem' }
  return { label: 'Sending in the next few minutes', tone: 'wait' }
}

export default function NotesAdmin({ userId, partner, partnerName, switcher }) {
  const [data, setData] = useState({ people: [], notes: [], rewards: [], loaded: false })
  const [devices, setDevices] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState(null)
  const [sending, setSending] = useState(false)
  const [kind, setKind] = useState('day_complete')
  const [when, setWhen] = useState('')
  const [rewardTitle, setRewardTitle] = useState('')
  const [rewardDays, setRewardDays] = useState(7)
  const [msg, setMsg] = useState('')

  const to = recipient || partner?.id || data.people[0]?.id
  const who = partnerName || 'them'

  const reload = useCallback(async () => {
    setData({ ...(await fetchAdminData(userId)), loaded: true })
  }, [userId])

  useEffect(() => {
    let active = true
    const load = () => fetchAdminData(userId).then((res) => { if (active) setData({ ...res, loaded: true }) })
    load()
    // Keep statuses fresh while the page is open (sent / opened change on their own)
    const timer = setInterval(load, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [userId])

  useEffect(() => {
    let active = true
    fetchDevices(to).then((n) => { if (active) setDevices(n) })
    return () => { active = false }
  }, [to, data.notes])

  async function sendNote(e) {
    e.preventDefault()
    if ((!body.trim() && !photo) || !to || sending) return
    const row = { recipient_id: to, body: body.trim(), kind }
    if (kind === 'surprise') row.deliver_at = when ? new Date(when).toISOString() : new Date().toISOString()
    setSending(true)
    setMsg('')
    try {
      await sendLetter(userId, row, photo?.blob ?? null)
    } catch {
      setSending(false)
      return setMsg('The letter wasn’t saved. Check your connection and try again.')
    }
    setSending(false)
    setBody(''); setWhen(''); setPhoto(null)
    setMsg(kind === 'surprise' ? 'Saved. Bob sends it at that time.' : `Saved. ${who === 'them' ? 'It' : who} opens after a finished day.`)
    reload()
  }

  async function addReward(e) {
    e.preventDefault()
    if (!rewardTitle.trim() || !to) return
    const { error } = await supabase.from('rewards').insert({ recipient_id: to, title: rewardTitle.trim(), streak_required: Number(rewardDays) || 7 })
    if (error) return setMsg('The reward wasn’t saved. Check your connection and try again.')
    setRewardTitle('')
    setMsg('Reward added.')
    reload()
  }

  async function remove(table, row) {
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (!error) await deletePhoto(row.photo_path)
    reload()
  }

  return (
    <main className="paper-page tab-screen admin">
      <header className="desk-head">
        <h1 className="page-title">Letters</h1>
        {switcher}
      </header>

      <section className="pad" aria-label="Write letters and rewards">
        {data.loaded && data.people.length === 0 && (
          <p className="pad-note admin-empty">Nobody else has signed up yet. Once they do, you can write to them here.</p>
        )}

        {data.people.length > 1 && (
          <section className="pad-section">
            <h2 className="pad-h"><label htmlFor="write-to">Write to</label></h2>
            <div className="pad-block">
              <select id="write-to" className="line-input" value={to} onChange={(e) => setRecipient(e.target.value)}>
                {data.people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.id.slice(0, 8)}</option>)}
              </select>
            </div>
          </section>
        )}

        {devices === 0 && (
          <p className="pad-note error" role="status">
            {partnerName || 'The other account'} hasn’t turned on notifications yet, so surprises only show up when Bob is opened. They can be turned on in the Nudges tab.
          </p>
        )}

        <form className="pad-section" onSubmit={sendNote}>
          <h2 className="pad-h">Write a letter</h2>
          <div className="pad-block admin-form">
            <div className="pills" role="group" aria-label="When it arrives">
              <button type="button" className={`pill ${kind === 'day_complete' ? 'is-on' : ''}`} aria-pressed={kind === 'day_complete'} onClick={() => setKind('day_complete')}>After a finished day</button>
              <button type="button" className={`pill ${kind === 'surprise' ? 'is-on' : ''}`} aria-pressed={kind === 'surprise'} onClick={() => setKind('surprise')}>Surprise at a time</button>
            </div>
            <textarea className="letter-input" aria-label="Your message" value={body} onChange={(e) => setBody(e.target.value)}
              maxLength={1000} rows={4} placeholder="Proud of you today…" />
            <PhotoPicker photo={photo} onChange={setPhoto} disabled={sending} />
            {kind === 'surprise' && (
              <label className="admin-field">
                <span className="field-label">Arrives at (leave empty to send now)</span>
                <input type="datetime-local" className="line-input" value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
            )}
            <button className="btn btn-ink" disabled={(!body.trim() && !photo) || !to || sending}>{sending ? 'Saving…' : 'Save letter'}</button>
            {msg && <p className="field-hint" role="status">{msg}</p>}
          </div>
        </form>

        <form className="pad-section" onSubmit={addReward}>
          <h2 className="pad-h">Add a reward</h2>
          <div className="pad-block admin-form">
            <div className="inline-fields">
              <input className="line-input" aria-label="Reward" placeholder="Date night, you pick" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} maxLength={80} />
              <label className="admin-field">
                <span className="field-label">Days</span>
                <input className="line-input" type="number" min={1} max={60} value={rewardDays} onChange={(e) => setRewardDays(e.target.value)} />
              </label>
            </div>
            <button className="btn btn-ink" disabled={!rewardTitle.trim() || !to}>Add reward</button>
          </div>
        </form>

        {data.notes.length > 0 && (
          <section className="pad-section">
            <h2 className="pad-h">Your letters</h2>
            <ul className="ruled">
              {data.notes.map((n) => {
                const s = noteStatus(n, devices, who)
                return (
                  <li key={n.id} className="pad-line">
                    <span className="row-margin" aria-hidden="true"><span className={`status-dot ${s.tone}`} /></span>
                    <span className="line-body">
                      <span className="admin-note-body">{letterWords(n)}</span>
                      <span className={`line-sub status-${s.tone}`}>{n.kind === 'reply' ? `Your reply. ${s.label}` : s.label}</span>
                    </span>
                    {!n.opened_at && (
                      <span className="line-end">
                        <button type="button" className="del-btn" aria-label="Delete letter" onClick={() => remove('notes', n)}><TrashIcon /></button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {data.rewards.length > 0 && (
          <section className="pad-section">
            <h2 className="pad-h">Rewards</h2>
            <ul className="ruled">
              {data.rewards.map((r) => (
                <li key={r.id} className="pad-line">
                  <span className="row-margin" aria-hidden="true"><span className={`status-dot ${r.claimed_at ? 'done' : 'wait'}`} /></span>
                  <span className="line-body">
                    <span className="line-title">{r.title}</span>
                    <span className="line-sub">{r.claimed_at ? `Claimed ${fmt(r.claimed_at)}` : `Unlocks at a ${r.streak_required}-day streak`}</span>
                  </span>
                  {!r.claimed_at && (
                    <span className="line-end">
                      <button type="button" className="del-btn" aria-label="Delete reward" onClick={() => remove('rewards', r)}><TrashIcon /></button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  )
}
