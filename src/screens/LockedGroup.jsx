import { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'

// A locked group asks for its PIN before showing anything
export default function LockedGroup({ group, count, mine, notebook, onClose }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [sure, setSure] = useState(false)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  async function open(e) {
    e.preventDefault()
    if (!pin || busy) return
    setBusy(true)
    setError('')
    const ok = await notebook.unlock(group, pin).catch(() => null)
    if (ok) return // the group shows itself
    setBusy(false)
    setPin('')
    setError(ok === false ? 'That PIN isn’t right. Try again.' : 'This browser can’t open locked notes.')
  }

  async function remove() {
    if (!sure) return setSure(true)
    setBusy(true)
    try {
      await notebook.removeGroup(group)
      onClose()
    } catch {
      setBusy(false)
      setSure(false)
      setError('The group wasn’t deleted. Check your connection and try again.')
    }
  }

  return (
    <main className="paper-page tab-screen notebook">
      <header className="desk-head page-head"><BackButton label="Notebook" onClick={onClose} /></header>
      <h1 className="page-title group-title">{group.title}</h1>
      <section className="pad" aria-label="Locked group">
        <form className="pad-block lock-card" onSubmit={open}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></svg>
          <label htmlFor="group-pin">Enter the PIN to see {count === 1 ? 'this note' : 'these notes'}</label>
          <input id="group-pin" className="pin-input" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            autoFocus aria-invalid={!!error} aria-describedby={error ? 'pin-error' : undefined}
            value={pin} onChange={(e) => { setPin(e.target.value); setError('') }} />
          {error && <p id="pin-error" className="error" role="alert">{error}</p>}
          <button className="btn btn-ink" disabled={busy || !pin}>{busy ? 'Opening…' : 'Open'}</button>
        </form>
        <div className="lock-forgot">
          {!forgot ? (
            <button type="button" className="auth-again" onClick={() => setForgot(true)}>Forgot the PIN?</button>
          ) : (
            <>
              <p>Without it, nobody can open these notes, not even Bob. {mine ? 'You can only delete the group.' : 'Ask whoever shared the group.'}</p>
              {mine && (
                <button type="button" className="desk-btn" disabled={busy} onClick={remove}>
                  {sure ? `Tap again to delete it${count ? ` with ${count} note${count === 1 ? '' : 's'}` : ''}` : 'Delete the group'}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
