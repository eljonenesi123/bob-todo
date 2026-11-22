import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORIES, REPEATS } from '../lib/categories'

const empty = { title: '', is_big3: false, repeat: 'once', remind_at: '', category: 'personal' }

export default function AddTaskSheet({ open, onClose, onAdd, bigCount }) {
  return (
    <AnimatePresence>
      {open && <Sheet key="sheet" onClose={onClose} onAdd={onAdd} bigCount={bigCount} />}
    </AnimatePresence>
  )
}

// Mounted fresh every time the sheet opens, so the form always starts empty
function Sheet({ onClose, onAdd, bigCount }) {
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bigFull = bigCount >= 3

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    try {
      await onAdd({ ...form, title: form.title.trim(), remind_at: form.remind_at || null })
      onClose()
    } catch {
      setError('Could not save that task. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
        <>
          <motion.div className="sheet-backdrop" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.form
            className="sheet" onSubmit={submit} aria-label="New task"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120) onClose() }}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <h2>New task</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <label className="label" htmlFor="task-title">What do you need to do?</label>
            <input id="task-title" className="field field-focus" autoFocus maxLength={200}
              value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Read chapter 4" />

            <div className="big3-row">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>
              <div className="big3-text">
                <span className="big3-title">Make it a Big 3</span>
                <span className="big3-sub">{bigFull ? 'Big 3 is full today' : `${3 - bigCount} spot${3 - bigCount === 1 ? '' : 's'} left today`}</span>
              </div>
              <button type="button" role="switch" aria-checked={form.is_big3} aria-label="Make it a Big 3"
                className={`switch ${form.is_big3 ? 'on' : ''}`} disabled={bigFull && !form.is_big3}
                onClick={() => set('is_big3', !form.is_big3)}>
                <motion.span layout className="switch-knob" transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
              </button>
            </div>

            <fieldset className="chips-group">
              <legend className="label">Repeat</legend>
              <div className="chips">
                {REPEATS.map((r) => (
                  <button type="button" key={r.id} className={`chip ${form.repeat === r.id ? 'active' : ''}`}
                    aria-pressed={form.repeat === r.id} onClick={() => set('repeat', r.id)}>{r.label}</button>
                ))}
              </div>
            </fieldset>

            <div className="chips-group">
              <label className="label" htmlFor="remind">Remind me (optional)</label>
              <input id="remind" type="time" className="field time-field"
                value={form.remind_at} onChange={(e) => set('remind_at', e.target.value)} />
            </div>

            <fieldset className="chips-group">
              <legend className="label">Category</legend>
              <div className="chips">
                {CATEGORIES.map((c) => (
                  <button type="button" key={c.id} className={`chip ${form.category === c.id ? 'active' : ''}`}
                    aria-pressed={form.category === c.id} onClick={() => set('category', c.id)}>{c.label}</button>
                ))}
              </div>
            </fieldset>

            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={busy || !form.title.trim()}>
              {busy ? 'Adding…' : 'Add task'}
            </button>
          </motion.form>
        </>
  )
}
