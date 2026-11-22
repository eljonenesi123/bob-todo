import { motion } from 'framer-motion'

const STARTERS = [
  { title: 'Drink 2L water', category: 'health' },
  { title: '10 min walk', category: 'health' },
  { title: 'Read 10 pages', category: 'study' },
  { title: 'Plan tomorrow', category: 'personal' },
]

export default function EmptyState({ onAdd, onQuickAdd }) {
  return (
    <>
      <motion.section className="empty-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="empty-sun">
          <svg className="spin-slow" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        </div>
        <h2>Your day is a blank page</h2>
        <p>Add your first task. Start small, even tiny wins count.</p>
        <button type="button" className="btn btn-primary pulse" onClick={onAdd}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add first task
        </button>
      </motion.section>

      <motion.section className="starters" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="section-title">Or start with one of these</h2>
        <div className="chips">
          {STARTERS.map((s) => (
            <button type="button" key={s.title} className="chip chip-light" onClick={() => onQuickAdd(s)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              {s.title}
            </button>
          ))}
        </div>
      </motion.section>
    </>
  )
}
