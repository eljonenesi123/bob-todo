import { useEffect, useState } from 'react'
import {
  isStandalone, isIOS, notificationsSupported,
  canPromptInstall, onInstallAvailable, promptInstall, markSetupDone,
} from '../lib/pwa'
import { enablePush } from '../lib/push'
import './Auth.css'

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
)

const Mark = ({ done, n }) => (
  <span className={`setup-mark ${done ? 'is-done' : ''}`} aria-hidden="true">{done ? <Check /> : n}</span>
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
    await enablePush().catch(() => {})
    setPermission(Notification.permission)
  }

  function finish() {
    markSetupDone()
    onDone()
  }

  const stepsDone = Number(installed) + Number(permission === 'granted')

  return (
    <main className="auth">
      <header className="auth-head">
        <div className="auth-gap" />
        <h1 className="auth-title">Two quick things</h1>
        <p className="auth-sub">So Bob can cheer you on during the day. <span className="keep">{stepsDone} of 2 done.</span></p>
      </header>

      <section className="auth-sheet">
        <ol className="setup-list">
          <li className="setup-step">
            <Mark done={installed} n={1} />
            <div className="setup-body">
              <h2 className="line-title">{installed ? 'Bob is on your Home Screen' : 'Add Bob to your Home Screen'}</h2>

              {!installed && ios && (
                <ol className="ios-steps">
                  <li>
                    <span className="ios-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
                    </span>
                    Tap Share in Safari
                  </li>
                  <li>
                    <span className="ios-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
                    </span>
                    Choose “Add to Home Screen”
                  </li>
                  <li>
                    <span className="ios-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
                    </span>
                    Open Bob from the new icon
                  </li>
                </ol>
              )}

              {!installed && !ios && canInstall && (
                <button type="button" className="ink-btn" onClick={install}>Install Bob</button>
              )}
              {!installed && !ios && !canInstall && (
                <p className="line-sub">In Chrome or Edge, click the install icon at the right end of the address bar.</p>
              )}
            </div>
          </li>

          <li className="setup-step">
            <Mark done={permission === 'granted'} n={2} />
            <div className="setup-body">
              <h2 className="line-title">{permission === 'granted' ? 'Nudges are on' : 'Turn on nudges'}</h2>
              {permission === 'default' && (
                <>
                  <p className="line-sub">A few friendly reminders a day, only when there’s something left to do. Never during your quiet hours.</p>
                  <button type="button" className="ink-btn" onClick={allowNotifications}>Allow notifications</button>
                </>
              )}
              {permission === 'denied' && (
                <p className="line-sub">Notifications are blocked. You can turn them on later in your phone or browser settings.</p>
              )}
              {permission === 'unsupported' && (
                <p className="line-sub">{ios ? 'Add Bob to your Home Screen first, then open it from the icon to turn on nudges.' : 'This browser doesn’t support notifications.'}</p>
              )}
            </div>
          </li>
        </ol>

        <div className="setup-actions">
          <button type="button" className="btn btn-ink" onClick={finish}>Continue</button>
          {stepsDone < 2 && <button type="button" className="auth-again" onClick={finish}>Skip for now</button>}
        </div>
      </section>
    </main>
  )
}
