import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { addDays, greeting } from '../lib/dates'
import { quoteOfTheDay } from '../lib/quotes'
import DayStrip from '../components/DayStrip'
import TaskRow from '../components/TaskRow'
import AddTaskSheet from '../components/AddTaskSheet'
import './Today.css'

const PLAN_AHEAD = 5
const STARTERS = [
  { title: 'Drink 2L of water', category: 'health' },
  { title: 'Ten-minute walk', category: 'health' },
  { title: 'Read ten pages', category: 'study' },
  { title: 'Plan tomorrow', category: 'personal' },
]

const byDone = (a, b) => Number(a.done) - Number(b.done)
const dateOf = (iso) => new Date(iso + 'T12:00:00')

export default function Today() {
  const data = useTaskData()
  const { loading, today, todayTasks, planFor, toggle, addTask, removeTask, addStep, toggleStep, removeStep } = data
  const [selected, setSelected] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const day = selected && selected >= today ? selected : today
  const isToday = day === today

  const days = useMemo(() => Array.from({ length: PLAN_AHEAD + 1 }, (_, i) => {
    const iso = addDays(today, i)
    const d = dateOf(iso)
    const list = planFor(iso)
    return {
      iso,
      isToday: i === 0,
      dow: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      num: d.getDate(),
      label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      count: i === 0 ? list.filter((t) => !t.done).length : list.length,
    }
  }), [today, planFor])

  const list = isToday ? todayTasks : planFor(day)
  const big = list.filter((t) => t.is_big3).sort(byDone)
  const rest = list.filter((t) => !t.is_big3).sort(byDone)
  const done = todayTasks.filter((t) => t.done).length
  const total = todayTasks.length
  const d = dateOf(day)

  const rowProps = { today, future: !isToday, onToggle: toggle, onRemove: removeTask, onAddStep: addStep, onToggleStep: toggleStep, onRemoveStep: removeStep }

  return (
    <main className="today">
      <header className="masthead">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={day} className="mast-date"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
            <span className="mast-num">{d.getDate()}</span>
            <span className="mast-words">
              <span className="mast-dow">{d.toLocaleDateString('en-GB', { weekday: 'long' })}</span>
              <span className="mast-month">{d.toLocaleDateString('en-GB', { month: 'long' })}</span>
            </span>
          </motion.div>
        </AnimatePresence>

        {isToday && total > 0 && (
          <div className="tally" aria-label={`${done} of ${total} done`}>
            <span className="tally-text"><strong>{done}</strong> of {total}</span>
            <span className="tally-bar" aria-hidden="true">
              {todayTasks.map((t) => <i key={t.id} className={t.done ? 'on' : ''} />)}
            </span>
          </div>
        )}
      </header>

      <p className="greeting">
        {isToday ? greeting() : `Planning ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}
      </p>

      <DayStrip days={days} selected={day} onSelect={setSelected} />

      <section className="pad" aria-label={isToday ? 'Today’s list' : `Plan for ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}>
        {isToday && <p className="quote">{quoteOfTheDay()}</p>}

        {loading ? (
          <div className="pad-loading" aria-label="Loading" />
        ) : list.length === 0 ? (
          <div className="blank">
            <p className="blank-title">{isToday ? 'Blank page.' : 'Nothing planned yet.'}</p>
            <p className="blank-sub">{isToday ? 'Write the first thing you want done today, or pick one of these.' : 'Add what you already know is coming, so the day starts with a plan.'}</p>
            {isToday && (
              <ul className="ruled">
                {STARTERS.map((s) => (
                  <li key={s.title}>
                    <button type="button" className="starter" onClick={() => addTask({ ...s, repeat: 'once', is_big3: false })}>
                      <span className="row-margin"><span className="plus-mark" aria-hidden="true">+</span></span>
                      <span>{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            {big.length > 0 && (
              <section className="pad-section">
                <h2 className="pad-h">Big three</h2>
                <ul className="ruled">
                  <AnimatePresence initial={false}>
                    {big.map((t) => <TaskRow key={t.id} task={t} big {...rowProps} />)}
                  </AnimatePresence>
                </ul>
              </section>
            )}
            {rest.length > 0 && (
              <section className="pad-section">
                <h2 className="pad-h">{big.length ? 'Everything else' : isToday ? 'Today' : 'Planned'}</h2>
                <ul className="ruled">
                  <AnimatePresence initial={false}>
                    {rest.map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
                  </AnimatePresence>
                </ul>
              </section>
            )}
          </>
        )}

        <button type="button" className="write-row" onClick={() => setSheetOpen(true)}>
          <span className="row-margin"><span className="pen" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </span></span>
          <span>{isToday ? 'Write a task' : `Plan something for ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}</span>
        </button>

        {list.length > 0 && <p className="pad-hint">Swipe a line left to delete it.</p>}
      </section>

      <AddTaskSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addTask}
        bigCount={todayTasks.filter((t) => t.is_big3).length} days={days} day={day} />
    </main>
  )
}
