import { useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { categoryLabel } from '../lib/categories'

const shortDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })

function Box({ checked, small, disabled, onClick, label }) {
  return (
    <button type="button" className={`box ${small ? 'box-sm' : ''} ${checked ? 'is-checked' : ''}`}
      role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="tick" d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </button>
  )
}

const HOLD_MS = 500

export default function TaskRow({ task, big, today, future, onToggle, onRemove, onAddStep, onToggleStep, onRemoveStep, onEdit, onFocus, onDrop }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const controls = useDragControls()
  // Hold a line to edit it (right-click on a computer)
  const hold = useRef({ timer: null, x: 0, y: 0, fired: false })

  function holdStart(e) {
    hold.current.fired = false
    hold.current.x = e.clientX
    hold.current.y = e.clientY
    clearTimeout(hold.current.timer)
    hold.current.timer = setTimeout(() => {
      hold.current.fired = true
      navigator.vibrate?.(10)
      onEdit(task)
    }, HOLD_MS)
  }
  function holdMove(e) {
    if (Math.abs(e.clientX - hold.current.x) > 8 || Math.abs(e.clientY - hold.current.y) > 8) clearTimeout(hold.current.timer)
  }
  const holdEnd = () => clearTimeout(hold.current.timer)

  function mainClick() {
    if (hold.current.fired) { hold.current.fired = false; return } // the hold already opened the editor
    if (steps.length || future) setOpen((o) => !o)
    else onToggle(task)
  }
  const steps = task.steps ?? []
  const stepsDone = steps.filter((s) => s.done_at).length
  const carried = !future && task.repeat === 'once' && task.due_on && task.due_on < today

  function submitStep(e) {
    e.preventDefault()
    if (!draft.trim()) return
    onAddStep(task, draft)
    setDraft('')
  }

  return (
    <Reorder.Item
      as="li"
      value={task.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="row-item"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(20, 21, 24, .25)', zIndex: 2 }}
    >
      <span className="row-delete" aria-hidden="true">Delete</span>
      <motion.div
        className={`row ${task.done ? 'is-done' : ''}`}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        dragDirectionLock
        onDragEnd={(_, info) => { if (info.offset.x < -110) onRemove(task) }}
      >
        <span className="row-margin">
          <Box checked={task.done} disabled={future} label={`Done: ${task.title}`} onClick={() => onToggle(task)} />
        </span>
        <button
          type="button"
          className="row-main"
          aria-expanded={steps.length ? open : undefined}
          onClick={mainClick}
          onPointerDown={holdStart}
          onPointerMove={holdMove}
          onPointerUp={holdEnd}
          onPointerCancel={holdEnd}
          onPointerLeave={holdEnd}
          onContextMenu={(e) => { e.preventDefault(); holdEnd(); onEdit(task) }}
        >
          <span className="row-title">
            <span className={big ? 'hl' : undefined}>{task.title}</span>
            <span className="strike" aria-hidden="true" />
          </span>
          <span className="row-meta">
            {carried && <span className="carried">from {shortDay(task.due_on)}</span>}
            {steps.length > 0 && <span>{stepsDone} of {steps.length} steps</span>}
            {task.remind_at && <span>{task.remind_at.slice(0, 5)}</span>}
            {!carried && !steps.length && !task.remind_at && <span>{categoryLabel(task.category)}</span>}
          </span>
        </button>
        {steps.length > 0 && (
          <button type="button" className={`row-chevron ${open ? 'is-open' : ''}`} aria-label={open ? 'Hide steps' : 'Show steps'} onClick={() => setOpen((o) => !o)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
        {!steps.length && (
          <button type="button" className="row-chevron add-steps" aria-expanded={open} aria-label={`More for ${task.title}: steps, edit, focus`} onClick={() => setOpen((o) => !o)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M4 12h10M4 17h6M18 14v6M15 17h6" /></svg>
          </button>
        )}
        <span className="row-grip" aria-hidden="true" onPointerDown={(e) => { holdEnd(); controls.start(e) }}>
          <svg width="14" height="18" viewBox="0 0 14 18"><circle cx="4" cy="4" r="1.6" /><circle cx="10" cy="4" r="1.6" /><circle cx="4" cy="9" r="1.6" /><circle cx="10" cy="9" r="1.6" /><circle cx="4" cy="14" r="1.6" /><circle cx="10" cy="14" r="1.6" /></svg>
        </span>
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="steps" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
            <ul>
              {steps.map((s) => (
                <li key={s.id} className={`step ${s.done_at ? 'is-done' : ''}`}>
                  <Box small checked={!!s.done_at} label={`Step done: ${s.title}`} onClick={() => onToggleStep(task, s, !future)} />
                  <span className="step-title">{s.title}<span className="strike" aria-hidden="true" /></span>
                  <button type="button" className="step-x" aria-label={`Remove step ${s.title}`} onClick={() => onRemoveStep(s)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <form className="step-add" onSubmit={submitStep}>
              <input aria-label={`New step for ${task.title}`} placeholder={steps.length ? 'Add another step' : 'Break it into steps, e.g. Reading'}
                value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} />
              <button type="submit" disabled={!draft.trim()}>Add</button>
            </form>
            <div className="row-actions">
              <button type="button" onClick={() => onEdit(task)}>Edit task</button>
              {!future && !task.done && <button type="button" onClick={() => onFocus(task)}>Focus on it</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  )
}
