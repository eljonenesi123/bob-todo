import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { toISO } from '../lib/dates'
import { isIOS, isStandalone, notificationsSupported } from '../lib/pwa'
import { useConnection } from '../hooks/useConnection'
import { flush, dropOutbox, outboxState } from '../lib/outbox'
import { enablePush, disablePush, deviceStatus } from '../lib/push'
import Backup from '../components/Backup'
import './Nudges.css'

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

export default function Nudges({ userId, profile, update, onPushFixed, partnerName }) {
  // 'on' only when Bob's server really has this device; see deviceStatus()
  const [status, setStatus] = useState(notificationsSupported() ? 'checking' : 'unsupported')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { pending } = useConnection()
  const [leaving, setLeaving] = useState({ busy: false, sure: false, error: '' })
  const today = toISO()
  const snoozed = profile?.snoozed_on === today

  useEffect(() => {
    let active = true
    async function check() {
      try {
        let s = await deviceStatus()
        // Allowed and subscribed, but not saved for this account: repair it quietly
        if (s === 'not-saved') s = (await enablePush()) === 'granted' ? 'on' : await deviceStatus()
        if (active) { setStatus(s); if (s === 'on') onPushFixed?.() }
      } catch (e) {
        if (active) { setStatus('not-saved'); setError(e?.message || String(e)) }
      }
    }
    check()
    return () => { active = false }
  }, [onPushFixed])

  async function turnOn() {
    setBusy(true)
    setError('')
    try {
      const result = await enablePush()
      setStatus(result === 'granted' ? 'on' : result)
      if (result === 'granted') onPushFixed?.()
    } catch (e) {
      setStatus('not-saved')
      setError(e?.message || String(e))
    }
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    await disablePush().catch(() => {})
    setStatus('off')
    setBusy(false)
  }

  // Changes that weren't sent yet would be lost, so ask first
  async function signOut() {
    setLeaving((l) => ({ ...l, busy: true, error: '' }))
    await flush()
    if (outboxState().pending && !leaving.sure) return setLeaving({ busy: false, sure: true, error: '' })
    const { error } = await supabase.auth.signOut()
    if (error) return setLeaving({ busy: false, sure: false, error: 'Signing out needs a connection. Try again later.' })
    dropOutbox()
  }

  const on = status === 'on'
  const permission = status === 'denied' || status === 'unsupported' ? status : 'default'

  return (
    <main className="paper-page tab-screen nudges">
      <header className="desk-head">
        <h1 className="page-title">Nudges</h1>
      </header>

      <section className="pad" aria-label="Nudge settings">
        <section className="pad-section">
          <h2 className="pad-h">On this device</h2>
          <div className="ruled">
            <div className="pad-line">
              <span className="row-margin" aria-hidden="true"><span className={`bell ${on ? 'is-on' : ''}`} /></span>
              <span className="line-body">
                <span className="line-title">{status === 'checking' ? 'Checking this phone…' : on ? 'Nudges are on' : status === 'not-saved' ? 'Not connected yet' : 'Nudges are off'}</span>
                <span className="line-sub">{on ? 'Bob can reach this phone.' : status === 'checking' ? '' : statusHint(status)}</span>
              </span>
              {permission !== 'denied' && permission !== 'unsupported' && status !== 'checking' && (
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
              Bob couldn’t connect this phone ({error}). Turn the switch off and on again. If it still fails, take a screenshot of this message.
            </p>
          )}
          {profile && (
            <div className="ruled share-line">
              <div className="pad-line">
                <span className="row-margin" />
                <span className="line-body">
                  <span className="line-title">Tell {partnerName || 'my person'} when I finish my day</span>
                  <span className="line-sub">{profile.share_day_done ? 'One notification when your list is all done.' : 'Off. Only you can turn this on.'}</span>
                </span>
                <span className="line-end">
                  <Switch on={!!profile.share_day_done} label={`Tell ${partnerName || 'my person'} when I finish my day`}
                    onClick={() => update({ share_day_done: !profile.share_day_done })} />
                </span>
              </div>
            </div>
          )}
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
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== profile.display_name) update({ display_name: v }) }} />
              </div>
            </section>
          </>
        )}

        <Backup userId={userId} />

        <div className="pad-block signout-row">
          <button type="button" className="ink-btn" disabled={leaving.busy} onClick={signOut}>
            {leaving.sure && pending ? `Sign out and lose ${pending === 1 ? 'one change' : `${pending} changes`}` : 'Sign out'}
          </button>
          {leaving.error && <p className="error" role="alert">{leaving.error}</p>}
        </div>
      </section>
    </main>
  )
}

function statusHint(status) {
  if (status === 'denied') return 'Blocked. Turn notifications on for Bob in your phone or browser settings.'
  if (status === 'not-saved') return 'Notifications are allowed, but Bob can’t reach this phone yet. Turn the switch on.'
  if (status === 'unsupported') {
    return isIOS() && !isStandalone()
      ? 'Add Bob to your Home Screen, then open it from the icon to turn nudges on.'
      : 'This browser doesn’t support notifications.'
  }
  return 'Tap the switch to get nudges on this device.'
}
