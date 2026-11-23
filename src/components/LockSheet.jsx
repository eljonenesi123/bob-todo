import { useState } from 'react'
import { PIN_MIN } from '../lib/vault'
import PaperSheet from './PaperSheet'

function PinField({ label, value, onChange, autoFocus }) {
  return (
    <label className="pin-field">
      <span className="legend-like">{label}</span>
      <input className="line-input" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

// Put a PIN on a group, or change it
export default function LockSheet({ group, notebook, sharedWith, onClose }) {
  const [changing] = useState(!!group.lock) // the lock appears while this sheet is still open
  const [half, setHalf] = useState(false)
  const [old, setOld] = useState('')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (busy) return
    if (pin.length < PIN_MIN) return setError(`Use at least ${PIN_MIN} characters.`)
    if (pin !== again) return setError('The two don’t match. Write the new one again.')
    setBusy(true)
    setError('')
    try {
      if (changing) {
        if (!await notebook.changePin(group, old, pin)) {
          setBusy(false)
          return setError('The old PIN isn’t right.')
        }
      } else if (!(await notebook.lockGroup(group, pin)).all) return setHalf(true)
      onClose()
    } catch {
      setError(changing ? 'The PIN wasn’t changed. Check your connection and try again.' : 'The group wasn’t locked. Check your connection and try again.')
      setBusy(false)
    }
  }

  if (half) {
    return (
      <PaperSheet title="The lock is on" onClose={onClose} onSubmit={onClose}>
        <p className="sheet-text">The connection dropped before every note was encrypted. Bob finishes it the next time you open this group with your PIN.</p>
        <button className="btn btn-ink">Okay</button>
      </PaperSheet>
    )
  }

  return (
    <PaperSheet title={changing ? 'Change the PIN' : 'Lock this group'} onClose={onClose} onSubmit={save} keepOpen={!!(old || pin || again)}>
      {!changing && <p className="sheet-text">The notes are encrypted on this device, so the database can’t read them. <strong>If you forget the PIN, nobody can open them again.</strong></p>}
      {changing && <PinField label="Old PIN" value={old} onChange={setOld} autoFocus />}
      <PinField label={changing ? 'New PIN or password' : 'PIN or password'} value={pin} onChange={setPin} autoFocus={!changing} />
      <PinField label="Write it again" value={again} onChange={setAgain} />
      <p className="field-hint">At least {PIN_MIN} characters. Longer is safer, and letters work too.{sharedWith ? ` ${sharedWith} needs it as well.` : ''}</p>
      {error && <p className="error on-paper" role="alert">{error}</p>}
      <button className="btn btn-ink" disabled={busy || !pin || !again || (changing && !old)}>{busy ? 'One moment…' : changing ? 'Change the PIN' : 'Lock the group'}</button>
    </PaperSheet>
  )
}
