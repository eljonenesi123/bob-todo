import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak } from '../lib/stats'
import './DayComplete.css'

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 0.37) % 3}s`,
  duration: `${2.6 + ((i * 0.53) % 1.4)}s`,
  size: 6 + ((i * 5) % 7),
  round: i % 3 === 0,
  silver: i % 2 === 1,
}))

export default function DayComplete({ notes, total, onClose }) {
  const { tasks, completions, today } = useTaskData()
  // Pick the note once, so it doesn't swap while she reads it
  const [note] = useState(() => notes.nextLocked)
  const [open, setOpen] = useState(false)
  const streak = currentStreak(tasks, completions, today)

  function openIt() {
    setOpen(true)
    if (note) notes.openNote(note)
  }

  return (
    <motion.div className="dc-overlay" role="dialog" aria-modal="true" aria-label="Day complete"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="dc-confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span key={i} style={{
            left: c.left, width: c.size, height: c.round ? c.size : c.size * 1.5,
            borderRadius: c.round ? '50%' : 3, background: c.silver ? 'var(--silver)' : 'var(--yellow)',
            animationDelay: c.delay, animationDuration: c.duration,
          }} />
        ))}
      </div>

      <div className="dc-content">
        <motion.div className="dc-badge" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
        </motion.div>

        <motion.div className="dc-head" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h1>All done for today</h1>
          <p>{total} of {total} done.{streak > 1 ? ` That’s ${streak} days in a row.` : ''}</p>
        </motion.div>

        {note && (
          <motion.section className="dc-note" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <AnimatePresence mode="wait">
              {!open ? (
                <motion.div key="sealed" className="dc-sealed" exit={{ opacity: 0, scale: 0.9 }}>
                  <svg className="dc-envelope" width="120" height="84" viewBox="0 0 120 84" aria-hidden="true">
                    <rect x="2" y="2" width="116" height="80" rx="10" fill="#2B2D31" />
                    <path d="M4 6 L60 46 L116 6" fill="none" stroke="#4A4C52" strokeWidth="3" strokeLinejoin="round" />
                    <circle cx="60" cy="46" r="15" fill="#FFC93C" />
                    <path d="M60 52c-5-3.5-8-6-8-9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-3 5.5-8 9z" fill="#2B2D31" />
                  </svg>
                  <p className="dc-kicker">You unlocked</p>
                  <h2>A note from {notes.authorName(note)}</h2>
                  <button type="button" className="btn dc-open" onClick={openIt}>Open it</button>
                </motion.div>
              ) : (
                <motion.div key="open" className="dc-letter"
                  initial={{ opacity: 0, rotateX: -60 }} animate={{ opacity: 1, rotateX: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 16 }}>
                  <p className="dc-kicker">From {notes.authorName(note)}</p>
                  <p className="dc-body">{note.body}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        <motion.section className="dc-thought" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <p className="dc-kicker">Tonight's thought</p>
          <p>You showed up for yourself today. Rest well, tomorrow is a fresh page.</p>
        </motion.section>

        <button type="button" className="btn btn-ghost dc-back" onClick={onClose}>Back to today</button>
      </div>
    </motion.div>
  )
}
