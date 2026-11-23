import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import GroupSheet from '../components/GroupSheet'
import Group from './Group'
import Countdowns from './Countdowns'
import './Notebook.css'

const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
const FolderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18V6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>
)

export default function Notebook({ userId, notebook, countdowns, partner, partnerName, view, onView }) {
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const { groups, notes, loading, failed } = notebook
  const open = groups.find((g) => g.id === openId)

  if (open) {
    return <Group key={open.id} userId={userId} group={open} notebook={notebook}
      partner={partner} partnerName={partnerName} onClose={() => { setOpenId(null); window.scrollTo(0, 0) }} />
  }

  const sorted = [...groups].sort((a, b) => a.title.localeCompare(b.title))
  const countOf = (g) => notes.filter((n) => n.page_id === g.id).length

  return (
    <main className="paper-page tab-screen notebook">
      <header className="desk-head">
        <h1 className="page-title">Notebook</h1>
        <div className="pills notes-switch" role="group" aria-label="Notebook">
          <button type="button" className={`pill ${view === 'notes' ? 'is-on' : ''}`} aria-pressed={view === 'notes'} onClick={() => onView('notes')}>Notes</button>
          <button type="button" className={`pill ${view === 'countdowns' ? 'is-on' : ''}`} aria-pressed={view === 'countdowns'} onClick={() => onView('countdowns')}>Countdowns</button>
        </div>
      </header>

      {view === 'countdowns' ? (
        <Countdowns userId={userId} countdowns={countdowns} partner={partner} partnerName={partnerName} />
      ) : (
        <section className="pad" aria-label="Your notes">
          <button type="button" className="write-row" onClick={() => setAdding(true)}>
            <span className="row-margin"><span className="pen" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span></span>
            <span>New group</span>
          </button>

          {loading ? (
            <div className="pad-loading" aria-label="Loading" />
          ) : failed ? (
            <div className="blank">
              <p className="blank-title">Your notebook didn’t open.</p>
              <p className="blank-sub">Check your connection and try again.</p>
              <div className="pad-block"><button type="button" className="ink-btn" onClick={notebook.reload}>Try again</button></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="blank">
              <p className="blank-title">No groups yet.</p>
              <p className="blank-sub">Make one for each kind of note, like gift ideas or recipes, and write inside it.</p>
            </div>
          ) : (
            <ul className="notes-list">
              {sorted.map((g) => {
                const count = countOf(g)
                return (
                  <li key={g.id}>
                    <button type="button" className="pad-line" onClick={() => setOpenId(g.id)}>
                      <span className="row-margin">{g.lock ? <LockIcon /> : <FolderIcon />}</span>
                      <span className="line-body">
                        <span className="line-title">{g.title}</span>
                        <span className="line-sub">{count === 0 ? 'Empty' : `${count} note${count === 1 ? '' : 's'}`}{g.lock ? ', locked' : ''}</span>
                        {g.shared_with && <span className="line-sub">{g.user_id === userId ? `Shared with ${partnerName || 'your person'}` : `Shared by ${partnerName || 'your person'}`}</span>}
                      </span>
                      <span className="line-end go" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <AnimatePresence>
        {adding && (
          <GroupSheet key="new" notebook={notebook} partner={partner} partnerName={partnerName} mine
            onClose={() => setAdding(false)} onSaved={(g) => { setAdding(false); setOpenId(g.id) }} />
        )}
      </AnimatePresence>
    </main>
  )
}
