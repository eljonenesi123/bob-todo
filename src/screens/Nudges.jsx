import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { toISO } from '../lib/dates'
import { isIOS, isStandalone, notificationsSupported } from '../lib/pwa'
import { enablePush, disablePush, getSubscription } from '../lib/push'
import './Nudges.css'

const SCHEDULE = [
  { time: '13:00', name: 'Midday check', when: 'If less than half is done' },
  { time: '17:00', name: 'Big 3 push', when: 'If a Big 3 task is open' },
  { time: '20:00', name: 'Streak saver', when: 'If your streak is at risk' },
  { time: '21:30', name: 'Evening wrap', when: 'If tasks are left' },
  { time: 'Sun 19:00', name: 'Weekly recap', when: 'Every Sunday' },
]

const STYLES = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'sweet_hype', label: 'Sweet + hype' },
  { id: 'tough_love', label: 'Tough love' },
]

const rise = (i) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] },
})

export default function Nudges({ profile, update }) {
  const supported = notificationsSupported()
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = toISO()
  const snoozed = profile?.snoozed_on === today

  useEffect(() => {
    let active = true
    getSubscription().then((s) => { if (active) setSubscribed(!!s) }).catch(() => {})
    return () => { active = false }
  }, [])

  async function turnOn() {
    setBusy(true)
    setError('')
    try {
      const result = await enablePush()
      setSubscribed(result === 'granted')
      if (result !== 'granted') setError(`Permission: ${result}`)
    } catch (e) {
      setSubscribed(false)
      setError(e?.message || String(e))
    }
    setPermission(supported ? Notification.permission : 'unsupported')
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    await disablePush().catch(() => {})
    setSubscribed(false)
    setBusy(false)
  }

  const on = permission === 'granted' && subscribed

  return (
    <main className="screen tab-screen nudges">
      <motion.div {...rise(0)}>
        <h1 className="page-title">Nudges</h1>
        <p className="page-sub">Only sent when tasks are still open.</p>
      </motion.div>

      <motion.section className={`panel status-panel ${on ? 'is-on' : ''}`} {...rise(1)}>
        <div className="row-between" style={{ alignItems: 'center' }}>
          <div>
            <h2>{on ? 'Nudges are on' : 'Nudges are off'}</h2>
            <p className="muted small-note">{on ? 'On this device' : statusHint(permission)}</p>
          </div>
          {permission !== 'denied' && permission !== 'unsupported' && (
            <button type="button" role="switch" aria-checked={on} aria-label="Nudges on this device"
              className={`switch ${on ? 'on' : ''}`} disabled={busy} onClick={on ? turnOff : turnOn}>
              <motion.span layout className="switch-knob" transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
            </button>
          )}
        </div>
        {error && <p className="error" role="alert">Couldn't turn on nudges: {error}</p>}
      </motion.section>

      <motion.section className="panel" {...rise(2)}>
        <div className="row-between" style={{ alignItems: 'center' }}>
          <div>
            <h2>Snooze for today</h2>
            <p className="muted small-note">{snoozed ? 'No nudges until tomorrow' : 'Need a quiet day? Pause them.'}</p>
          </div>
          <button type="button" role="switch" aria-checked={snoozed} aria-label="Snooze nudges for today"
            className={`switch ${snoozed ? 'on' : ''}`} onClick={() => update({ snoozed_on: snoozed ? null : today })}>
            <motion.span layout className="switch-knob" transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
          </button>
        </div>
      </motion.section>

      <motion.section className="panel" {...rise(3)}>
        <h2>Your day with Bob</h2>
        <ol className="schedule">
          <li>
            <span className="sched-time">{profile?.quote_time?.slice(0, 5) ?? '08:00'}</span>
            <span className="sched-text"><strong>Quote of the day</strong><span>With a look at today's list</span></span>
          </li>
          {SCHEDULE.map((s) => (
            <li key={s.name}>
              <span className="sched-time">{s.time}</span>
              <span className="sched-text"><strong>{s.name}</strong><span>{s.when}</span></span>
            </li>
          ))}
          <li>
            <span className="sched-time">Any</span>
            <span className="sched-text"><strong>Task reminders</strong><span>At the time you pick on a task</span></span>
          </li>
        </ol>
      </motion.section>

      {profile && (
        <motion.section className="panel" {...rise(4)}>
          <h2>Nudge style</h2>
          <div className="chips">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className={`chip ${profile.nudge_style === s.id ? 'active' : ''}`}
                aria-pressed={profile.nudge_style === s.id} onClick={() => update({ nudge_style: s.id })}>{s.label}</button>
            ))}
          </div>

          <h2 style={{ marginTop: 8 }}>Quote of the day</h2>
          <label className="quote-time">
            <span className="label">Arrives at</span>
            <input type="time" className="field" value={profile.quote_time?.slice(0, 5) ?? '08:00'}
              onChange={(e) => e.target.value && update({ quote_time: e.target.value })} />
          </label>

          <h2 style={{ marginTop: 8 }}>Quiet hours</h2>
          <div className="quiet-row">
            <label>
              <span className="label">From</span>
              <input type="time" className="field" value={profile.quiet_start?.slice(0, 5) ?? '22:30'}
                onChange={(e) => e.target.value && update({ quiet_start: e.target.value })} />
            </label>
            <label>
              <span className="label">Until</span>
              <input type="time" className="field" value={profile.quiet_end?.slice(0, 5) ?? '08:00'}
                onChange={(e) => e.target.value && update({ quiet_end: e.target.value })} />
            </label>
          </div>
        </motion.section>
      )}

      {profile && (
        <motion.section className="panel" {...rise(5)}>
          <label className="label" htmlFor="display-name">Your name (used in nudges)</label>
          <input id="display-name" className="field" defaultValue={profile.display_name ?? ''} maxLength={40}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== profile.display_name) update({ display_name: v }) }} />
        </motion.section>
      )}

      <button type="button" className="btn btn-ghost signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}

function statusHint(permission) {
  if (permission === 'denied') return 'Blocked. Turn notifications on for Bob in your phone or browser settings.'
  if (permission === 'unsupported') {
    return isIOS() && !isStandalone()
      ? 'Add Bob to your Home Screen, then open it from the icon to turn nudges on.'
      : "This browser doesn't support notifications."
  }
  return 'Tap the switch to get nudges on this device.'
}
