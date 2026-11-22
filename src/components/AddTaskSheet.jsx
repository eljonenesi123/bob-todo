import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORIES, REPEATS } from '../lib/categories'

export default function AddTaskSheet({ open, onClose, onAdd, bigCount, days, day }) {
  return (
    <AnimatePresence>
      {open && <Sheet key="sheet" onClose={onClose} onAdd={onAdd} bigCount={bigCount} days={days} day={day} />}
    </AnimatePresence>
  )
}

function Pills({ legend, options, value, onChange }) {
  return (
    <fieldset className="pills-group">
      <legend>{legend}</legend>
      <div className="pills">
        {options.map((o) => (
          <button type="button" key={o.id} className={`pill ${value === o.id ? 'is-on' : ''}`}
            aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  )
}

// Mounted fresh every time the sheet opens, so the form always starts empty
function Sheet({ onClose, onAdd, bigCount, days, day }) {
  const [form, setForm] = useState({ title: '', is_big3: false, repeat: 'once', remind_at: '', category: 'personal', due_on: day })
  const [steps, setSteps] = useState([])
  const [stepDraft, setStepDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isToday = form.due_on === days[0]?.iso
  const bigFull = isToday && bigCount >= 3

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  function addStep() {
    const t = stepDraft.trim()
    if (!t) return
    setSteps((s) => [...s, t])
    setStepDraft('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    try {
      const pending = stepDraft.trim() ? [...steps, stepDraft.trim()] : steps
      await onAdd({ ...form, title: form.title.trim(), remind_at: form.remind_at || null, steps: pending })
      onClose()
    } catch {
      setError('That task wasn’t saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const dayOptions = days.map((d, i) => ({ id: d.iso, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${d.dow} ${d.num}` }))

  return (
    <>
      <motion.div className="sheet-backdrop" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.form
        className="sheet paper" onSubmit={submit} aria-label="New task"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>New task</h2>
          <button type="button" className="sheet-close" onClick={onClose}>Cancel</button>
        </div>

        <input className="line-input big-input" autoFocus maxLength={200} aria-label="Task"
          value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs doing?" />

        <Pills legend="When" options={dayOptions} value={form.due_on} onChange={(v) => set('due_on', v)} />

        <label className={`big3-check ${form.is_big3 ? 'is-on' : ''} ${bigFull && !form.is_big3 ? 'is-full' : ''}`}>
          <input type="checkbox" checked={form.is_big3} disabled={bigFull && !form.is_big3}
            onChange={(e) => set('is_big3', e.target.checked)} />
          <span className="big3-text">
            <span className="hl-static">Make it one of the Big three</span>
            <small>{bigFull ? 'Today already has three.' : 'The things that matter most that day.'}</small>
          </span>
        </label>

        <Pills legend="Repeat" options={REPEATS} value={form.repeat} onChange={(v) => set('repeat', v)} />

        {form.repeat === 'once' && (
          <fieldset className="pills-group">
            <legend>Steps <span className="optional">optional</span></legend>
            {steps.length > 0 && (
              <ul className="draft-steps">
                {steps.map((s, i) => (
                  <li key={i}>
                    <span>{s}</span>
                    <button type="button" aria-label={`Remove ${s}`} onClick={() => setSteps((all) => all.filter((_, j) => j !== i))}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="step-entry">
              <input className="line-input" aria-label="New step" maxLength={200}
                placeholder={steps.length ? 'Next step' : 'e.g. Reading, Writing, Editing'}
                value={stepDraft} onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }} />
              <button type="button" className="pill" onClick={addStep} disabled={!stepDraft.trim()}>Add step</button>
            </div>
          </fieldset>
        )}

        <div className="pills-group">
          <label className="legend-like" htmlFor="remind">Remind me at <span className="optional">optional</span></label>
          <input id="remind" type="time" className="line-input time-input"
            value={form.remind_at} onChange={(e) => set('remind_at', e.target.value)} />
        </div>

        <Pills legend="Category" options={CATEGORIES} value={form.category} onChange={(v) => set('category', v)} />

        {error && <p className="error on-paper">{error}</p>}
        <button className="btn btn-ink" disabled={busy || !form.title.trim()}>
          {busy ? 'Adding…' : isToday ? 'Add to today' : `Add to ${dayOptions.find((d) => d.id === form.due_on)?.label ?? 'that day'}`}
        </button>
      </motion.form>
    </>
  )
}
