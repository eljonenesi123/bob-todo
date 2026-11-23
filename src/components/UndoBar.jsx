import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import './UndoBar.css'

const SHOW_MS = 8000

// A strip of paper above the tabs: what just happened, and a way back
export default function UndoBar({ text, onUndo, onClose }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    const t = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <motion.div className="undo-bar" role="status"
      initial={reduce ? false : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <span>{text}</span>
      {onUndo && <button type="button" className="ink-btn" onClick={onUndo}>Undo</button>}
    </motion.div>
  )
}
