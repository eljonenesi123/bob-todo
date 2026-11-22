import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak } from '../lib/stats'
import './Notes.css'

const rise = (i) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] },
})

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function Notes({ notes, allDone }) {
  const { tasks, completions, today } = useTaskData()
  const streak = currentStreak(tasks, completions, today)
  const [reading, setReading] = useState(null)

  function read(note) {
    setReading(note)
    if (!note.opened_at) notes.openNote(note)
  }

  return (
    <main className="screen tab-screen notes">
      <motion.div {...rise(0)}>
        <h1 className="page-title">Notes</h1>
        <p className="page-sub">Little messages, just for you.</p>
      </motion.div>

      {notes.surprises.map((n, i) => (
        <motion.button key={n.id} type="button" className="surprise-card" onClick={() => read(n)} {...rise(i + 1)}>
          <span className="surprise-icon" aria-hidden="true">💌</span>
          <span className="surprise-text">
            <strong>New message from {notes.authorName(n)}</strong>
            <span>Tap to open</span>
          </span>
        </motion.button>
      ))}

      <motion.section className="panel" {...rise(2)}>
        <div className="locked-row">
          <svg className="lock-env" width="40" height="30" viewBox="0 0 120 84" aria-hidden="true">
            <rect x="2" y="2" width="116" height="80" rx="10" fill="#D9DADC" />
            <path d="M4 6 L60 46 L116 6" fill="none" stroke="#8D9096" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="60" cy="46" r="15" fill="#FFC93C" />
          </svg>
          <div>
            <h2>{notes.locked.length === 0 ? 'No notes waiting' : `${notes.locked.length} note${notes.locked.length === 1 ? '' : 's'} waiting`}</h2>
            <p className="muted small-text">
              {notes.locked.length === 0 ? 'New ones show up here.' : allDone ? 'Your day is done, one is ready for you!' : 'Finish your day to open one.'}
            </p>
          </div>
        </div>
      </motion.section>

      {notes.rewards.length > 0 && (
        <motion.section className="panel" {...rise(3)}>
          <h2>Your rewards</h2>
          <ul className="reward-list">
            {notes.rewards.map((r) => {
              const ready = !r.claimed_at && streak >= r.streak_required
              return (
                <li key={r.id} className={`reward-item ${r.claimed_at ? 'claimed' : ready ? 'ready' : ''}`}>
                  <span className="reward-gift" aria-hidden="true">🎁</span>
                  <span className="reward-info">
                    <strong>{r.title}</strong>
                    <span>{r.claimed_at ? `Claimed ${fmt(r.claimed_at)}` : ready ? 'Unlocked!' : `${r.streak_required}-day streak · ${Math.max(0, r.streak_required - streak)} to go`}</span>
                  </span>
                  {ready && <button type="button" className="btn claim-btn" onClick={() => notes.claimReward(r)}>Claim</button>}
                </li>
              )
            })}
          </ul>
        </motion.section>
      )}

      {notes.opened.length > 0 && (
        <motion.section className="opened" {...rise(4)}>
          <h2 className="section-title">Opened notes</h2>
          <ul className="opened-list">
            {notes.opened.map((n) => (
              <li key={n.id}>
                <button type="button" className="opened-item" onClick={() => read(n)}>
                  <span className="opened-date">{fmt(n.opened_at)}</span>
                  <span className="opened-body">{n.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <AnimatePresence>
        {reading && (
          <motion.div className="letter-overlay" onClick={() => setReading(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="letter" role="dialog" aria-modal="true" aria-label="Note" onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, y: 30, rotateX: -40 }} animate={{ scale: 1, y: 0, rotateX: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
              <p className="letter-from">From {notes.authorName(reading)}</p>
              <p className="letter-body">{reading.body}</p>
              <button type="button" className="btn btn-primary" onClick={() => setReading(null)}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
