import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak } from '../lib/stats'
import './Notes.css'

const fmtDay = (iso) => new Date(iso).getDate()
const fmtMonth = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short' })
const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path className="tick" d="M5 12.5l4.5 4.5L19 7" /></svg>
)

export default function Notes({ notes, allDone }) {
  const { tasks, completions, today } = useTaskData()
  const streak = currentStreak(tasks, completions, today)
  const [reading, setReading] = useState(null)
  const reduce = useReducedMotion()

  function read(note) {
    setReading(note)
    if (!note.opened_at) notes.openNote(note)
  }

  const waiting = notes.locked.length

  return (
    <main className="paper-page tab-screen notes">
      <header className="desk-head">
        <h1 className="page-title">Notes</h1>
        <p className="page-sub">Little messages, just for you.</p>
      </header>

      {notes.surprises.length > 0 && (
        <div className="envelopes">
          {notes.surprises.map((n) => (
            <button key={n.id} type="button" className="envelope" onClick={() => read(n)}>
              <span className="envelope-seal" aria-hidden="true" />
              <span className="envelope-text">
                <strong>A message from {notes.authorName(n)}</strong>
                <span>Tap to open it</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="pad" aria-label="Your notes and rewards">
        <section className="pad-section">
          <h2 className="pad-h">Waiting for you</h2>
          <div className="ruled">
            <div className="pad-line">
              <span className="row-margin" aria-hidden="true">
                <svg width="30" height="22" viewBox="0 0 120 84">
                  <rect x="4" y="4" width="112" height="76" rx="8" fill="none" stroke="var(--ink)" strokeWidth="6" />
                  <path d="M8 10 L60 48 L112 10" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" />
                  {waiting > 0 && <circle cx="60" cy="48" r="15" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="5" />}
                </svg>
              </span>
              <span className="line-body">
                <span className="line-title">{waiting === 0 ? 'No notes waiting' : `${waiting} sealed note${waiting === 1 ? '' : 's'}`}</span>
                <span className="line-sub">
                  {waiting === 0 ? 'New ones show up here.' : allDone ? 'Your day is done, so one is ready for you.' : 'Finish your day to open one.'}
                </span>
              </span>
            </div>
          </div>
        </section>

        {notes.rewards.length > 0 && (
          <section className="pad-section">
            <h2 className="pad-h">Your rewards</h2>
            <ul className="ruled">
              {notes.rewards.map((r) => {
                const ready = !r.claimed_at && streak >= r.streak_required
                return (
                  <li key={r.id} className={`pad-line reward-line ${r.claimed_at ? 'is-claimed' : ''}`}>
                    <span className="row-margin">
                      <span className={`box ${r.claimed_at ? 'is-checked' : ''}`} aria-hidden="true"><Tick /></span>
                    </span>
                    <span className="line-body">
                      <span className="line-title"><span className={ready ? 'hl' : ''}>{r.title}</span></span>
                      <span className="line-sub">
                        {r.claimed_at ? `Claimed ${fmt(r.claimed_at)}` : ready ? 'Unlocked. It’s yours.' : `${r.streak_required}-day streak, ${Math.max(0, r.streak_required - streak)} to go`}
                      </span>
                    </span>
                    {ready && (
                      <span className="line-end">
                        <button type="button" className="ink-btn" onClick={() => notes.claimReward(r)}>Claim</button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {notes.opened.length > 0 && (
          <section className="pad-section">
            <h2 className="pad-h">Opened notes</h2>
            <ul className="ruled">
              {notes.opened.map((n) => (
                <li key={n.id}>
                  <button type="button" className="pad-line opened-line" onClick={() => read(n)}
                    aria-label={`Note from ${fmt(n.opened_at)}: ${n.body}`}>
                    <span className="row-margin opened-date" aria-hidden="true">
                      <strong>{fmtDay(n.opened_at)}</strong>{fmtMonth(n.opened_at)}
                    </span>
                    <span className="line-body"><span className="opened-body">{n.body}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <AnimatePresence>
        {reading && (
          <motion.div className="letter-overlay" onClick={() => setReading(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="letter" role="dialog" aria-modal="true" aria-label={`Note from ${notes.authorName(reading)}`}
              onClick={(e) => e.stopPropagation()}
              initial={reduce ? false : { scale: 0.92, y: 30, rotateX: -35 }} animate={{ scale: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
              <p className="letter-from">From {notes.authorName(reading)}</p>
              <p className="letter-body">{reading.body}</p>
              <button type="button" className="btn btn-ink" onClick={() => setReading(null)} autoFocus>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
