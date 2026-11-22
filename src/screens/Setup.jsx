import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  isStandalone, isIOS, notificationsSupported,
  canPromptInstall, onInstallAvailable, promptInstall, markSetupDone,
} from '../lib/pwa'
import './Setup.css'

const rise = (i) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: i * 0.1, ease: [0.2, 0.8, 0.2, 1] },
})

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
)

export default function Setup({ onDone }) {
  const [installed, setInstalled] = useState(isStandalone())
  const [canInstall, setCanInstall] = useState(canPromptInstall())
  const [permission, setPermission] = useState(notificationsSupported() ? Notification.permission : 'unsupported')
  const ios = isIOS()

  useEffect(() => onInstallAvailable(setCanInstall), [])

  async function install() {
    if (await promptInstall()) setInstalled(true)
  }

  async function allowNotifications() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  function finish() {
    markSetupDone()
    onDone()
  }

  const stepsDone = Number(installed) + Number(permission === 'granted')

  return (
    <main className="screen setup">
      <div className="setup-progress" aria-label={`Step ${stepsDone + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= stepsDone ? 'on' : ''} />
        ))}
      </div>

      <motion.div {...rise(0)}>
        <h1>Two quick things</h1>
        <p className="setup-sub">So Bob can cheer you on during the day.</p>
      </motion.div>

      {/* 1. Install */}
      <motion.section className={`setup-card ${installed ? 'done' : 'light'}`} {...rise(1)}>
        <div className="setup-card-head">
          <span className="step-num">{installed ? <Check /> : 1}</span>
          <h2>{installed ? 'Bob is installed' : 'Add Bob to your Home Screen'}</h2>
        </div>

        {!installed && ios && (
          <ol className="ios-steps">
            <li>
              <span className="ios-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2D31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
              </span>
              Tap Share in Safari
            </li>
            <li>
              <span className="ios-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2D31" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
              </span>
              Choose "Add to Home Screen"
            </li>
            <li>
              <span className="ios-icon yellow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2D31" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
              </span>
              Open Bob from the new icon
            </li>
          </ol>
        )}

        {!installed && !ios && canInstall && (
          <button type="button" className="btn btn-dark" onClick={install}>Install Bob</button>
        )}

        {!installed && !ios && !canInstall && (
          <p className="setup-note">In Chrome or Edge, click the install icon at the right end of the address bar.</p>
        )}
      </motion.section>

      {/* 2. Notifications */}
      <motion.section className={`setup-card ${permission === 'granted' ? 'done' : ''}`} {...rise(2)}>
        <div className="setup-card-head">
          <span className="step-num">{permission === 'granted' ? <Check /> : 2}</span>
          <h2>{permission === 'granted' ? 'Nudges are on' : 'Turn on nudges'}</h2>
        </div>

        {permission === 'default' && (
          <>
            <p className="setup-note">A few friendly reminders a day, only when there's something left to do. Never after 22:30.</p>
            <button type="button" className="btn btn-primary" onClick={allowNotifications}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              Allow notifications
            </button>
          </>
        )}
        {permission === 'denied' && (
          <p className="setup-note">Notifications are blocked. You can turn them on later in your phone or browser settings.</p>
        )}
        {permission === 'unsupported' && (
          <p className="setup-note">{ios ? 'Add Bob to your Home Screen first, then open it from the icon to turn on nudges.' : "This browser doesn't support notifications."}</p>
        )}
      </motion.section>

      <motion.div className="setup-actions" {...rise(3)}>
        <button type="button" className="btn btn-silver" onClick={finish}>Continue</button>
        <button type="button" className="btn btn-ghost" onClick={finish}>Skip for now</button>
      </motion.div>
    </main>
  )
}
