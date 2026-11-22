import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
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

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)

export default function NotesAdmin({ userId }) {
  const [data, setData] = useState({ people: [], notes: [], rewards: [], loaded: false })
  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('day_complete')
  const [when, setWhen] = useState('')
  const [rewardTitle, setRewardTitle] = useState('')
  const [rewardDays, setRewardDays] = useState(7)
  const [msg, setMsg] = useState('')

  const reload = useCallback(async () => {
    setData({ ...(await fetchAdminData(userId)), loaded: true })
  }, [userId])

  useEffect(() => {
    let active = true
    fetchAdminData(userId).then((res) => { if (active) setData({ ...res, loaded: true }) })
    return () => { active = false }
  }, [userId])

  const to = recipient || data.people[0]?.id

  async function sendNote(e) {
    e.preventDefault()
    if (!body.trim() || !to) return
    const row = { recipient_id: to, body: body.trim(), kind }
    if (kind === 'surprise') row.deliver_at = when ? new Date(when).toISOString() : new Date().toISOString()
    const { error } = await supabase.from('notes').insert(row)
    if (error) return setMsg('Could not save the note.')
    setBody(''); setWhen('')
    setMsg(kind === 'surprise' ? 'Surprise scheduled 💌' : 'Note saved. She opens it when she finishes a day 💛')
    reload()
  }

  async function addReward(e) {
    e.preventDefault()
    if (!rewardTitle.trim() || !to) return
    const { error } = await supabase.from('rewards').insert({ recipient_id: to, title: rewardTitle.trim(), streak_required: Number(rewardDays) || 7 })
    if (error) return setMsg('Could not save the reward.')
    setRewardTitle('')
    setMsg('Reward added 🎁')
    reload()
  }

  async function remove(table, id) {
    await supabase.from(table).delete().eq('id', id)
    reload()
  }

  const noteStatus = (n) => {
    if (n.opened_at) return { label: `Opened ${fmt(n.opened_at)}`, cls: 'opened' }
    if (n.kind === 'surprise' && n.deliver_at && new Date(n.deliver_at) > new Date()) return { label: `Arrives ${fmt(n.deliver_at)}`, cls: '' }
    return { label: n.kind === 'surprise' ? 'Delivered' : 'Waiting for a finished day', cls: '' }
  }

  return (
    <main className="screen tab-screen notes">
      <div>
        <h1 className="page-title">Notes for her</h1>
        <p className="page-sub">Only you see this page.</p>
      </div>

      {data.loaded && data.people.length === 0 && (
        <section className="panel"><p className="muted" style={{ margin: 0 }}>She hasn't signed up yet. Once she does, you can write to her here.</p></section>
      )}

      {data.people.length > 1 && (
        <label className="panel">
          <span className="label">Write to</span>
          <select className="field" value={to} onChange={(e) => setRecipient(e.target.value)}>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.id.slice(0, 8)}</option>)}
          </select>
        </label>
      )}

      {msg && <p className="ok" role="status">{msg}</p>}

      <motion.form className="panel" onSubmit={sendNote} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Write a note</h2>
        <div className="seg" role="group" aria-label="When she gets it">
          <button type="button" className={kind === 'day_complete' ? 'on' : ''} aria-pressed={kind === 'day_complete'} onClick={() => setKind('day_complete')}>When she finishes a day</button>
          <button type="button" className={kind === 'surprise' ? 'on' : ''} aria-pressed={kind === 'surprise'} onClick={() => setKind('surprise')}>Surprise at a time</button>
        </div>
        <label className="label" htmlFor="note-body">Your message</label>
        <textarea id="note-body" className="field" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Proud of you today..." />
        {kind === 'surprise' && (
          <>
            <label className="label" htmlFor="note-when">Arrives at (empty = now)</label>
            <input id="note-when" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
          </>
        )}
        <button className="btn btn-primary" disabled={!body.trim() || !to}>Save note</button>
      </motion.form>

      <form className="panel" onSubmit={addReward}>
        <h2>Add a reward</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>She unlocks it with a streak of fully done days.</p>
        <div className="inline-fields">
          <input className="field" aria-label="Reward" placeholder="Date night coupon" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} maxLength={80} />
          <input className="field" aria-label="Streak days" type="number" min={1} max={60} value={rewardDays} onChange={(e) => setRewardDays(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={!rewardTitle.trim() || !to}>Add reward</button>
      </form>

      {data.notes.length > 0 && (
        <section className="panel">
          <h2>Your notes</h2>
          <ul className="admin-list">
            {data.notes.map((n) => {
              const s = noteStatus(n)
              return (
                <li key={n.id} className="admin-item">
                  <div className="admin-item-text">
                    <span className={`status ${s.cls}`}>{s.label}</span>
                    <p>{n.body}</p>
                  </div>
                  {!n.opened_at && <button type="button" className="del-btn" aria-label="Delete note" onClick={() => remove('notes', n.id)}><TrashIcon /></button>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {data.rewards.length > 0 && (
        <section className="panel">
          <h2>Rewards</h2>
          <ul className="admin-list">
            {data.rewards.map((r) => (
              <li key={r.id} className="admin-item">
                <div className="admin-item-text">
                  <span className={`status ${r.claimed_at ? 'opened' : ''}`}>{r.claimed_at ? `Claimed ${fmt(r.claimed_at)}` : `${r.streak_required}-day streak`}</span>
                  <p>{r.title}</p>
                </div>
                {!r.claimed_at && <button type="button" className="del-btn" aria-label="Delete reward" onClick={() => remove('rewards', r.id)}><TrashIcon /></button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
