import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { addDays, greeting } from '../lib/dates'
import { quoteOfTheDay } from '../lib/quotes'
import DayStrip from '../components/DayStrip'
import TaskRow from '../components/TaskRow'
import AddTaskSheet from '../components/AddTaskSheet'
import FocusTimer from '../components/FocusTimer'
import NextUp from '../components/NextUp'
import { readFocus } from '../lib/focus'
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

// A ruled list she can reorder by dragging the grip on the right of each line
function RowList({ tasks, big, onReorder, rowProps }) {
  const ids = tasks.map((t) => t.id)
  const key = ids.join()
  const [order, setOrder] = useState({ key, ids })
  // When the tasks themselves change (added, done, synced), start from their order again
  const current = order.key === key ? order.ids : ids
  if (order.key !== key && order.ids.join() !== key) setOrder({ key, ids })
  // The order after the last drag step, saved when she lets go
  const dragged = useRef(null)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  return (
    <Reorder.Group as="ul" axis="y" className="ruled" values={current} onReorder={(next) => { dragged.current = next; setOrder({ key, ids: next }) }}>
      <AnimatePresence initial={false}>
        {current.map((id) => byId.get(id)).filter(Boolean).map((t) => (
          <TaskRow key={t.id} task={t} big={big} {...rowProps} onDrop={() => { if (dragged.current) onReorder(dragged.current); dragged.current = null }} />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  )
}

export default function Today({ name, countdowns, onOpenCountdowns }) {
  const data = useTaskData()
  const { loading, today, todayTasks, planFor, toggle, addTask, updateTask, moveToTomorrow, reorder, removeTask, addStep, toggleStep, removeStep } = data
  const [selected, setSelected] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [focus, setFocus] = useState(readFocus)

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

  const edit = (task) => { setEditing(task); setSheetOpen(true) }
  const startFocus = (task) => setFocus({ taskId: task.id, title: task.title, minutes: 25, endsAt: null, left: null })
  const focusTask = focus && todayTasks.find((t) => t.id === focus.taskId)
  function finishFocus(taskId) {
    const t = todayTasks.find((x) => x.id === taskId)
    if (t && !t.done) toggle(t)
    setFocus(null)
  }
  const closeSheet = () => { setSheetOpen(false); setEditing(null) }

  const rowProps = { today, future: !isToday, onToggle: toggle, onRemove: removeTask, onAddStep: addStep, onToggleStep: toggleStep, onRemoveStep: removeStep, onEdit: edit, onFocus: startFocus }

  return (
    <main className="today">
      <h1 className="hello">{name ? `${greeting()}, ${name}` : greeting()}</h1>

      <NextUp countdowns={countdowns} today={today} onOpen={onOpenCountdowns} />

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

      {!isToday && <p className="greeting">Planning {d.toLocaleDateString('en-GB', { weekday: 'long' })}</p>}

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
                <RowList tasks={big} big onReorder={reorder} rowProps={rowProps} />
              </section>
            )}
            {rest.length > 0 && (
              <section className="pad-section">
                <h2 className="pad-h">{big.length ? 'Everything else' : isToday ? 'Today' : 'Planned'}</h2>
                <RowList tasks={rest} onReorder={reorder} rowProps={rowProps} />
              </section>
            )}
          </>
        )}

        <button type="button" className="write-row" onClick={() => { setEditing(null); setSheetOpen(true) }}>
          <span className="row-margin"><span className="pen" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </span></span>
          <span>{isToday ? 'Write a task' : `Plan something for ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}</span>
        </button>

      </section>

      <AddTaskSheet open={sheetOpen} editing={editing} onClose={closeSheet} onAdd={addTask}
        onSave={updateTask} onMoveTomorrow={moveToTomorrow} onDelete={removeTask}
        bigCount={todayTasks.filter((t) => t.is_big3).length} days={days} day={day} />

      <AnimatePresence>
        {focus && (
          <FocusTimer key={focus.taskId} session={focus} canFinish={!!focusTask && !focusTask.done}
            onDone={finishFocus} onClose={() => setFocus(null)} />
        )}
      </AnimatePresence>
    </main>
  )
}
