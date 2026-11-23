import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak } from '../lib/stats'
import LetterPhoto from './LetterPhoto'
import LetterReply from './LetterReply'
import '../screens/Notes.css' // envelope + letter styles
import './DayComplete.css'

export default function DayComplete({ notes, total, onClose }) {
  const { tasks, completions, today } = useTaskData()
  // Pick the note once, so it doesn't swap while she reads it
  const [note] = useState(() => notes.nextLocked)
  const [open, setOpen] = useState(false)
  const streak = currentStreak(tasks, completions, today)
  const reduce = useReducedMotion()

  function openIt() {
    setOpen(true)
    if (note) notes.openNote(note)
  }

  return (
    <motion.div className="dc-overlay" role="dialog" aria-modal="true" aria-label="Day complete"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="dc-content">
        <header className="dc-head">
          <p className="dc-count"><span>{total}</span> of {total}</p>
          <h1><span className="hl dc-hl">All done for today</span></h1>
          {streak > 1 && <p className="dc-streak">That’s {streak} days in a row.</p>}
        </header>

        {note && (
          <section className="dc-note">
            <AnimatePresence mode="wait" initial={false}>
              {!open ? (
                <motion.button key="sealed" type="button" className="envelope dc-envelope" onClick={openIt}
                  exit={{ opacity: 0, y: -10 }}>
                  <span className="envelope-seal" aria-hidden="true" />
                  <span className="envelope-text">
                    <strong>A letter from {notes.authorName(note)}</strong>
                    <span>You unlocked it. Tap to open.</span>
                  </span>
                </motion.button>
              ) : (
                <motion.div key="open" className="dc-letter"
                  initial={reduce ? false : { opacity: 0, rotateX: -50 }} animate={{ opacity: 1, rotateX: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 18 }}>
                  <p className="letter-from">From {notes.authorName(note)}</p>
                  {note.body && <p className="letter-body">{note.body}</p>}
                  {note.photo_path && <LetterPhoto path={note.photo_path} alt={`Photo from ${notes.authorName(note)}`} />}
                  <LetterReply note={note} notes={notes} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        <p className="dc-thought">You showed up for yourself today. Rest well, tomorrow is a fresh page.</p>

        <button type="button" className="dc-back" onClick={onClose} autoFocus={!note}>Back to today</button>
      </div>
    </motion.div>
  )
}
