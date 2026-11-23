import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { deviceStatus } from '../lib/push'

const KINDS = [{ id: true, label: 'Trip' }, { id: false, label: 'Something else' }]
const DEFAULT_TIME = '10:00'

// New countdown, or edit one when `item` is given
export default function CountdownSheet({ open, item, ...rest }) {
  return (
    <AnimatePresence>
      {open && <Sheet key={item?.id ?? 'new'} item={item} {...rest} />}
    </AnimatePresence>
  )
}

function Check({ label, hint, checked, onChange }) {
  return (
    <label className="big3-check is-on">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="big3-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  )
}

function Sheet({ item, onClose, countdowns, userId, partner, partnerName, today }) {
  const [form, setForm] = useState(() => ({
    title: item?.title ?? '',
    on_date: item?.on_date ?? '',
    is_trip: item?.is_trip ?? true,
    remind: item ? !!item.checkin_at : true,
    checkin_at: item?.checkin_at?.slice(0, 5) ?? DEFAULT_TIME,
    shared: !!item?.shared_with,
  }))
  const [pushOff, setPushOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const mine = !item || item.user_id === userId
  const reminding = form.is_trip && form.remind

  // Without notifications on this phone the reminder has nowhere to go
  useEffect(() => {
    let active = true
    deviceStatus().then((s) => { if (active) setPushOff(s !== 'on') }).catch(() => {})
    return () => { active = false }
  }, [])

  async function run(action, message) {
    setBusy(true)
    setError('')
    try {
      await action()
      onClose()
    } catch {
      setError(message)
      setBusy(false)
      setSure(false)
    }
  }

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.on_date) return
    const fields = {
      title: form.title.trim(),
      on_date: form.on_date,
      is_trip: form.is_trip,
      checkin_at: reminding ? form.checkin_at || DEFAULT_TIME : null,
    }
    if (mine && partner) fields.shared_with = form.shared ? partner.id : null
    // Another date is another check-in
    if (item && item.on_date !== form.on_date) fields.checked_in_at = null
    run(() => (item ? countdowns.update(item, fields) : countdowns.add(fields)),
      'The countdown wasn’t saved. Check your connection and try again.')
  }

  function remove() {
    if (!sure) return setSure(true)
    run(() => countdowns.remove(item), 'It wasn’t deleted. Check your connection and try again.')
  }

  return (
    <>
      <motion.div className="sheet-backdrop" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.form className="sheet paper" onSubmit={submit} aria-label={item ? 'Edit countdown' : 'New countdown'}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{item ? 'Edit countdown' : 'New countdown'}</h2>
          <button type="button" className="sheet-close" onClick={onClose}>Cancel</button>
        </div>

        <div className="pills" role="group" aria-label="Kind">
          {KINDS.map((k) => (
            <button type="button" key={k.label} className={`pill ${form.is_trip === k.id ? 'is-on' : ''}`}
              aria-pressed={form.is_trip === k.id} onClick={() => set('is_trip', k.id)}>{k.label}</button>
          ))}
        </div>

        <input className="line-input big-input" autoFocus={!item} maxLength={80} aria-label={form.is_trip ? 'Where to' : 'What is it'}
          placeholder={form.is_trip ? 'Where to?' : 'What is it?'} value={form.title} onChange={(e) => set('title', e.target.value)} />

        <label className="sheet-field">
          <span className="legend-like">{form.is_trip ? 'You leave on' : 'Date'}</span>
          <input type="date" className="line-input" required min={item ? undefined : today} value={form.on_date} onChange={(e) => set('on_date', e.target.value)} />
        </label>

        {form.is_trip && (
          <div className="sheet-check">
            <Check label="Remind me to check in online" checked={form.remind} onChange={(v) => set('remind', v)} />
            {form.remind && (
              <label className="check-time">
                <span>The day before, at</span>
                <input type="time" className="line-input" value={form.checkin_at} onChange={(e) => set('checkin_at', e.target.value)} />
              </label>
            )}
            {form.remind && pushOff && <p className="field-hint">Notifications are off on this device. Turn them on in Nudges.</p>}
          </div>
        )}

        {mine && partner && (
          <Check label={`Share with ${partnerName || 'my person'}`} hint={reminding && form.shared ? 'You both get the reminder.' : ''}
            checked={form.shared} onChange={(v) => set('shared', v)} />
        )}

        {error && <p className="error on-paper" role="alert">{error}</p>}
        <button className="btn btn-ink" disabled={busy || !form.title.trim() || !form.on_date}>
          {busy ? 'Saving…' : item ? 'Save changes' : 'Start counting'}
        </button>
        {item && mine && (
          <div className="sheet-more">
            <button type="button" className="ink-btn danger" disabled={busy} onClick={remove}>{sure ? 'Tap again to delete' : 'Delete countdown'}</button>
          </div>
        )}
      </motion.form>
    </>
  )
}
