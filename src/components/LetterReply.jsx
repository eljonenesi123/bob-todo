import { useState } from 'react'

// Under an open letter: what you answered, and a place to answer
export default function LetterReply({ note, notes }) {
  const [writing, setWriting] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const replies = notes.repliesTo(note)

  async function send(e) {
    e.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true)
    setError('')
    const ok = await notes.sendReply(note, body.trim())
    setBusy(false)
    if (!ok) return setError('Your reply wasn’t sent. Check your connection and try again.')
    setBody('')
    setWriting(false)
  }

  return (
    <div className="letter-reply">
      {replies.map((r) => (
        <div key={r.id} className="reply-sent">
          <span className="field-label">You replied</span>
          <p>{r.body}</p>
        </div>
      ))}
      {writing ? (
        <form onSubmit={send}>
          <textarea className="letter-input" aria-label={`Reply to ${notes.authorName(note)}`} autoFocus rows={3} maxLength={1000}
            placeholder="Write back…" value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <p className="error on-paper" role="alert">{error}</p>}
          <div className="reply-actions">
            <button className="ink-btn is-solid" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send reply'}</button>
            <button type="button" className="sheet-close" onClick={() => setWriting(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="ink-btn" onClick={() => setWriting(true)}>{replies.length ? 'Reply again' : 'Reply'}</button>
      )}
    </div>
  )
}
