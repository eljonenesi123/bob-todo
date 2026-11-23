import { useState } from 'react'
import PaperSheet from './PaperSheet'
import CheckRow from './CheckRow'

// New group, or edit one when `group` is given
export default function GroupSheet({ group, count, notebook, partner, partnerName, mine, onClose, onSaved, onDeleted, onLock }) {
  const [title, setTitle] = useState(group?.title ?? '')
  const [shared, setShared] = useState(!!group?.shared_with)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [unlocking, setUnlocking] = useState('')
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const fields = { title: title.trim() }
      if (mine && partner) fields.shared_with = shared ? partner.id : null
      onSaved(await notebook.saveGroup(group, fields))
    } catch {
      setError('The group wasn’t saved. Check your connection and try again.')
      setBusy(false)
    }
  }

  async function removeLock() {
    if (unlocking !== 'sure') return setUnlocking('sure')
    setBusy(true)
    setError('')
    try {
      await notebook.removeLock(group)
      onClose()
    } catch {
      setError('The lock is still on. Check your connection and try again.')
      setBusy(false)
      setUnlocking('')
    }
  }

  async function remove() {
    if (!sure) return setSure(true)
    setBusy(true)
    setError('')
    try {
      await notebook.removeGroup(group)
      onDeleted()
    } catch {
      setError('The group wasn’t deleted. Check your connection and try again.')
      setBusy(false)
      setSure(false)
    }
  }

  return (
    <PaperSheet title={group ? 'Edit group' : 'New group'} onClose={onClose} onSubmit={save}>
      <input className="line-input big-input" autoFocus={!group} maxLength={120} aria-label="Name of the group"
        placeholder="Passwords, gift ideas…" value={title} onChange={(e) => setTitle(e.target.value)} />
      {mine && partner && (
        <CheckRow label={`Share with ${partnerName || 'my person'}`} hint={shared ? 'You both can read and change these notes.' : 'Only you see it.'}
          checked={shared} onChange={setShared} />
      )}
      {error && <p className="error on-paper" role="alert">{error}</p>}
      <button className="btn btn-ink" disabled={busy || !title.trim()}>{group ? 'Save changes' : 'Create group'}</button>
      {group && mine && (
        <div className="sheet-more">
          <button type="button" className="ink-btn" disabled={busy} onClick={onLock}>{group.lock ? 'Change the PIN' : 'Lock with a PIN'}</button>
          {group.lock && <button type="button" className="ink-btn" disabled={busy} onClick={removeLock}>{unlocking ? 'Tap again to remove the lock' : 'Remove the lock'}</button>}
          <button type="button" className="ink-btn danger" disabled={busy} onClick={remove}>
            {!sure ? 'Delete group' : count ? `Tap again to delete it with ${count} note${count === 1 ? '' : 's'}` : 'Tap again to delete'}
          </button>
        </div>
      )}
    </PaperSheet>
  )
}
