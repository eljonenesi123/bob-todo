import { motion } from 'framer-motion'

// Paper bottom sheet with a form. With `keepOpen`, a tap next to it doesn't close it (so typed words aren't lost).
export default function PaperSheet({ title, onClose, onSubmit, keepOpen, children }) {
  return (
    <>
      <motion.div className="sheet-backdrop" onClick={keepOpen ? undefined : onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.form className="sheet paper" onSubmit={(e) => { e.preventDefault(); onSubmit() }} aria-label={title}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose}>Cancel</button>
        </div>
        {children}
      </motion.form>
    </>
  )
}
