import { useState } from 'react'
import PaperSheet from './PaperSheet'

const NAME_MAX = 200

// Write a note, or edit one when `note` is given. A name, a text, done.
export default function NoteSheet({ note, group, notebook, onClose }) {
  const [opened, setOpened] = useState(note) // the version these words are based on
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [error, setError] = useState('')
  const changed = title !== (note?.title ?? '') || body !== (note?.body ?? '')
  const empty = !title.trim() && !body.trim()

  async function save() {
    if (empty || busy) return
    setBusy(true)
    setError('')
    // Without a name, the first line of the text is the name
    const [first, ...rest] = body.trim().split('\n')
    const fields = title.trim() || first.length > NAME_MAX
      ? { title: title.trim() || first.slice(0, NAME_MAX), body: body.trim() }
      : { title: first, body: rest.join('\n').trim() }
    try {
      const res = await notebook.saveNote(opened, group, fields)
      if (res.row) return onClose()
      setOpened(res.conflict ?? null)
      setError(res.gone
        ? 'This note was deleted on another device. Save again to keep it.'
        : `This note was changed on another device to “${[res.conflict.title, res.conflict.body].filter(Boolean).join(': ').slice(0, 120)}”. Save again to keep yours.`)
    } catch {
      setError('The note wasn’t saved. Check your connection and try again.')
    }
    setBusy(false)
  }

  async function remove() {
    if (!sure) return setSure(true)
    setBusy(true)
    setError('')
    try {
      await notebook.removeNote(note)
      onClose()
    } catch {
      setError('The note wasn’t deleted. Check your connection and try again.')
      setBusy(false)
      setSure(false)
    }
  }

  return (
    <PaperSheet title={note ? 'Edit note' : 'New note'} onClose={onClose} onSubmit={save} keepOpen={changed}>
      <input className="line-input big-input" autoFocus={!note} maxLength={NAME_MAX} aria-label="Name" placeholder="Name"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      {/* No autocorrect: it would quietly change a password */}
      <textarea className="line-input note-text" rows={4} maxLength={20000} aria-label="Text" placeholder="Write it here"
        autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
        value={body} onChange={(e) => setBody(e.target.value)} />
      {error && <p className="error on-paper" role="alert">{error}</p>}
      <button className="btn btn-ink" disabled={busy || empty}>{busy ? 'Saving…' : 'Save note'}</button>
      {note && (
        <div className="sheet-more">
          <button type="button" className="ink-btn danger" disabled={busy} onClick={remove}>{sure ? 'Tap again to delete' : 'Delete note'}</button>
        </div>
      )}
    </PaperSheet>
  )
}
