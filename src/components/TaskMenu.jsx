import { AnimatePresence } from 'framer-motion'
import PaperSheet from './PaperSheet'

// Everything you can do with one task, behind its three dots. `actions`: [{ label, run, danger }]
export default function TaskMenu({ task, actions, onClose }) {
  return (
    <AnimatePresence>
      {task && (
        <PaperSheet key={task.id} title={task.title} onClose={onClose} onSubmit={() => {}}>
          <div className="task-menu">
            {actions.map((a) => (
              <button key={a.label} type="button" className={a.danger ? 'danger' : undefined} onClick={() => { onClose(); a.run() }}>{a.label}</button>
            ))}
          </div>
        </PaperSheet>
      )}
    </AnimatePresence>
  )
}
