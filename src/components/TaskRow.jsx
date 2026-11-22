import { motion } from 'framer-motion'
import { categoryLabel } from '../lib/categories'

export default function TaskRow({ task, big, onToggle, onRemove }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="task-item"
    >
      <span className="task-delete-hint" aria-hidden="true">Delete</span>
      <motion.button
        type="button"
        className={`task ${big ? 'task-big' : ''} ${task.done ? 'is-done' : ''}`}
        aria-pressed={task.done}
        onClick={() => onToggle(task)}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={(_, info) => { if (info.offset.x < -110) onRemove(task) }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="check">
          {task.done && (
            <motion.svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray)"
              strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <path d="M5 12l5 5L20 7" />
            </motion.svg>
          )}
        </span>
        <span className="task-title">{task.title}</span>
        <span className="task-tag">{categoryLabel(task.category)}</span>
      </motion.button>
    </motion.li>
  )
}
