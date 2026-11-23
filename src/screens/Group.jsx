import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import BackButton from '../components/BackButton'
import GroupSheet from '../components/GroupSheet'
import LockSheet from '../components/LockSheet'
import NoteSheet from '../components/NoteSheet'
import { useOpenNotes } from '../hooks/useOpenNotes'
import LockedGroup from './LockedGroup'

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
)
const DoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
)

// One group: its notes, or the question for its PIN
export default function Group({ group, ...rest }) {
  const { notebook, userId, onClose } = rest
  const notes = useMemo(() => notebook.notes.filter((n) => n.page_id === group.id), [notebook.notes, group.id])
  const key = notebook.keyOf(group)
  if (group.lock && !key) {
    return <LockedGroup group={group} count={notes.length} mine={group.user_id === userId} notebook={notebook} onClose={onClose} />
  }
  return <OpenGroup group={group} stored={notes} lockKey={key} {...rest} />
}

// An open group: every note in it, readable right away
function OpenGroup({ userId, group, stored, lockKey, notebook, partner, partnerName, onClose }) {
  const list = useOpenNotes(group, stored, lockKey)
  const notes = list ?? []
  const [sheet, setSheet] = useState(null) // { kind: 'group' | 'lock' } or { kind: 'note', note? }
  const { setWriting } = notebook
  // While a sheet is open, the group doesn't lock itself (typed words would be lost)
  useEffect(() => {
    setWriting(!!sheet)
    return () => setWriting(false)
  }, [sheet, setWriting])
  const [copied, setCopied] = useState(null) // { id, ok }
  const timer = useRef(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    return () => clearTimeout(timer.current)
  }, [])

  async function copy(note) {
    let ok = true
    try { await navigator.clipboard.writeText(note.body || note.title) } catch { ok = false }
    setCopied({ id: note.id, ok })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2000)
  }

  return (
    <main className="paper-page tab-screen notebook">
      <header className="desk-head page-head">
        <BackButton label="Notebook" onClick={onClose} />
        <span className="head-actions">
          {group.lock && <button type="button" className="desk-btn" onClick={notebook.lockNow}>Lock</button>}
          <button type="button" className="desk-btn" onClick={() => setSheet({ kind: 'group' })}>Edit group</button>
        </span>
      </header>
      <h1 className="page-title group-title">{group.title}</h1>

      <section className="pad" aria-label={group.title}>
        <button type="button" className="write-row" onClick={() => setSheet({ kind: 'note' })}>
          <span className="row-margin"><span className="pen" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span></span>
          <span>Write a note</span>
        </button>
        {!list && <div className="pad-loading" aria-label="Opening" />}
        <ul className="notes-list">
          {notes.map((n) => (
            <li key={n.id} className="pad-line note-line">
              <button type="button" className="note-open" disabled={n.broken} onClick={() => setSheet({ kind: 'note', note: n })}>
                <span className="row-margin" />
                <span className="line-body">
                  <span className="line-title">{n.title}</span>
                  {n.body && <span className="note-body">{n.body}</span>}
                </span>
              </button>
              <button type="button" className="note-copy" aria-label={`Copy ${n.title}`} onClick={() => copy(n)}>
                {copied?.id === n.id && copied.ok ? <DoneIcon /> : <CopyIcon />}
              </button>
            </li>
          ))}
        </ul>
        <p className="pad-note" role="status">
          {copied ? (copied.ok ? 'Copied' : 'It wasn’t copied. Open the note and copy it by hand.') : group.shared_with
            ? (group.user_id === userId ? `Shared with ${partnerName || 'your person'}` : `Shared by ${partnerName || 'your person'}`) : ''}
        </p>
      </section>

      <AnimatePresence>
        {sheet?.kind === 'group' && (
          <GroupSheet key="group" group={group} count={notes.length} notebook={notebook} partner={partner} partnerName={partnerName}
            mine={group.user_id === userId} onClose={() => setSheet(null)} onSaved={() => setSheet(null)} onDeleted={onClose}
            onLock={() => setSheet({ kind: 'lock' })} />
        )}
        {sheet?.kind === 'lock' && (
          <LockSheet key="lock" group={group} notebook={notebook} sharedWith={group.shared_with ? partnerName || 'Your person' : ''} onClose={() => setSheet(null)} />
        )}
        {sheet?.kind === 'note' && (
          <NoteSheet key={sheet.note?.id ?? 'new'} note={sheet.note} group={group} notebook={notebook} onClose={() => setSheet(null)} />
        )}
      </AnimatePresence>
    </main>
  )
}
