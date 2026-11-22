import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { toISO } from '../lib/dates'
import { isIOS, isStandalone, notificationsSupported } from '../lib/pwa'
import { enablePush, disablePush, getSubscription } from '../lib/push'
import './Nudges.css'

const SCHEDULE = [
  { time: '13:00', name: 'Midday check', when: 'If less than half is done' },
  { time: '17:00', name: 'Big three push', when: 'If a Big three task is open' },
  { time: '20:00', name: 'Streak saver', when: 'If your streak is at risk' },
  { time: '21:30', name: 'Evening wrap', when: 'If tasks are left' },
  { time: '19:00', day: 'Sun', name: 'Weekly recap', when: 'Every Sunday evening' },
]

const STYLES = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'sweet_hype', label: 'Sweet and hype' },
  { id: 'tough_love', label: 'Tough love' },
]

function Switch({ on, label, disabled, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={onClick}>
      <motion.span layout className="switch-knob" transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
    </button>
  )
}

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
    <main className="paper-page tab-screen nudges">
      <header className="desk-head">
        <h1 className="page-title">Nudges</h1>
        <p className="page-sub">Only sent when tasks are still open.</p>
      </header>

      <section className="pad" aria-label="Nudge settings">
        <section className="pad-section">
          <h2 className="pad-h">On this device</h2>
          <div className="ruled">
            <div className="pad-line">
              <span className="row-margin" aria-hidden="true"><span className={`bell ${on ? 'is-on' : ''}`} /></span>
              <span className="line-body">
                <span className="line-title">{on ? 'Nudges are on' : 'Nudges are off'}</span>
                <span className="line-sub">{on ? 'Bob can tap you on the shoulder here.' : statusHint(permission)}</span>
              </span>
              {permission !== 'denied' && permission !== 'unsupported' && (
                <span className="line-end">
                  <Switch on={on} label="Nudges on this device" disabled={busy} onClick={on ? turnOff : turnOn} />
                </span>
              )}
            </div>
            <div className="pad-line">
              <span className="row-margin" />
              <span className="line-body">
                <span className="line-title">Snooze for today</span>
                <span className="line-sub">{snoozed ? 'No nudges until tomorrow.' : 'Need a quiet day? Pause them.'}</span>
              </span>
              <span className="line-end">
                <Switch on={snoozed} label="Snooze nudges for today" onClick={() => update({ snoozed_on: snoozed ? null : today })} />
              </span>
            </div>
          </div>
          {error && (
            <p className="pad-note error" role="alert">
              Couldn’t turn on nudges: {error}. Try again, or check that notifications are allowed for Bob.
            </p>
          )}
        </section>

        <section className="pad-section">
          <h2 className="pad-h">Your day with Bob</h2>
          <ol className="ruled schedule">
            <li className="pad-line">
              <span className="row-margin sched-time">{profile?.quote_time?.slice(0, 5) ?? '08:00'}</span>
              <span className="line-body"><span className="line-title">Quote of the day</span><span className="line-sub">With a look at today’s list</span></span>
            </li>
            {SCHEDULE.map((s) => (
              <li key={s.name} className="pad-line">
                <span className="row-margin sched-time">{s.day && <small>{s.day}</small>}{s.time}</span>
                <span className="line-body"><span className="line-title">{s.name}</span><span className="line-sub">{s.when}</span></span>
              </li>
            ))}
            <li className="pad-line">
              <span className="row-margin sched-time" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </span>
              <span className="line-body"><span className="line-title">Task reminders</span><span className="line-sub">At the time you pick on a task</span></span>
            </li>
          </ol>
        </section>

        {profile && (
          <>
            <section className="pad-section">
              <h2 className="pad-h" id="style-h">Nudge style</h2>
              <div className="pills pad-block" role="group" aria-labelledby="style-h">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" className={`pill ${profile.nudge_style === s.id ? 'is-on' : ''}`}
                    aria-pressed={profile.nudge_style === s.id} onClick={() => update({ nudge_style: s.id })}>{s.label}</button>
                ))}
              </div>
            </section>

            <section className="pad-section">
              <h2 className="pad-h">Times</h2>
              <div className="pad-block time-fields">
                <label className="time-wide">
                  <span className="field-label">Quote of the day arrives at</span>
                  <input type="time" className="line-input" value={profile.quote_time?.slice(0, 5) ?? '08:00'}
                    onChange={(e) => e.target.value && update({ quote_time: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Quiet from</span>
                  <input type="time" className="line-input" value={profile.quiet_start?.slice(0, 5) ?? '22:30'}
                    onChange={(e) => e.target.value && update({ quiet_start: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Quiet until</span>
                  <input type="time" className="line-input" value={profile.quiet_end?.slice(0, 5) ?? '08:00'}
                    onChange={(e) => e.target.value && update({ quiet_end: e.target.value })} />
                </label>
              </div>
            </section>

            <section className="pad-section">
              <h2 className="pad-h"><label htmlFor="display-name">Your name</label></h2>
              <div className="pad-block">
                <input id="display-name" className="line-input" defaultValue={profile.display_name ?? ''} maxLength={40}
                  aria-describedby="display-name-hint"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== profile.display_name) update({ display_name: v }) }} />
                <p id="display-name-hint" className="field-hint">Bob uses it in your nudges.</p>
              </div>
            </section>
          </>
        )}

        <div className="pad-block signout-row">
          <button type="button" className="ink-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </section>
    </main>
  )
}

function statusHint(permission) {
  if (permission === 'denied') return 'Blocked. Turn notifications on for Bob in your phone or browser settings.'
  if (permission === 'unsupported') {
    return isIOS() && !isStandalone()
      ? 'Add Bob to your Home Screen, then open it from the icon to turn nudges on.'
      : 'This browser doesn’t support notifications.'
  }
  return 'Tap the switch to get nudges on this device.'
}
