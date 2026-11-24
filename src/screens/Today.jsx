import { useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { greeting } from '../lib/dates'
import { quoteOfTheDay } from '../lib/quotes'
import DayStrip from '../components/DayStrip'
import TaskRow from '../components/TaskRow'
import AddTaskSheet from '../components/AddTaskSheet'
import TaskMenu from '../components/TaskMenu'
import FocusTimer from '../components/FocusTimer'
import NextUp from '../components/NextUp'
import OnDay from '../components/OnDay'
import { between } from '../lib/calendar'
import { readFocus } from '../lib/focus'
import './Today.css'

const STARTERS = [
  { title: 'Drink 2L of water', category: 'health' },
  { title: 'Ten-minute walk', category: 'health' },
  { title: 'Read ten pages', category: 'study' },
  { title: 'Plan tomorrow', category: 'personal' },
]

const byDone = (a, b) => Number(a.done) - Number(b.done)
const dateOf = (iso) => new Date(iso + 'T12:00:00')

// Cards she can reorder by dragging the grip on the right of each one
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
          <TaskRow key={t.id} task={t} big={big} {...rowProps} open={rowProps.openId === t.id} onDrop={() => { if (dragged.current) onReorder(dragged.current); dragged.current = null }} />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  )
}

export default function Today({ name, days, selected, onSelect, countdowns, calendar, onOpenCountdowns, onOpenCalendar, onOpenProgress, onNotice }) {
  const data = useTaskData()
  const { loading, failed, reload, today, todayTasks, planFor, toggle, addTask, updateTask, moveToTomorrow, reorder, removeTask, restoreTask, addStep, toggleStep, removeStep, restoreStep } = data
  const [editing, setEditing] = useState(null)
  const [menuId, setMenuId] = useState(null) // the task whose three dots were tapped
  const [openId, setOpenId] = useState(null) // the task whose steps are showing
  const [focus, setFocus] = useState(readFocus)

  const day = selected
  const isToday = day === today

  const list = isToday ? todayTasks : planFor(day)
  const marks = {}
  for (const { iso } of days) {
    const on = between(calendar.entries, [], iso, iso)
    if (on.length) marks[iso] = on.some((o) => o.entry.highlight) ? 'hl' : 'on'
  }
  const big = list.filter((t) => t.is_big3).sort(byDone)
  const rest = list.filter((t) => !t.is_big3).sort(byDone)
  const done = todayTasks.filter((t) => t.done).length
  const total = todayTasks.length
  const d = dateOf(day)

  const edit = (task) => setEditing(task)
  const startFocus = (task) => setFocus({ taskId: task.id, title: task.title, minutes: 25, endsAt: null, left: null })
  const focusTask = focus && todayTasks.find((t) => t.id === focus.taskId)
  function finishFocus(taskId) {
    const t = todayTasks.find((x) => x.id === taskId)
    if (t && !t.done) toggle(t)
    setFocus(null)
  }
  const closeSheet = () => setEditing(null)

  // Deleting offers a way back for a few seconds
  async function withUndo(text, remove, restore) {
    if (!await remove()) return onNotice({ text: 'It wasn’t deleted. Check your connection and try again.' })
    onNotice({
      text,
      undo: async () => { if (!await restore()) onNotice({ text: 'It didn’t come back. Check your connection and try again.', undo: restore }) },
    })
  }
  const deleteTask = (task) => withUndo(`Deleted “${task.title}”`, () => removeTask(task), () => restoreTask(task))
  const deleteStep = (step) => withUndo(`Removed “${step.title}”`, () => removeStep(step), () => restoreStep(step))

  const tomorrow = days[1].iso
  const canMove = (task) => task.repeat === 'once' && !task.done && task.due_on !== tomorrow
  async function toTomorrow(task) {
    const back = task.due_on
    try {
      await moveToTomorrow(task)
      onNotice({ text: `Moved “${task.title}” to tomorrow`, undo: () => updateTask(task, { due_on: back }).catch(() => onNotice({ text: 'It wasn’t moved back. Check your connection and try again.' })) })
    } catch {
      onNotice({ text: 'It wasn’t moved. Check your connection and try again.' })
    }
  }
  // One place up or down, for when dragging isn't possible
  function shift(task, by) {
    const ids = (task.is_big3 ? big : rest).map((t) => t.id)
    const i = ids.indexOf(task.id)
    ;[ids[i], ids[i + by]] = [ids[i + by], ids[i]]
    reorder(ids)
  }
  const menuTask = list.find((t) => t.id === menuId) ?? null
  function menuActions(task) {
    if (!task) return []
    const siblings = (task.is_big3 ? big : rest).filter((t) => t.done === task.done)
    const i = siblings.findIndex((t) => t.id === task.id)
    return [
      { label: 'Edit', run: () => edit(task) },
      isToday && !task.done && { label: 'Focus on it', run: () => startFocus(task) },
      { label: task.steps.length ? 'Show the steps' : 'Break it into steps', run: () => setOpenId(task.id) },
      canMove(task) && { label: 'Move to tomorrow', run: () => toTomorrow(task) },
      i > 0 && { label: 'Move up', run: () => shift(task, -1) },
      i < siblings.length - 1 && { label: 'Move down', run: () => shift(task, 1) },
      { label: 'Delete', danger: true, run: () => deleteTask(task) },
    ].filter(Boolean)
  }

  const rowProps = { today, future: !isToday, onToggle: toggle, onRemove: deleteTask, onAddStep: addStep, onToggleStep: toggleStep, onRemoveStep: deleteStep, onEdit: edit, onMenu: (t) => setMenuId(t.id), openId, onOpen: setOpenId }

  return (
    <main className="today">
      <div className="hello-row">
        <h1 className="hello">{name ? `${greeting()}, ${name}` : greeting()}</h1>
        <button type="button" className="desk-btn" onClick={onOpenProgress}>Progress</button>
      </div>

      <NextUp countdowns={countdowns} today={today} onOpen={onOpenCountdowns} />
      <OnDay calendar={calendar} day={day} today={today} onOpen={onOpenCalendar} />

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

      <DayStrip days={days} selected={day} marks={marks} onSelect={onSelect} onMonth={() => onOpenCalendar(day)} />

      <section className="pad" aria-label={isToday ? 'Today’s list' : `Plan for ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}>
        {isToday && <p className="quote">{quoteOfTheDay()}</p>}

        {loading ? (
          <div className="pad-loading" aria-label="Loading" />
        ) : failed ? (
          <div className="blank">
            <p className="blank-title">Your tasks didn’t open.</p>
            <p className="blank-sub">Check your connection and try again.</p>
            <div className="pad-block"><button type="button" className="ink-btn" onClick={reload}>Try again</button></div>
          </div>
        ) : list.length === 0 ? (
          <div className="blank">
            <p className="blank-title">{isToday ? 'Blank page.' : 'Nothing planned yet.'}</p>
            <p className="blank-sub">{isToday ? 'Tap the plus to write the first thing you want done today, or pick one of these.' : 'Tap the plus to add what you already know is coming.'}</p>
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

      </section>

      <TaskMenu task={menuTask} actions={menuActions(menuTask)} onClose={() => setMenuId(null)} />

      <AddTaskSheet open={!!editing} editing={editing} onClose={closeSheet} onAdd={addTask}
        onSave={updateTask} onMoveTomorrow={moveToTomorrow} onDelete={deleteTask}
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
