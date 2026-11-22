import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { greeting, prettyDate } from '../lib/dates'
import { quoteOfTheDay } from '../lib/quotes'
import ProgressCard from '../components/ProgressCard'
import TaskRow from '../components/TaskRow'
import AddTaskSheet from '../components/AddTaskSheet'
import EmptyState from '../components/EmptyState'
import './Today.css'

const rise = (i) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] },
})

// Undone first, done sink to the bottom
const byDone = (a, b) => Number(a.done) - Number(b.done)

export default function Today() {
  const { loading, todayTasks, toggle, addTask, removeTask } = useTaskData()
  const [sheetOpen, setSheetOpen] = useState(false)

  const big = todayTasks.filter((t) => t.is_big3).sort(byDone)
  const rest = todayTasks.filter((t) => !t.is_big3).sort(byDone)
  const done = todayTasks.filter((t) => t.done).length
  const total = todayTasks.length

  return (
    <main className="screen today tab-screen">
      <motion.header className="today-header" {...rise(0)}>
        <p className="today-date">{prettyDate()}</p>
        <h1>{greeting()}</h1>
      </motion.header>

      {loading ? (
        <div className="skeleton" aria-label="Loading" />
      ) : total === 0 ? (
        <EmptyState
          onAdd={() => setSheetOpen(true)}
          onQuickAdd={(s) => addTask({ ...s, repeat: 'once', is_big3: false })}
        />
      ) : (
        <>
          <motion.div {...rise(1)}><ProgressCard done={done} total={total} /></motion.div>

          <motion.section className="card quote-card" {...rise(2)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <div>
              <p className="quote-label">Today's spark</p>
              <p className="quote-text">{quoteOfTheDay()}</p>
            </div>
          </motion.section>

          {big.length > 0 && (
            <motion.section className="task-section" {...rise(3)}>
              <div className="section-head">
                <h2 className="section-title yellow">Big 3</h2>
                <span className="section-hint">Do these first</span>
              </div>
              <ul className="task-list">
                <AnimatePresence initial={false}>
                  {big.map((t) => <TaskRow key={t.id} task={t} big onToggle={toggle} onRemove={removeTask} />)}
                </AnimatePresence>
              </ul>
            </motion.section>
          )}

          {rest.length > 0 && (
            <motion.section className="task-section" {...rise(4)}>
              <h2 className="section-title">{big.length ? 'Everything else' : 'Today'}</h2>
              <ul className="task-list">
                <AnimatePresence initial={false}>
                  {rest.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={removeTask} />)}
                </AnimatePresence>
              </ul>
            </motion.section>
          )}

          <p className="swipe-hint">Tip: swipe a task left to delete it.</p>
        </>
      )}

      {total > 0 && (
        <motion.button type="button" className="fab" aria-label="Add task" onClick={() => setSheetOpen(true)}
          initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.4 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </motion.button>
      )}

      <AddTaskSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addTask}
        bigCount={todayTasks.filter((t) => t.is_big3).length} />
    </main>
  )
}
