import { useState } from 'react'
import LetterPhoto from './LetterPhoto'
import PhotoPicker from './PhotoPicker'

// Under an open letter: what you answered, and a place to answer
export default function LetterReply({ note, notes }) {
  const [writing, setWriting] = useState(false)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const replies = notes.repliesTo(note)
  const empty = !body.trim() && !photo

  async function send(e) {
    e.preventDefault()
    if (empty || busy) return
    setBusy(true)
    setError('')
    const ok = await notes.sendReply(note, body.trim(), photo?.blob ?? null)
    setBusy(false)
    if (!ok) return setError('Your reply wasn’t sent. Check your connection and try again.')
    setBody('')
    setPhoto(null)
    setWriting(false)
  }

  function cancel() {
    setPhoto(null)
    setWriting(false)
  }

  return (
    <div className="letter-reply">
      {replies.map((r) => (
        <div key={r.id} className="reply-sent">
          <span className="field-label">You replied</span>
          {r.body && <p>{r.body}</p>}
          {r.photo_path && <LetterPhoto path={r.photo_path} alt="The photo in your reply" />}
        </div>
      ))}
      {writing ? (
        <form onSubmit={send}>
          <textarea className="letter-input" aria-label={`Reply to ${notes.authorName(note)}`} autoFocus rows={3} maxLength={1000}
            placeholder="Write back…" value={body} onChange={(e) => setBody(e.target.value)} />
          <PhotoPicker photo={photo} onChange={setPhoto} disabled={busy} />
          {error && <p className="error on-paper" role="alert">{error}</p>}
          <div className="reply-actions">
            <button className="ink-btn is-solid" disabled={busy || empty}>{busy ? 'Sending…' : 'Send reply'}</button>
            <button type="button" className="sheet-close" disabled={busy} onClick={cancel}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="ink-btn" onClick={() => setWriting(true)}>{replies.length ? 'Reply again' : 'Reply'}</button>
      )}
    </div>
  )
}
